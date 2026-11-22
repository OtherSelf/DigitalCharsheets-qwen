import { describe, expect, it } from 'vitest';

import type { BulkEditorColumn, BulkEditorTable } from '@/games/types';
import {
  normalizeBulkValue,
  normalizeBulkValues,
} from '@/lib/bulk-editor-values';

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

describe('normalizeBulkValue', () => {
  it('ограничивает число снизу и сверху', () => {
    expect(normalizeBulkValue(column(), '-10')).toBe(0);
    expect(normalizeBulkValue(column(), '150')).toBe(100);
    expect(normalizeBulkValue(column({ min: 5, max: 10 }), '7')).toBe(7);
  });

  it('битое/пустое число не превращается в NaN', () => {
    expect(normalizeBulkValue(column(), '')).toBe(0);
    expect(normalizeBulkValue(column({ min: 3 }), 'abc')).toBe(3);
  });

  it('текст не приводит к числу', () => {
    const text = column({ type: 'text', min: undefined, max: undefined });
    expect(normalizeBulkValue(text, '  Sword ')).toBe('  Sword ');
  });

  it('нормализует всю строку таблицы', () => {
    const t = table([column(), column({ key: 'name', type: 'text' })]);
    expect(normalizeBulkValues(t, { value: 999, name: 'A' })).toEqual({
      value: 100,
      name: 'A',
    });
  });
});
