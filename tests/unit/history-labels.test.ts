import { describe, expect, it } from 'vitest';

import { listGameModules } from '@/games/registry';
import {
  formatHistoryDate,
  formatHistoryValue,
  humanizeHistoryPath,
  resolveHistoryLabel,
} from '@/lib/history-labels';
import type { HistoryChange } from '@/lib/history-types';
import { translations } from '@/lib/i18n';

function t(key: string): string {
  return key;
}

describe('history labels', () => {
  it('все ключи подписей плагинов есть в en и ru', () => {
    for (const gameModule of listGameModules()) {
      const config = gameModule.history;
      if (!config) continue;
      const keys = [
        ...Object.values(config.labels ?? {}),
        ...Object.values(config.collections ?? {}),
      ];
      for (const key of keys) {
        expect(
          translations.en[key],
          `${gameModule.id}: en ${key}`,
        ).toBeTruthy();
        expect(
          translations.ru[key],
          `${gameModule.id}: ru ${key}`,
        ).toBeTruthy();
      }
    }
  });

  it('точная карта плагина важнее человекочитаемого пути', () => {
    const change: HistoryChange = {
      kind: 'changed',
      path: 'stats.strength',
      before: { value: 10 },
      after: { value: 12 },
    };

    expect(
      resolveHistoryLabel(
        change,
        {
          labels: { 'stats.strength': 'common.statStrAbbr' },
        },
        t,
      ),
    ).toBe('common.statStrAbbr');
  });

  it('для keyed-элемента собирает коллекцию, подпись и поле', () => {
    const change: HistoryChange = {
      kind: 'changed',
      path: 'inventory',
      key: 'i1',
      label: 'Sword',
      field: 'notes',
      before: { value: '' },
      after: { value: 'sharp' },
    };

    expect(
      resolveHistoryLabel(
        change,
        {
          collections: { inventory: 'common.inventory' },
          labels: { 'inventory.notes': 'common.notes' },
        },
        t,
      ),
    ).toBe('common.inventory · Sword · common.notes');
  });

  it('падает в человекочитаемый путь без подписей', () => {
    const change: HistoryChange = {
      kind: 'changed',
      path: 'hitPoints.current',
      before: { value: 1 },
      after: { value: 2 },
    };

    expect(resolveHistoryLabel(change, undefined, t)).toBe(
      'hit points · current',
    );
    expect(humanizeHistoryPath('some_custom_field.deepValue')).toBe(
      'some custom field · deep value',
    );
  });

  it('сводный bulk и значения форматируются предсказуемо', () => {
    expect(
      resolveHistoryLabel({ kind: 'bulk', path: '', count: 10 }, undefined, t),
    ).toBe('history.tooManyChanges');

    expect(formatHistoryValue({ value: 'note' })).toBe('note');
    expect(
      formatHistoryValue({
        truncated: true,
        preview: 'long…',
        length: 1000,
      }),
    ).toBe('long…');
    expect(formatHistoryValue({ value: 42 })).toBe('42');
    expect(formatHistoryValue({ value: null })).toBe('null');
  });

  it('форматирует дату без падения на мусоре', () => {
    expect(formatHistoryDate('2026-05-12T18:04:11.000Z', 'en')).toContain(
      '2026',
    );
    expect(formatHistoryDate('not-a-date', 'ru')).toBe('not-a-date');
  });
});
