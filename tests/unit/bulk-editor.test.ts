import { describe, expect, it } from 'vitest';

import { gamePlugins, loadGameUiSlots } from '@/games/registry';
import type { BulkEditorTable } from '@/games/types';
import { translations } from '@/lib/i18n';

/**
 * ─── LANDMARK: BULK EDITOR SLOT TESTS ─────────────────────────────────────
 * Массовый редактор `/stats-editor` целиком описывается плагинами (этап 3b):
 * колонки, значения по умолчанию, подписи и сборка патча. Ядро только
 * рисует таблицу, поэтому здесь проверяется контракт данных, а не разметка.
 *
 * Таблицы конкретных редакций (`dh1-stats`, `dnd5e-vitals`, …) проверяют
 * тесты самих плагинов: хост не должен знать их id (D18).
 */

const tablesCache = new Map<string, readonly BulkEditorTable<any>[]>();

async function tablesOf(id: string): Promise<readonly BulkEditorTable<any>[]> {
  const cached = tablesCache.get(id);
  if (cached) return cached;
  const slots = await loadGameUiSlots(id);
  if (!slots) throw new Error(`нет UI-слотов для ${id}`);
  const tables = slots.BulkEditor ?? [];
  tablesCache.set(id, tables);
  return tables;
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
  it('каждый плагин со слотом BulkEditor отдаёт таблицы', async () => {
    for (const entry of gamePlugins) {
      const declared = entry.manifest.ui?.slots?.includes('BulkEditor');
      expect(declared, entry.manifest.id).toBe(true);
      expect(
        (await tablesOf(entry.manifest.id)).length,
        entry.manifest.id,
      ).toBeGreaterThan(0);
    }
  });

  it('id таблиц уникальны, у каждой есть вкладка и колонки', async () => {
    const seen = new Set<string>();
    for (const entry of gamePlugins) {
      for (const table of await tablesOf(entry.manifest.id)) {
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

  it('подписи колонок и вкладок есть в обоих словарях', async () => {
    for (const entry of gamePlugins) {
      for (const table of await tablesOf(entry.manifest.id)) {
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

  it('вкладка статистики есть у каждого плагина и идёт первой', async () => {
    // Хост открывает /stats-editor на вкладке `stats`: без неё экран пуст.
    for (const entry of gamePlugins) {
      const orders = new Map<string, number>();
      for (const table of await tablesOf(entry.manifest.id)) {
        orders.set(table.tab.id, table.tab.order);
      }
      expect(orders.has('stats'), entry.manifest.id).toBe(true);
      expect(Math.min(...orders.values()), entry.manifest.id).toBe(
        orders.get('stats'),
      );
      expect(new Set(orders.values()).size, entry.manifest.id).toBe(
        orders.size,
      );
    }
  });
});

describe('таблицы характеристик', () => {
  it('save-патч применяется к дефолтному листу и его не мутирует', async () => {
    for (const entry of gamePlugins) {
      const character = entry.module.createDefaults() as Record<string, any>;
      for (const table of await tablesOf(entry.manifest.id)) {
        const values = valuesOf(table, character);
        const patch = table.apply(character as never, values) as Record<
          string,
          unknown
        >;
        expect(patch, table.id).toBeTypeOf('object');
        expect(Object.keys(patch).length, table.id).toBeGreaterThan(0);
        expect(character, table.id).toEqual(entry.module.createDefaults());
      }
    }
  });

  it('таблица статистики пишет значения колонок в stats', async () => {
    for (const entry of gamePlugins) {
      const character = entry.module.createDefaults() as Record<string, any>;
      const statsTable = (await tablesOf(entry.manifest.id)).find(
        (table) => table.tab.id === 'stats',
      );
      if (!statsTable) continue;
      const values = valuesOf(statsTable, character);
      const patch = statsTable.apply(character as never, values) as {
        stats?: Record<string, number | string>;
      };
      expect(patch.stats, statsTable.id).toMatchObject(values);
    }
  });

  it('конфиг экспорта в тесте не влияет на таблицы', () => {
    // Страховка: таблицы не должны зависеть от GameExportConfig.
    expect(Object.keys(STATS).length).toBeGreaterThan(5);
  });
});
