import { describe, expect, it } from 'vitest';

import type { BulkEditorColumn, BulkEditorTable } from '@/games/types';
import { normalizeBulkValues } from '@/lib/bulk-editor-values';

function column(overrides: Partial<BulkEditorColumn<any>> = {}) {
  return {
    key: 'value',
    labelKey: 'test.value',
    type: 'number',
    min: 0,
    max: 100,
    value: () => 0,
    ...overrides,
  } as BulkEditorColumn<any>;
}

function table(columns: BulkEditorColumn<any>[]): BulkEditorTable<any> {
  return {
    id: 'test',
    titleKey: 'test.title',
    descriptionKey: 'test.desc',
    tab: {
      id: 'stats',
      labelKey: 'test.tab',
      order: 1,
      saveAllLabelKey: 'test.saveAll',
      saveAllDoneKey: 'test.saved',
    },
    columns,
    apply: () => ({}),
  } as unknown as BulkEditorTable<any>;
}

function normalize(
  raw: string | number,
  overrides: Partial<BulkEditorColumn<any>> = {},
) {
  return normalizeBulkValues(table([column(overrides)]), { value: raw }).value;
}

describe('normalizeBulkValue', () => {
  it('ограничивает число снизу и сверху', () => {
    expect(normalize('-10')).toBe(0);
    expect(normalize('150')).toBe(100);
    expect(normalize('7', { min: 5, max: 10 })).toBe(7);
  });

  it('битое/пустое число не превращается в NaN', () => {
    expect(normalize('')).toBe(0);
    expect(normalize('abc', { min: 3 })).toBe(3);
  });

  it('текст не приводит к числу', () => {
    expect(
      normalize('  Sword ', { type: 'text', min: undefined, max: undefined }),
    ).toBe('  Sword ');
  });

  it('нормализует всю строку таблицы', () => {
    const t = table([column(), column({ key: 'name', type: 'text' })]);
    expect(normalizeBulkValues(t, { value: 999, name: 'A' })).toEqual({
      value: 100,
      name: 'A',
    });
  });
});
