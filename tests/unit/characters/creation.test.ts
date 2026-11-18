/**
 * Сквозное создание персонажа для каждой обнаруженной редакции: payload'ы
 * берутся из `createDefaults()` модуля, системные поля проверяют тесты
 * плагинов. Так добавление/удаление плагина не ломает хост (D18).
 */

import fs from 'node:fs';
import path from 'node:path';

import { afterEach, beforeEach, describe, expect, it } from 'vitest';

import { POST as charactersPost } from '@/app/api/characters/route';
import { GET as exportGet } from '@/app/api/export/route';
import {
  getGamePlugin,
  listGameModules,
  type AnyGameModule,
} from '@/games/registry';
import { applyCharacterDerive } from '@/lib/character-derive';
import { normalizeCharacterRecord } from '@/lib/character-version';

import { readJson, removeDir, userPaths, useTempDataDir } from '@tests/support';
import {
  CHARACTERS_URL,
  cookieFor,
  createCharacter,
  EXPORT_URL,
  getRequest,
  jsonRequest,
  listCharacters,
  login,
  PASSWORD,
  register,
} from '@tests/support/character-flows';

let dataDir: string;

beforeEach(() => {
  dataDir = useTempDataDir();
});

afterEach(() => {
  removeDir(dataDir);
});

// ──────── создание персонажа в каждой обнаруженной редакции (матрица) ──────

// Создавать лист может только редакция, видимая роли `user`. В тестовом
// каталоге (пустой файл) это ровно `defaultStatus: published`; скрытый или
// `test`-плагин матрицей не проверяется, иначе добавление плагина в статусе
// hidden ломало бы хост-тест (сценарий доступности проверяет game-catalog).
const CREATABLE_MODULES = listGameModules().filter(
  (gameModule) => gameModule.defaultStatus === 'published',
);

describe.each(CREATABLE_MODULES)(
  'создание персонажа — $id',
  (gameModule: AnyGameModule) => {
    const slug = gameModule.id;
    const characterName = `Character ${slug}`;

    function payload(overrides: Record<string, unknown> = {}) {
      return {
        ...gameModule.createDefaults({ name: characterName }),
        ...overrides,
      };
    }

    function expectedSheet(data: Record<string, unknown>) {
      // Сервер авторитетен для производных значений: на диске и в ответе
      // лежит документ после `derive`, а не то, что прислал клиент (D11).
      return applyCharacterDerive(
        normalizeCharacterRecord({
          ...(gameModule.createDefaults() as Record<string, unknown>),
          ...data,
        }).character as unknown as Record<string, unknown>,
      );
    }

    it('POST создаёт лист (201) и не теряет ни одного поля', async () => {
      const user = await register(`gm-${slug}`);
      const data = payload();

      const { status, body: created } = await createCharacter(user.uid, data);

      expect(status).toBe(201);
      expect(created.id).toBeTruthy();
      expect(created.userId).toBe(user.uid);
      expect(created.systemId).toBe(gameModule.id);
      expect(created.name).toBe(data.name);

      // Сервер заполняет недостающие поля значениями редакции
      // (`createDefaults`), добавляет id/userId и нормализует лист до v2.
      const filePath = path.join(
        userPaths(dataDir, user.uid).charactersDir,
        `${created.id}.json`,
      );
      expect(fs.existsSync(filePath)).toBe(true);
      expect(readJson(filePath)).toEqual({
        ...expectedSheet(data),
        id: created.id,
        userId: user.uid,
        schemaVersion: gameModule.schemaVersion,
      });
    });

    it('производные значения пересчитываются сервером при создании', async () => {
      const plugin = getGamePlugin(gameModule.id);
      const derivedFields = plugin?.manifest.derived ?? [];
      if (!plugin?.derive || derivedFields.length === 0) {
        // Плагин без `derive` — пересчитывать нечего, и это не ошибка хоста.
        expect(plugin?.derive).toBeUndefined();
        return;
      }

      const user = await register(`derive-${slug}`);
      const data = { ...payload() } as Record<string, unknown>;
      // Портим верхнеуровневое числовое производное, если оно объявлено:
      // сервер обязан сохранить согласованный документ (D11).
      const scalar = derivedFields.find(
        (field) => !field.includes('[]') && typeof data[field] === 'number',
      );
      if (scalar) data[scalar] = 999;

      const { status, body: created } = await createCharacter(user.uid, data);
      expect(status).toBe(201);

      const stored = readJson(
        path.join(
          userPaths(dataDir, user.uid).charactersDir,
          `${created.id}.json`,
        ),
      ) as Record<string, unknown>;
      const derived = (
        plugin.derive as (doc: unknown) => Record<string, unknown>
      )(expectedSheet(data));
      for (const field of derivedFields) {
        if (field.includes('[]')) continue;
        if (!(field in derived)) continue;
        expect(stored[field], `${slug}: ${field}`).toEqual(derived[field]);
      }
    });

    it('системные поля персонажа сохраняются в своей ветке', async () => {
      const user = await register(`fields-${slug}`);
      const data = payload();
      const { body: created } = await createCharacter(user.uid, data);

      const stored = readJson(
        path.join(
          userPaths(dataDir, user.uid).charactersDir,
          `${created.id}.json`,
        ),
      );
      const expected = expectedSheet(data) as unknown as Record<
        string,
        unknown
      >;

      // Каждое поле фабрики редакции доезжает до диска без потерь; состав
      // собственных/чужих полей проверяют тесты плагинов.
      for (const field of Object.keys(gameModule.createDefaults())) {
        expect(
          stored,
          `поле ${field} должно быть у ${gameModule.id}`,
        ).toHaveProperty(field);
        expect(stored[field]).toEqual(expected[field]);
      }

      expect(stored.stats).toEqual(expected.stats);
      expect(stored.name).toBe(data.name);
      expect(gameModule.schema.safeParse(stored).success).toBe(true);
    });

    it('лист попадает в список и доступен через /api/export?characterId', async () => {
      const user = await register(`export-${slug}`);
      const data = payload();
      const { body: created } = await createCharacter(user.uid, data);

      const expected = expectedSheet(data);

      const list = await listCharacters(user.uid);
      expect(list.map((c) => c.id)).toContain(created.id);

      const res = await exportGet(
        getRequest(
          `${EXPORT_URL}?characterId=${encodeURIComponent(created.id)}`,
          cookieFor(user.uid),
        ),
      );
      expect(res.status).toBe(200);
      const exported = await res.json();
      // Экспорт — переносимый: служебный userId в него не попадает.
      expect(exported.userId).toBeUndefined();
      expect(exported).toEqual({
        ...expected,
        id: created.id,
        schemaVersion: gameModule.schemaVersion,
      });
    });

    it('лист виден после повторного входа в аккаунт', async () => {
      const user = await register(`relogin-${slug}`);
      const data = payload();
      const { body: created } = await createCharacter(user.uid, data);

      const again = await login(`relogin-${slug}`, PASSWORD);
      expect(again.body.isNewUser).toBe(false);
      expect(again.body.user.uid).toBe(user.uid);

      const list = await listCharacters(again.body.user.uid);
      expect(list).toHaveLength(1);
      expect(list[0]).toMatchObject({
        id: created.id,
        name: data.name,
        systemId: gameModule.id,
      });
    });

    it('сервер выдаёт свой id и игнорирует id от клиента', async () => {
      const user = await register(`client-id-${slug}`);
      const data = payload({ id: 'client-chosen-id' });

      const { status, body: created } = await createCharacter(user.uid, data);

      expect(status).toBe(201);
      expect(created.id).not.toBe('client-chosen-id');
      expect(created.id.length).toBeGreaterThan(0);

      // В каталоге ровно один файл — по серверному id, «клиентского» нет.
      const files = fs.readdirSync(userPaths(dataDir, user.uid).charactersDir);
      expect(files).toEqual([`${created.id}.json`]);
    });

    it('без сессии создание отклоняется (401) и ничего не пишет', async () => {
      const data = payload();
      const res = await charactersPost(jsonRequest(CHARACTERS_URL, data));

      expect(res.status).toBe(401);
      expect((await res.json()).error).toMatch(/unauthorized/i);
      expect(fs.existsSync(path.join(dataDir, 'users'))).toBe(false);
    });
  },
);

// ─────────────── две редакции в одном аккаунте не смешиваются ──────────────

describe('две игровые системы в одном аккаунте', () => {
  it('две обнаруженные редакции хранятся раздельно и не смешиваются', async () => {
    const [first, second] = listGameModules();
    const user = await register('multi-system');

    const firstPayload = first.createDefaults({
      name: `Character ${first.id}`,
    });
    const secondPayload = second.createDefaults({
      name: `Character ${second.id}`,
    });

    const firstCreated = await createCharacter(user.uid, firstPayload);
    const secondCreated = await createCharacter(user.uid, secondPayload);
    expect([firstCreated.status, secondCreated.status]).toEqual([201, 201]);

    const list = await listCharacters(user.uid);
    expect(list).toHaveLength(2);
    expect(list.map((c) => c.systemId).sort()).toEqual(
      [first.id, second.id].sort(),
    );

    // И на диске два независимых файла.
    const files = fs.readdirSync(userPaths(dataDir, user.uid).charactersDir);
    expect(files).toHaveLength(2);
    expect(files.sort()).toEqual(
      [`${firstCreated.body.id}.json`, `${secondCreated.body.id}.json`].sort(),
    );
  });
});
