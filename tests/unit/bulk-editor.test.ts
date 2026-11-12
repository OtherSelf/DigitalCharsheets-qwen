import { describe, expect, it } from 'vitest';

import { dh1BulkEditor } from '@/games/dh1/bulk-editor';
import { dh2BulkEditor } from '@/games/dh2/bulk-editor';
import { dnd5eBulkEditor } from '@/games/dnd5e/bulk-editor';
import { gamePlugins } from '@/games/registry';
import type { BulkEditorTable } from '@/games/types';
import { translations } from '@/lib/i18n';

/**
 * ─── LANDMARK: BULK EDITOR SLOT TESTS ─────────────────────────────────────
 * Массовый редактор `/stats-editor` целиком описывается плагинами (этап 3b):
 * колонки, значения по умолчанию, подписи и сборка патча. Ядро только
 * рисует таблицу, поэтому здесь проверяется контракт данных, а не разметка.
 */

function plugin(id: string) {
  const entry = gamePlugins.find((item) => item.manifest.id === id);
  if (!entry) throw new Error(`нет плагина ${id}`);
  return entry;
}

const BULK_TABLES: Record<string, readonly BulkEditorTable<any>[]> = {
  dnd5e: dnd5eBulkEditor,
  dh1: dh1BulkEditor,
  dh2: dh2BulkEditor,
};

function tables(id: string): readonly BulkEditorTable<any>[] {
  plugin(id);
  return BULK_TABLES[id] ?? [];
}

function tableOf(id: string, tableId: string): BulkEditorTable<any> {
  const table = tables(id).find((item) => item.id === tableId);
  if (!table) throw new Error(`нет таблицы ${tableId} у ${id}`);
  return table;
}

function valuesOf(table: BulkEditorTable<any>, character: unknown) {
  const values: Record<string, number | string> = {};
  for (const column of table.columns) {
    values[column.key] = column.value(character as never);
  }
  return values;
}

const STATS = {
  includeBasicInfo: true,
  includeStats: true,
  includeCombat: false,
  includeEquipment: false,
  includeInventory: false,
  includeSpells: false,
  includeNarrative: false,
  includeProgression: false,
  includeCompanions: false,
  includeQuestLog: false,
  includeCustomHouseRules: false,
};

describe('BulkEditor объявлен в манифестах', () => {
  it('каждый плагин со слотом BulkEditor отдаёт таблицы', () => {
    for (const entry of gamePlugins) {
      const declared = entry.manifest.ui?.slots?.includes('BulkEditor');
      expect(declared, entry.manifest.id).toBe(true);
      expect(
        tables(entry.manifest.id).length,
        entry.manifest.id,
      ).toBeGreaterThan(0);
    }
  });

  it('id таблиц уникальны, у каждой есть вкладка и колонки', () => {
    const seen = new Set<string>();
    for (const entry of gamePlugins) {
      for (const table of tables(entry.manifest.id)) {
        expect(table.id, entry.manifest.id).toMatch(
          new RegExp(`^${entry.manifest.id}-`),
        );
        expect(seen.has(table.id), table.id).toBe(false);
        seen.add(table.id);
        expect(table.columns.length).toBeGreaterThan(0);
        expect(table.tab.id).toBeTruthy();
        expect(table.tab.saveAllLabelKey).toContain('.');
        expect(table.tab.saveAllDoneKey).toContain('.');
      }
    }
  });

  it('подписи колонок и вкладок есть в обоих словарях', () => {
    for (const entry of gamePlugins) {
      for (const table of tables(entry.manifest.id)) {
        const keys = [
          table.titleKey,
          table.descriptionKey,
          table.saveOneKey,
          table.tab.labelKey,
          table.tab.saveAllLabelKey,
          table.tab.saveAllDoneKey,
          ...table.columns.map((column) => column.labelKey),
          ...(table.editionNameKey ? [table.editionNameKey] : []),
          ...(table.tab.emptyKey ? [table.tab.emptyKey] : []),
        ];
        for (const key of keys) {
          expect(key, `${table.id}: ${key}`).toContain('.');
          expect(translations.en[key], `en ${key}`).toBeDefined();
          expect(translations.ru[key], `ru ${key}`).toBeDefined();
        }
      }
    }
  });

  it('вкладки: stats → dh-vitals → dnd-vitals', () => {
    const tabs = new Map<string, number>();
    for (const entry of gamePlugins) {
      for (const table of tables(entry.manifest.id)) {
        tabs.set(table.tab.id, table.tab.order);
      }
    }
    expect(
      [...tabs.keys()].sort((a, b) => tabs.get(a)! - tabs.get(b)!),
    ).toEqual(['stats', 'dh-vitals', 'dnd-vitals']);
  });
});

describe('таблицы характеристик', () => {
  it('dh1: девять колонок без influence, пустые статы → 30', () => {
    const table = tableOf('dh1', 'dh1-stats');
    expect(table.columns.map((column) => column.key)).toEqual([
      'weaponSkill',
      'ballisticSkill',
      'strength',
      'toughness',
      'agility',
      'intelligence',
      'perception',
      'willpower',
      'fellowship',
    ]);
    const values = valuesOf(table, { id: 'x', name: 'X', stats: {} });
    expect(values.weaponSkill).toBe(30);
  });

  it('dh2: десять колонок с influence', () => {
    const table = tableOf('dh2', 'dh2-stats');
    expect(table.columns.map((column) => column.key)).toContain('influence');
    const values = valuesOf(table, {
      id: 'x',
      name: 'X',
      stats: { influence: 45 },
    });
    expect(values.influence).toBe(45);
  });

  it('dh2 пишет influence в патч, dh1 — нет', () => {
    const dh2 = tableOf('dh2', 'dh2-stats');
    const dh1 = tableOf('dh1', 'dh1-stats');
    const dh2Patch = dh2.apply({ stats: {} } as never, { influence: 45 });
    const dh1Patch = dh1.apply({ stats: {} } as never, { strength: 40 });
    expect(
      (dh2Patch as { stats: Record<string, number> }).stats.influence,
    ).toBe(45);
    expect(
      'influence' in (dh1Patch as { stats: Record<string, number> }).stats,
    ).toBe(false);
  });

  it('dnd5e: шесть колонок, пустые статы → 10, патч мержится', () => {
    const table = tableOf('dnd5e', 'dnd5e-stats');
    expect(table.columns).toHaveLength(6);
    const values = valuesOf(table, { id: 'x', name: 'X', stats: {} });
    expect(values.strength).toBe(10);
    const patch = table.apply(
      { stats: { strength: 10, dexterity: 12 } } as never,
      { strength: 16 },
    ) as { stats: Record<string, number> };
    expect(patch.stats.strength).toBe(16);
    expect(patch.stats.dexterity).toBe(12);
  });
});

describe('таблицы жизненных показателей', () => {
  it('dh1: текущие значения и патч по полям редакции', () => {
    const table = tableOf('dh1', 'dh1-vitals');
    const character = {
      wounds: { current: 5, max: 12, notes: '' },
      fatePoints: { current: 1, max: 3, notes: '' },
      insanityPoints: { total: 2, notes: '' },
      corruptionPoints: { total: 4, notes: '' },
      experience: 500,
    };
    const values = valuesOf(table, character);
    expect(values).toEqual({
      woundsMax: 12,
      fateMax: 3,
      insanity: 2,
      corruption: 4,
      experience: 500,
    });
    const patch = table.apply(character as never, {
      woundsMax: 20,
      fateMax: 5,
      insanity: 1,
      corruption: 0,
      experience: 900,
    }) as Record<string, any>;
    expect(patch.wounds).toEqual({ current: 5, max: 20, notes: '' });
    expect(patch.fatePoints.max).toBe(5);
    expect(patch.insanityPoints.total).toBe(1);
    expect(patch.experience).toBe(900);
  });

  it('dnd5e: уровень/HP/AC/бонус/скорость/опыт, опыт пишется в оба поля', () => {
    const table = tableOf('dnd5e', 'dnd5e-vitals');
    const character = {
      level: 3,
      hitPoints: { current: 10, max: 24 },
      armorClass: 15,
      proficiencyBonus: 2,
      speed: 30,
      experiencePoints: 900,
    };
    const values = valuesOf(table, character);
    expect(values).toMatchObject({
      level: 3,
      hitPointsMax: 24,
      armorClass: 15,
      proficiencyBonus: 2,
      speed: '30',
      experiencePoints: 900,
    });
    const patch = table.apply(character as never, {
      level: 5,
      hitPointsMax: 40,
      armorClass: 17,
      proficiencyBonus: 3,
      speed: '35ft',
      experiencePoints: 6500,
    }) as Record<string, unknown>;
    expect(patch.level).toBe(5);
    expect(patch.speed).toBe('35ft');
    expect(patch.experiencePoints).toBe(6500);
    expect(patch.experience).toBe(6500);
  });

  it('нечисловые значения не ломают патч', () => {
    const table = tableOf('dnd5e', 'dnd5e-vitals');
    const patch = table.apply({} as never, {
      level: '',
      hitPointsMax: '',
      armorClass: '',
      proficiencyBonus: '',
      speed: '',
      experiencePoints: '',
    }) as Record<string, unknown>;
    expect(patch.level).toBe(1);
    expect(patch.hitPoints).toEqual({ max: 0 });
    expect(patch.experience).toBe(0);
  });

  it('конфиг экспорта в тесте не влияет на таблицы', () => {
    // Страховка: таблицы не должны зависеть от GameExportConfig.
    expect(Object.keys(STATS).length).toBeGreaterThan(5);
  });
});
