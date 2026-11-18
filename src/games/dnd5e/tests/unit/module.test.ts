import { describe, expect, it } from 'vitest';

import * as dnd5eNamespace from '@/games/dnd5e';
import { parseEntryPoint, type PluginManifest } from '@/games/plugin-api';
import type { GameModule } from '@/games/types';

import rawManifest from '../../plugin.json';

/**
 * ─── LANDMARK: DND5E MODULE CONTRACT ──────────────────────────────────────
 * Метаданные, точки входа и «не-DH» природа листа, которые проверяет только
 * сама редакция: админский `shortCode`, схема отвергает битый лист, адаптер
 * экспорта не тащит идентичность, дефолты не содержат полей Dark Heresy.
 *
 * Хостовый `tests/unit/game-registry.test.ts` работает по обнаруженным
 * модулям и этих значений не знает: удаление dnd5e не должно ломать хост.
 */

const manifest = rawManifest as unknown as PluginManifest;
const dnd5eModule = dnd5eNamespace.dnd5eModule;
const namespace = dnd5eNamespace as unknown as Record<string, unknown>;

function memberOf(entry: string): string {
  const { member } = parseEntryPoint(entry);
  expect(member, entry).toBeDefined();
  return member!;
}

function withId(gameModule: GameModule<any>, id = 'test-character') {
  return { ...gameModule.createDefaults(), id };
}

describe('dnd5e: модуль плагина', () => {
  it('короткий код редакции для админки — dnd5e', () => {
    expect(dnd5eModule.shortCode).toBe('dnd5e');
  });

  it('точки входа манифеста — реальные экспорты index.ts', () => {
    expect(namespace[memberOf(manifest.entry.module)]).toBe(dnd5eModule);
    expect(namespace[memberOf(manifest.demo.entry)]).toBe(
      dnd5eModule.createDemo,
    );
    expect(namespace[memberOf(manifest.export.json)]).toBe(
      dnd5eModule.export.toPortableJson,
    );
    expect(namespace[memberOf(manifest.export.excel)]).toBe(
      dnd5eModule.export.buildExcelSections,
    );
    for (const migration of manifest.migrations) {
      expect(typeof namespace[memberOf(migration.entry)]).toBe('function');
    }
  });

  it('дефолты dnd5e не содержат полей Dark Heresy', () => {
    const draft = dnd5eModule.createDefaults() as unknown as Record<
      string,
      unknown
    >;
    expect(draft.gameSystem).toBe('Dungeons & Dragons');
    expect('fatigue1st' in draft).toBe(false);
    expect('homeWorld' in draft).toBe(false);
  });

  it('схема отвергает битый лист', () => {
    const { id: _id, ...draft } = withId(dnd5eModule) as Record<
      string,
      unknown
    >;
    const result = dnd5eModule.schema.safeParse({
      ...draft,
      stats: { strength: 10 },
      level: 'не число',
    });
    expect(result.success).toBe(false);
  });

  it('адаптер экспорта убирает непереносимые поля', () => {
    const portable = dnd5eModule.export.toPortableJson(
      {
        ...dnd5eModule.createDefaults(),
        name: 'Export Test',
        id: 'c1',
        userId: 'u1',
        migratedFrom: 'firebase',
        __seq: 3,
      } as never,
      {
        includeBasicInfo: true,
        includeStats: true,
        includeCombat: true,
        includeEquipment: true,
        includeInventory: true,
        includeSpells: true,
        includeNarrative: true,
        includeProgression: true,
        includeCompanions: true,
        includeQuestLog: true,
        includeCustomHouseRules: true,
      },
    );
    // Идентичность добавляет ядро; адаптер отдаёт только поля модуля.
    expect(portable.userId).toBeUndefined();
    expect(portable.migratedFrom).toBeUndefined();
    expect(portable.__seq).toBeUndefined();
    expect(portable.id).toBeUndefined();
    expect(portable.name).toBe('Export Test');
  });
});
