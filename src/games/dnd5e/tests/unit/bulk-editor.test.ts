import { describe, expect, it } from 'vitest';

import { dnd5eBulkEditor } from '@/games/dnd5e/bulk-editor';
import type { BulkEditorTable } from '@/games/types';

/**
 * ─── LANDMARK: DND5E BULK EDITOR ──────────────────────────────────────────
 * Таблицы массового редактора D&D 5e: шесть характеристик и жизненные
 * показатели (уровень, HP/AC, бонус мастерства, скорость, опыт). Хост
 * проверяет только общий контракт слота; здесь — значения и патчи самой
 * редакции (D18).
 */

function tableOf(tableId: string): BulkEditorTable<any> {
  const table = dnd5eBulkEditor.find((item) => item.id === tableId);
  if (!table) throw new Error(`нет таблицы ${tableId} у dnd5e`);
  return table;
}

function valuesOf(table: BulkEditorTable<any>, character: unknown) {
  const values: Record<string, number | string> = {};
  for (const column of table.columns) {
    values[column.key] = column.value(character as never);
  }
  return values;
}

describe('таблицы характеристик', () => {
  it('dnd5e: шесть колонок, пустые статы → 10, патч мержится', () => {
    const table = tableOf('dnd5e-stats');
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
  it('dnd5e: уровень/HP/AC/бонус/скорость/опыт, опыт пишется в оба поля', () => {
    const table = tableOf('dnd5e-vitals');
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
    const table = tableOf('dnd5e-vitals');
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

  it('dnd5e: таблицы и вкладки редакции', () => {
    expect(dnd5eBulkEditor.map((table) => table.id)).toEqual([
      'dnd5e-stats',
      'dnd5e-vitals',
    ]);
    expect(dnd5eBulkEditor.map((table) => table.tab.id)).toEqual([
      'stats',
      'dnd-vitals',
    ]);
    expect(dnd5eBulkEditor.map((table) => table.tab.order)).toEqual([10, 30]);
  });
});
