import { describe, expect, it } from 'vitest';

import * as dh1Namespace from '@/games/dh1';
import { parseEntryPoint, type PluginManifest } from '@/games/plugin-api';

import rawManifest from '../../plugin.json';

/**
 * ─── LANDMARK: DH1 MODULE CONTRACT ────────────────────────────────────────
 * Метаданные и точки входа, которые проверяет только сама редакция:
 * админский `shortCode`, имена экспортов `index.ts` из манифеста и набор
 * полей 1-й редакции (fatigue1st, без 2e-полей).
 *
 * Хостовый `tests/unit/game-registry.test.ts` работает по обнаруженным
 * модулям и этих значений не знает: удаление dh1 не должно ломать хост.
 */

const manifest = rawManifest as unknown as PluginManifest;
const dh1Module = dh1Namespace.dh1Module;
const namespace = dh1Namespace as unknown as Record<string, unknown>;

function memberOf(entry: string): string {
  const { member } = parseEntryPoint(entry);
  expect(member, entry).toBeDefined();
  return member!;
}

describe('dh1: модуль плагина', () => {
  it('короткий код редакции для админки — dh1e', () => {
    expect(dh1Module.shortCode).toBe('dh1e');
  });

  it('точки входа манифеста — реальные экспорты index.ts', () => {
    expect(namespace[memberOf(manifest.entry.module)]).toBe(dh1Module);
    expect(namespace[memberOf(manifest.demo.entry)]).toBe(dh1Module.createDemo);
    expect(namespace[memberOf(manifest.export.json)]).toBe(
      dh1Module.export.toPortableJson,
    );
    expect(namespace[memberOf(manifest.export.excel)]).toBe(
      dh1Module.export.buildExcelSections,
    );
    for (const migration of manifest.migrations) {
      expect(typeof namespace[memberOf(migration.entry)]).toBe('function');
    }
  });

  it('дефолты 1-й редакции: fatigue1st есть, 2e-полей нет', () => {
    const draft = dh1Module.createDefaults() as unknown as Record<
      string,
      unknown
    >;

    expect(draft.fatigue1st).toBeDefined();
    expect('fatigue2nd' in draft).toBe(false);
    expect('influence' in (draft.stats as Record<string, unknown>)).toBe(false);
  });
});
