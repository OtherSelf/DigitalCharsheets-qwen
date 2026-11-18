/**
 * Сквозное создание персонажа для каждой игровой системы: payload'ы форм,
 * системные поля, список и экспорт. DH1 создаётся с одним именем.
 */

import fs from 'node:fs';
import path from 'node:path';

import { afterEach, beforeEach, describe, expect, it } from 'vitest';

import { POST as charactersPost } from '@/app/api/characters/route';
import { GET as exportGet } from '@/app/api/export/route';
import { getGameModule } from '@/games/registry';
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
import {
  dhPayload,
  dndPayload,
  SYSTEMS,
} from '@tests/support/character-payloads';

let dataDir: string;

beforeEach(() => {
  dataDir = useTempDataDir();
});

afterEach(() => {
  removeDir(dataDir);
});

describe('создание DH1: только имя обязательно', () => {
  it('лист создаётся без мира и карьеры, пустые поля остаются пустыми', async () => {
    const user = await register('dh1-name-only');
    const { status, body } = await createCharacter(user.uid, {
      systemId: 'dh1',
      name: 'Name Only',
    });

    expect(status).toBe(201);
    expect(body.homeWorld).toBe('');
    expect(body.careerPath).toBe('');
    expect(body.characterClass).toBe('');
    expect(body.rank).toBe('');
    expect(body.divination).toBe('');
  });
});

// ──────── создание персонажа в каждой версии игры (матрица систем) ─────────

describe.each(SYSTEMS)(
  'создание персонажа — $name',
  ({ name, slug, build, ownFields, foreignFields }) => {
    it('POST создаёт лист (201) и не теряет ни одного поля', async () => {
      const user = await register(`gm-${slug}`);
      const payload = build();

      const { status, body } = await createCharacter(user.uid, payload);

      expect(status).toBe(201);
      expect(body.id).toBeTruthy();
      expect(body.userId).toBe(user.uid);
      expect(body.gameSystem).toBe(name);
      expect(body.name).toBe(payload.name);

      // Сервер заполняет недостающие поля значениями редакции
      // (`createDefaults`), добавляет id/userId и нормализует лист до v2.
      const gameModule = getGameModule(body.systemId)!;
      const expectedPayload = normalizeCharacterRecord({
        ...(gameModule.createDefaults() as Record<string, unknown>),
        ...payload,
      }).character;

      // Файл на диске — данные клиента поверх полей редакции.
      const filePath = path.join(
        userPaths(dataDir, user.uid).charactersDir,
        `${body.id}.json`,
      );
      expect(fs.existsSync(filePath)).toBe(true);
      expect(readJson(filePath)).toEqual({
        ...expectedPayload,
        id: body.id,
        userId: user.uid,
        schemaVersion: gameModule.schemaVersion,
      });
    });

    it('системные поля персонажа сохраняются в своей ветке', async () => {
      const user = await register(`fields-${slug}`);
      const payload = build();
      const { body } = await createCharacter(user.uid, payload);

      const stored = readJson(
        path.join(
          userPaths(dataDir, user.uid).charactersDir,
          `${body.id}.json`,
        ),
      );

      const gameModule = getGameModule(body.systemId)!;
      const expected = normalizeCharacterRecord({
        ...(gameModule.createDefaults() as Record<string, unknown>),
        ...payload,
      }).character as unknown as Record<string, unknown>;
      for (const field of ownFields) {
        expect(stored, `поле ${field} должно быть у ${name}`).toHaveProperty(
          field,
        );
        expect(stored[field]).toEqual(expected[field]);
      }
      for (const field of foreignFields) {
        expect(
          stored,
          `поле ${field} не должно попадать в ${name}`,
        ).not.toHaveProperty(field);
      }

      // Ключевые для листа значения тоже на месте (с учётом миграции v2).
      expect(stored.stats).toEqual(expected.stats);
      expect(stored.name).toBe(payload.name);
    });

    it('лист попадает в список и доступен через /api/export?characterId', async () => {
      const user = await register(`export-${slug}`);
      const payload = build();
      const { body: created } = await createCharacter(user.uid, payload);

      const gameModule = getGameModule(created.systemId)!;
      const expectedPayload = normalizeCharacterRecord({
        ...(gameModule.createDefaults() as Record<string, unknown>),
        ...payload,
      }).character;

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
        ...expectedPayload,
        id: created.id,
        schemaVersion: gameModule.schemaVersion,
      });
    });

    it('лист виден после повторного входа в аккаунт', async () => {
      const user = await register(`relogin-${slug}`);
      const payload = build();
      const { body: created } = await createCharacter(user.uid, payload);

      const again = await login(`relogin-${slug}`, PASSWORD);
      expect(again.body.isNewUser).toBe(false);
      expect(again.body.user.uid).toBe(user.uid);

      const list = await listCharacters(again.body.user.uid);
      expect(list).toHaveLength(1);
      expect(list[0]).toMatchObject({
        id: created.id,
        name: payload.name,
        gameSystem: name,
      });
    });

    it('сервер выдаёт свой id и игнорирует id от клиента', async () => {
      const user = await register(`client-id-${slug}`);
      const payload = build({ id: 'client-chosen-id' });

      const { status, body } = await createCharacter(user.uid, payload);

      expect(status).toBe(201);
      expect(body.id).not.toBe('client-chosen-id');
      expect(body.id.length).toBeGreaterThan(0);

      // В каталоге ровно один файл — по серверному id, «клиентского» нет.
      const files = fs.readdirSync(userPaths(dataDir, user.uid).charactersDir);
      expect(files).toEqual([`${body.id}.json`]);
    });

    it('без сессии создание отклоняется (401) и ничего не пишет', async () => {
      const payload = build();
      const res = await charactersPost(jsonRequest(CHARACTERS_URL, payload));

      expect(res.status).toBe(401);
      expect((await res.json()).error).toMatch(/unauthorized/i);
      expect(fs.existsSync(path.join(dataDir, 'users'))).toBe(false);
    });
  },
);

// ─────────────── две системы в одном аккаунте не смешиваются ───────────────

describe('две игровые системы в одном аккаунте', () => {
  it('D&D и Dark Heresy хранятся раздельно и не смешиваются', async () => {
    const user = await register('multi-system');

    const dnd = await createCharacter(user.uid, dndPayload());
    const dh = await createCharacter(user.uid, dhPayload());
    expect([dnd.status, dh.status]).toEqual([201, 201]);

    const list = await listCharacters(user.uid);
    expect(list).toHaveLength(2);

    const storedDnd = list.find((c) => c.gameSystem === 'Dungeons & Dragons');
    const storedDh = list.find((c) => c.gameSystem === 'Dark Heresy');

    expect(storedDnd?.name).toBe('Seraphina Vael');
    expect(storedDh?.name).toBe('Lucius Varn');
    expect(storedDnd?.spells).toHaveLength(2);
    expect(storedDnd?.fatePoints).toBeUndefined();
    expect(storedDh?.fatePoints).toEqual({ current: 1, max: 1 });
    expect(storedDh?.spells).toBeUndefined();

    // И на диске два независимых файла.
    const files = fs.readdirSync(userPaths(dataDir, user.uid).charactersDir);
    expect(files).toHaveLength(2);
    expect(files.sort()).toEqual(
      [`${dnd.body.id}.json`, `${dh.body.id}.json`].sort(),
    );
  });
});
