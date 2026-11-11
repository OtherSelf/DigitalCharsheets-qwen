import fs from 'node:fs';
import path from 'node:path';

import { afterEach, beforeEach, describe, expect, it } from 'vitest';

import {
  canAccessModule,
  gameCatalogPath,
  getModuleStatus,
  listModuleAccess,
  readGameCatalog,
  setModuleStatus,
  setSiteTitle,
} from '@/lib/game-catalog';

import { removeDir, useTempDataDir } from './helpers';

/**
 * ─── LANDMARK: GAME CATALOG TESTS ─────────────────────────────────────────
 * Каталог видимости переживает рестарт (файл в data-dir), пишется атомарно
 * под локом, а матрица ролей строго задана:
 *   published → все; test → tester+admin; hidden → только admin.
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
  it('без файла отдаёт defaultStatus модулей', () => {
    const catalog = readGameCatalog();
    expect(catalog.statuses).toEqual({});
    expect(catalog.siteTitle).toBeUndefined();
    expect(getModuleStatus('dnd5e')).toBe('published');
    expect(getModuleStatus('dh2')).toBe('published');
  });

  it('сохраняет статус в settings/game-catalog.json и читает обратно', () => {
    setModuleStatus('dh2', 'test');

    const file = gameCatalogPath();
    expect(fs.existsSync(file)).toBe(true);
    const raw = JSON.parse(fs.readFileSync(file, 'utf8'));
    expect(raw).toMatchObject({
      version: 1,
      statuses: { dh2: 'test' },
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

  it('listModuleAccess отдаёт статус и видимость каждого модуля', () => {
    setModuleStatus('dh2', 'test');
    const entries = listModuleAccess('user');
    expect(entries).toHaveLength(3);
    expect(entries.find((entry) => entry.module.id === 'dh2')).toMatchObject({
      status: 'test',
      visible: false,
    });
    expect(entries.find((entry) => entry.module.id === 'dnd5e')).toMatchObject({
      status: 'published',
      visible: true,
    });
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
    expect(readGameCatalog().statuses).toEqual({});

    fs.writeFileSync(
      file,
      JSON.stringify({
        version: 1,
        statuses: { dh2: 'nonsense', dnd5e: 'test' },
      }),
      'utf8',
    );
    expect(readGameCatalog().statuses).toEqual({ dnd5e: 'test' });
  });

  it('неизвестный модуль или статус — ошибка', () => {
    expect(() => setModuleStatus('dh9', 'test')).toThrow(/Неизвестный модуль/);
    expect(() => setModuleStatus('dh1', 'bogus' as never)).toThrow(
      /Неизвестный статус/,
    );
  });
});
