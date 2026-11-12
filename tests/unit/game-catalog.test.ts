import fs from 'node:fs';
import path from 'node:path';

import { afterEach, beforeEach, describe, expect, it } from 'vitest';

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

import { removeDir, useTempDataDir } from './helpers';

/**
 * ─── LANDMARK: GAME CATALOG TESTS ─────────────────────────────────────────
 * Каталог v2 переживает рестарт (файл в data-dir), пишется атомарно под
 * локом. Две независимые сущности (D16): visibility — матрица ролей
 * (published → все; test → tester+admin; hidden → только admin), enabled —
 * активность плагина (создание/меню/демо). v1 `statuses` читается и
 * переезжает в v2 автоматически.
 */
let dataDir: string;

beforeEach(() => {
  dataDir = useTempDataDir();
});

afterEach(() => {
  delete process.env.DCS_DATA_DIR;
  removeDir(dataDir);
});

describe('game-catalog', () => {
  it('без файла отдаёт defaultStatus модулей и enabled=true', () => {
    const catalog = readGameCatalog();
    expect(catalog.plugins).toEqual({});
    expect(catalog.siteTitle).toBeUndefined();
    expect(getModuleStatus('dnd5e')).toBe('published');
    expect(getModuleStatus('dh2')).toBe('published');
    expect(isModuleEnabled('dnd5e')).toBe(true);
  });

  it('сохраняет статус в settings/game-catalog.json и читает обратно', () => {
    setModuleStatus('dh2', 'test');

    const file = gameCatalogPath();
    expect(fs.existsSync(file)).toBe(true);
    const raw = JSON.parse(fs.readFileSync(file, 'utf8'));
    expect(raw).toMatchObject({
      version: 2,
      plugins: { dh2: { enabled: true, visibility: 'test' } },
    });

    expect(getModuleStatus('dh2')).toBe('test');
    expect(getModuleStatus('dh1')).toBe('published');

    setModuleStatus('dh1', 'hidden');
    expect(getModuleStatus('dh1')).toBe('hidden');
    expect(getModuleStatus('dh2')).toBe('test');
  });

  it('матрица видимости по ролям', () => {
    expect(canAccessModule(undefined, 'dnd5e')).toBe(true);
    expect(canAccessModule('user', 'dnd5e')).toBe(true);
    expect(canAccessModule('tester', 'dnd5e')).toBe(true);
    expect(canAccessModule('admin', 'dnd5e')).toBe(true);

    setModuleStatus('dh2', 'test');
    expect(canAccessModule(undefined, 'dh2')).toBe(false);
    expect(canAccessModule('user', 'dh2')).toBe(false);
    expect(canAccessModule('tester', 'dh2')).toBe(true);
    expect(canAccessModule('admin', 'dh2')).toBe(true);

    setModuleStatus('dh1', 'hidden');
    expect(canAccessModule(undefined, 'dh1')).toBe(false);
    expect(canAccessModule('user', 'dh1')).toBe(false);
    expect(canAccessModule('tester', 'dh1')).toBe(false);
    expect(canAccessModule('admin', 'dh1')).toBe(true);
  });

  it('listModuleAccess отдаёт статус, enabled и видимость каждого модуля', () => {
    setModuleStatus('dh2', 'test');
    const entries = listModuleAccess('user');
    expect(entries).toHaveLength(3);
    expect(entries.find((entry) => entry.module.id === 'dh2')).toMatchObject({
      status: 'test',
      enabled: true,
      visible: false,
    });
    expect(entries.find((entry) => entry.module.id === 'dnd5e')).toMatchObject({
      status: 'published',
      enabled: true,
      visible: true,
    });
  });

  it('enabled=false скрывает из создания, не меняя visibility (D16)', () => {
    setModuleEnabled('dh1', false);
    const catalog = readGameCatalog();
    expect(catalog.plugins.dh1).toEqual({
      enabled: false,
      visibility: 'published',
    });
    expect(isModuleEnabled('dh1')).toBe(false);
    expect(getModuleStatus('dh1')).toBe('published');
    expect(canAccessModule('admin', 'dh1')).toBe(true);
    expect(canCreateWithModule('admin', 'dh1')).toBe(false);
    expect(canCreateWithModule('user', 'dnd5e')).toBe(true);

    const entry = listModuleAccess('user').find(
      (item) => item.module.id === 'dh1',
    );
    expect(entry).toMatchObject({ enabled: false, visible: false });

    setModuleEnabled('dh1', true);
    expect(isModuleEnabled('dh1')).toBe(true);
    expect(canCreateWithModule('user', 'dh1')).toBe(true);
  });

  it('смена visibility не включает выключенный плагин и наоборот', () => {
    setModuleEnabled('dh2', false);
    setModuleStatus('dh2', 'hidden');
    expect(readGameCatalog().plugins.dh2).toEqual({
      enabled: false,
      visibility: 'hidden',
    });
    setModuleEnabled('dh2', true);
    expect(readGameCatalog().plugins.dh2).toEqual({
      enabled: true,
      visibility: 'hidden',
    });
  });

  it('каталог v1 (statuses) мигрирует в v2 при чтении', () => {
    const file = gameCatalogPath();
    fs.mkdirSync(path.dirname(file), { recursive: true });
    fs.writeFileSync(
      file,
      JSON.stringify({ version: 1, statuses: { dh2: 'test' } }),
      'utf8',
    );
    const catalog = readGameCatalog();
    expect(catalog.version).toBe(2);
    expect(catalog.plugins).toEqual({
      dh2: { enabled: true, visibility: 'test' },
    });
    expect(getModuleStatus('dh2')).toBe('test');
    expect(isModuleEnabled('dh2')).toBe(true);

    // Первая запись переводит файл в v2.
    setSiteTitle('Z');
    const raw = JSON.parse(fs.readFileSync(file, 'utf8'));
    expect(raw.version).toBe(2);
    expect(raw.plugins.dh2).toEqual({ enabled: true, visibility: 'test' });
  });

  it('заголовок сайта переопределяется и сбрасывается', () => {
    setSiteTitle('  Мой стол  ');
    expect(readGameCatalog().siteTitle).toBe('Мой стол');

    setSiteTitle(null);
    expect(readGameCatalog().siteTitle).toBeUndefined();
  });

  it('битый файл или неизвестный статус не ломают чтение', () => {
    const file = gameCatalogPath();
    fs.mkdirSync(path.dirname(file), { recursive: true });
    fs.writeFileSync(file, '{not json', 'utf8');
    expect(readGameCatalog().plugins).toEqual({});

    fs.writeFileSync(
      file,
      JSON.stringify({
        version: 1,
        statuses: { dh2: 'nonsense', dnd5e: 'test' },
      }),
      'utf8',
    );
    expect(readGameCatalog().plugins).toEqual({
      dnd5e: { enabled: true, visibility: 'test' },
    });
  });

  it('неизвестный модуль или статус — ошибка', () => {
    expect(() => setModuleStatus('dh9', 'test')).toThrow(/Неизвестный модуль/);
    expect(() => setModuleStatus('dh1', 'bogus' as never)).toThrow(
      /Неизвестный статус/,
    );
    expect(() => setModuleEnabled('dh9', false)).toThrow(/Неизвестный модуль/);
  });
});
