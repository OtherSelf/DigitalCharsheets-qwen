import { describe, expect, it } from 'vitest';

import { dh2BulkEditor } from '@/games/dh2/bulk-editor';
import type { BulkEditorTable } from '@/games/types';

/**
 * ─── LANDMARK: DH2 BULK EDITOR ────────────────────────────────────────────
 * Таблицы массового редактора 2-й редакции: десять характеристик вместе с
 * influence, пси-рейтинг в жизненных показателях. Хост проверяет только
 * общий контракт слота; здесь — значения и патчи самой редакции (D18).
 */

function tableOf(tableId: string): BulkEditorTable<any> {
  const table = dh2BulkEditor.find((item) => item.id === tableId);
  if (!table) throw new Error(`нет таблицы ${tableId} у dh2`);
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
  it('dh2: десять колонок с influence', () => {
    const table = tableOf('dh2-stats');
    expect(table.columns).toHaveLength(10);
    expect(table.columns.map((column) => column.key)).toContain('influence');
    const values = valuesOf(table, {
      id: 'x',
      name: 'X',
      stats: { influence: 45 },
    });
    expect(values.influence).toBe(45);
  });

  it('dh2: патч пишет influence', () => {
    const table = tableOf('dh2-stats');
    const patch = table.apply({ stats: {} } as never, {
      influence: 45,
    }) as { stats: Record<string, number> };
    expect(patch.stats.influence).toBe(45);
  });
});

describe('таблицы жизненных показателей', () => {
  it('dh2: psy rating в колонках и патче, элитные/аптитюды — не bulk', () => {
    const table = tableOf('dh2-vitals');
    expect(table.columns.map((column) => column.key)).toContain('psyRating');
    const character = {
      wounds: { current: 5, max: 12, notes: '' },
      fatePoints: { current: 1, max: 3, notes: '' },
      insanityPoints: { total: 2, notes: '' },
      corruptionPoints: { total: 0, notes: '' },
      psy: { rating: 2, disciplines: ['Telepathy'], powers: [] },
      experience: 500,
    };
    const values = valuesOf(table, character);
    expect(values.psyRating).toBe(2);
    const patch = table.apply(character as never, {
      woundsMax: 20,
      fateMax: 5,
      insanity: 1,
      corruption: 0,
      psyRating: 3,
      experience: 900,
    }) as Record<string, any>;
    expect(patch.psy).toEqual({
      rating: 3,
      disciplines: ['Telepathy'],
      powers: [],
    });
    expect(patch.wounds.max).toBe(20);
    expect(patch.experience).toBe(900);
  });

  it('dh2: таблицы и вкладки редакции', () => {
    expect(dh2BulkEditor.map((table) => table.id)).toEqual([
      'dh2-stats',
      'dh2-vitals',
    ]);
    expect(dh2BulkEditor.map((table) => table.tab.id)).toEqual([
      'stats',
      'dh-vitals',
    ]);
    expect(dh2BulkEditor.map((table) => table.tab.order)).toEqual([10, 20]);
  });
});
