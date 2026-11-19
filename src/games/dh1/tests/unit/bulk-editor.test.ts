import { describe, expect, it } from 'vitest';

import { dh1BulkEditor } from '@/games/dh1/bulk-editor';
import type { BulkEditorTable } from '@/games/types';

/**
 * ─── LANDMARK: DH1 BULK EDITOR ────────────────────────────────────────────
 * Таблицы массового редактора 1-й редакции: девять характеристик без
 * influence и свои жизненные показатели. Хост проверяет только общий
 * контракт слота; здесь — значения и патчи самой редакции.
 */

function tableOf(tableId: string): BulkEditorTable<any> {
  const table = dh1BulkEditor.find((item) => item.id === tableId);
  if (!table) throw new Error(`нет таблицы ${tableId} у dh1`);
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
  it('dh1: девять колонок без influence, пустые статы → 30', () => {
    const table = tableOf('dh1-stats');
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

  it('dh1: патч характеристик не добавляет influence', () => {
    const table = tableOf('dh1-stats');
    const patch = table.apply({ stats: {} } as never, {
      strength: 40,
    }) as { stats: Record<string, number> };
    expect(patch.stats.strength).toBe(40);
    expect('influence' in patch.stats).toBe(false);
  });
});

describe('таблицы жизненных показателей', () => {
  it('dh1: текущие значения и патч по полям редакции', () => {
    const table = tableOf('dh1-vitals');
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

  it('dh1: таблицы и вкладки редакции', () => {
    expect(dh1BulkEditor.map((table) => table.id)).toEqual([
      'dh1-stats',
      'dh1-vitals',
    ]);
    expect(dh1BulkEditor.map((table) => table.tab.id)).toEqual([
      'stats',
      'dh-vitals',
    ]);
    expect(dh1BulkEditor.map((table) => table.tab.order)).toEqual([10, 20]);
  });
});
