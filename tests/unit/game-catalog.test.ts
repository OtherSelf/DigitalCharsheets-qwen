import fs from 'node:fs';
import path from 'node:path';

import { afterEach, beforeEach, describe, expect, it } from 'vitest';

import { listGamePlugins } from '@/games/registry';
import {
  canAccessModule,
  canCreateWithModule,
  gameCatalogPath,
  getModuleStatus,
  isModuleEnabled,
  listModuleAccess,
  readGameCatalog,
  setModuleEnabled,
  setModuleStatus,
  setSiteTitle,
} from '@/lib/game-catalog';

import { removeDir, useTempDataDir } from '@tests/support';

/**
 * ─── LANDMARK: GAME CATALOG TESTS ─────────────────────────────────────────
 * Каталог v2 переживает рестарт (файл в data-dir), пишется атомарно под
 * локом. Две независимые сущности: visibility — матрица ролей
 * (published → все; test → tester+admin; hidden → только admin), enabled —
 * активность плагина (создание/меню/демо). v1 `statuses` читается и
 * переезжает в v2 автоматически.
 *
 * Тест не знает конкретных игр: `systemId` и `defaultStatus` берутся из
 * реестра, поэтому удаление или добавление редакции не правит этот файл.
 */
let dataDir: string;

const PLUGINS = listGamePlugins();
/** Первый и второй плагины реестра: тесту нужны любые два разных модуля. */
const FIRST = PLUGINS[0].manifest;
const SECOND = PLUGINS[1].manifest;
/** Идентификатор, которого в реестре нет, — на нём проверяются ошибки. */
const UNKNOWN_ID = 'zzunknownplugin';

beforeEach(() => {
  dataDir = useTempDataDir();
});

afterEach(() => {
  delete process.env.DCS_DATA_DIR;
  removeDir(dataDir);
});

describe('game-catalog', () => {
  it('без файла отдаёт defaultStatus модулей и enabled=true', async () => {
    const catalog = await readGameCatalog();
    expect(catalog.plugins).toEqual({});
    expect(catalog.siteTitle).toBeUndefined();
    for (const plugin of PLUGINS) {
      expect(await getModuleStatus(plugin.manifest.id)).toBe(
        plugin.manifest.defaultStatus,
      );
    }
    expect(await isModuleEnabled(FIRST.id)).toBe(true);
  });

  it('сохраняет статус в settings/game-catalog.json и читает обратно', async () => {
    await setModuleStatus(SECOND.id, 'test');

    const file = gameCatalogPath();
    expect(fs.existsSync(file)).toBe(true);
    const raw = JSON.parse(fs.readFileSync(file, 'utf8'));
    expect(raw).toMatchObject({
      version: 2,
      plugins: { [SECOND.id]: { enabled: true, visibility: 'test' } },
    });

    expect(await getModuleStatus(SECOND.id)).toBe('test');
    expect(await getModuleStatus(FIRST.id)).toBe(FIRST.defaultStatus);

    await setModuleStatus(FIRST.id, 'hidden');
    expect(await getModuleStatus(FIRST.id)).toBe('hidden');
    expect(await getModuleStatus(SECOND.id)).toBe('test');
  });

  it('матрица видимости по ролям', async () => {
    for (const role of [undefined, 'user', 'tester', 'admin'] as const) {
      expect(await canAccessModule(role, FIRST.id)).toBe(true);
    }

    await setModuleStatus(SECOND.id, 'test');
    expect(await canAccessModule(undefined, SECOND.id)).toBe(false);
    expect(await canAccessModule('user', SECOND.id)).toBe(false);
    expect(await canAccessModule('tester', SECOND.id)).toBe(true);
    expect(await canAccessModule('admin', SECOND.id)).toBe(true);

    await setModuleStatus(FIRST.id, 'hidden');
    expect(await canAccessModule(undefined, FIRST.id)).toBe(false);
    expect(await canAccessModule('user', FIRST.id)).toBe(false);
    expect(await canAccessModule('tester', FIRST.id)).toBe(false);
    expect(await canAccessModule('admin', FIRST.id)).toBe(true);
  });

  it('listModuleAccess отдаёт статус, enabled и видимость каждого модуля', async () => {
    await setModuleStatus(SECOND.id, 'test');
    const entries = await listModuleAccess('user');
    // Число модулей — из реестра: добавление плагина не правит тест.
    expect(entries).toHaveLength(PLUGINS.length);
    expect(
      entries.find((entry) => entry.module.id === SECOND.id),
    ).toMatchObject({
      status: 'test',
      enabled: true,
      visible: false,
    });
    expect(entries.find((entry) => entry.module.id === FIRST.id)).toMatchObject(
      {
        status: FIRST.defaultStatus,
        enabled: true,
        visible: true,
      },
    );
  });

  it('enabled=false скрывает из создания, не меняя visibility', async () => {
    await setModuleEnabled(FIRST.id, false);
    const catalog = await readGameCatalog();
    expect(catalog.plugins[FIRST.id]).toEqual({
      enabled: false,
      visibility: FIRST.defaultStatus,
      useHostTheme: false,
    });
    expect(await isModuleEnabled(FIRST.id)).toBe(false);
    expect(await getModuleStatus(FIRST.id)).toBe(FIRST.defaultStatus);
    expect(await canAccessModule('admin', FIRST.id)).toBe(true);
    expect(await canCreateWithModule('admin', FIRST.id)).toBe(false);
    expect(await canCreateWithModule('user', SECOND.id)).toBe(true);

    const entry = (await listModuleAccess('user')).find(
      (item) => item.module.id === FIRST.id,
    );
    expect(entry).toMatchObject({ enabled: false, visible: false });

    await setModuleEnabled(FIRST.id, true);
    expect(await isModuleEnabled(FIRST.id)).toBe(true);
    expect(await canCreateWithModule('user', FIRST.id)).toBe(true);
  });

  it('смена visibility не включает выключенный плагин и наоборот', async () => {
    await setModuleEnabled(SECOND.id, false);
    await setModuleStatus(SECOND.id, 'hidden');
    expect((await readGameCatalog()).plugins[SECOND.id]).toEqual({
      enabled: false,
      visibility: 'hidden',
      useHostTheme: false,
    });
    await setModuleEnabled(SECOND.id, true);
    expect((await readGameCatalog()).plugins[SECOND.id]).toEqual({
      enabled: true,
      visibility: 'hidden',
      useHostTheme: false,
    });
  });

  it('каталог v1 (statuses) мигрирует в v2 при чтении', async () => {
    const file = gameCatalogPath();
    fs.mkdirSync(path.dirname(file), { recursive: true });
    fs.writeFileSync(
      file,
      JSON.stringify({ version: 1, statuses: { [SECOND.id]: 'test' } }),
      'utf8',
    );
    const catalog = await readGameCatalog();
    expect(catalog.version).toBe(2);
    expect(catalog.plugins).toEqual({
      [SECOND.id]: { enabled: true, visibility: 'test' },
    });
    expect(await getModuleStatus(SECOND.id)).toBe('test');
    expect(await isModuleEnabled(SECOND.id)).toBe(true);

    // Первая запись переводит файл в v2.
    await setSiteTitle('Z');
    const raw = JSON.parse(fs.readFileSync(file, 'utf8'));
    expect(raw.version).toBe(2);
    expect(raw.plugins[SECOND.id]).toEqual({
      enabled: true,
      visibility: 'test',
    });
  });

  it('заголовок сайта переопределяется и сбрасывается', async () => {
    await setSiteTitle('  Мой стол  ');
    expect((await readGameCatalog()).siteTitle).toBe('Мой стол');

    await setSiteTitle(null);
    expect((await readGameCatalog()).siteTitle).toBeUndefined();
  });

  it('битый файл или неизвестный статус не ломают чтение', async () => {
    const file = gameCatalogPath();
    fs.mkdirSync(path.dirname(file), { recursive: true });
    fs.writeFileSync(file, '{not json', 'utf8');
    expect((await readGameCatalog()).plugins).toEqual({});

    fs.writeFileSync(
      file,
      JSON.stringify({
        version: 1,
        statuses: { [SECOND.id]: 'nonsense', [FIRST.id]: 'test' },
      }),
      'utf8',
    );
    expect((await readGameCatalog()).plugins).toEqual({
      [FIRST.id]: { enabled: true, visibility: 'test' },
    });
  });

  it('неизвестный модуль или статус — ошибка', async () => {
    await expect(setModuleStatus(UNKNOWN_ID as never, 'test')).rejects.toThrow(
      /Неизвестный модуль/,
    );
    await expect(setModuleStatus(FIRST.id, 'bogus' as never)).rejects.toThrow(
      /Неизвестный статус/,
    );
    await expect(setModuleEnabled(UNKNOWN_ID as never, false)).rejects.toThrow(
      /Неизвестный модуль/,
    );
  });
});
