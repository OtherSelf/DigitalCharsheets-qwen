import { describe, expect, it } from 'vitest';

import * as dh2Namespace from '@/games/dh2';
import { parseEntryPoint, type PluginManifest } from '@/games/plugin-api';

import rawManifest from '../../plugin.json';

/**
 * ─── LANDMARK: DH2 MODULE CONTRACT ────────────────────────────────────────
 * Метаданные и точки входа, которые проверяет только сама редакция:
 * админский `shortCode`, имена экспортов `index.ts` из манифеста и набор
 * полей 2-й редакции (fatigue2nd, influence 30, без fatigue1st).
 *
 * Хостовый `tests/unit/game-registry.test.ts` работает по обнаруженным
 * модулям и этих значений не знает: удаление dh2 не должно ломать хост.
 */

const manifest = rawManifest as unknown as PluginManifest;
const dh2Module = dh2Namespace.dh2Module;
const namespace = dh2Namespace as unknown as Record<string, unknown>;

function memberOf(entry: string): string {
  const { member } = parseEntryPoint(entry);
  expect(member, entry).toBeDefined();
  return member!;
}

describe('dh2: модуль плагина', () => {
  it('короткий код редакции для админки — dh2e', () => {
    expect(dh2Module.shortCode).toBe('dh2e');
  });

  it('точки входа манифеста — реальные экспорты index.ts', () => {
    expect(namespace[memberOf(manifest.entry.module)]).toBe(dh2Module);
    expect(namespace[memberOf(manifest.demo.entry)]).toBe(dh2Module.createDemo);
    expect(namespace[memberOf(manifest.export.json)]).toBe(
      dh2Module.export.toPortableJson,
    );
    expect(namespace[memberOf(manifest.export.excel)]).toBe(
      dh2Module.export.buildExcelSections,
    );
    for (const migration of manifest.migrations) {
      expect(typeof namespace[memberOf(migration.entry)]).toBe('function');
    }
  });

  it('дефолты 2-й редакции: fatigue2nd и influence, 1e-полей нет', () => {
    const draft = dh2Module.createDefaults() as unknown as Record<
      string,
      unknown
    >;

    expect(draft.fatigue2nd).toBeDefined();
    expect('fatigue1st' in draft).toBe(false);
    expect((draft.stats as Record<string, number>).influence).toBe(30);
  });
});
