import type { BulkEditorTable } from '@/games/types';

import { EXAMPLE_STATS, type ExampleCharacter } from './types';

/**
 * ─── LANDMARK: EXAMPLE BULK EDITOR ─────────────────────────────────────────
 * Таблица массового редактора `/stats-editor` для фикстуры: две
 * характеристики на общей вкладке `stats`. Слот `BulkEditor` обязателен у
 * каждого плагина (SDK v1): без него вкладка характеристик остаётся пустой, а
 * ядро снова начало бы знать игры по именам.
 *
 * Одна вкладка `stats` и ни одной вкладки жизненных показателей — минимум,
 * который проходит контракт хоста.
 */

const STATS_TAB = {
  id: 'stats',
  labelKey: 'common.statsTab',
  order: 10,
  saveAllLabelKey: 'common.saveAllStats',
  saveAllDoneKey: 'common.allStatsSaved',
} as const;

export const exampleBulkEditor: readonly BulkEditorTable<ExampleCharacter>[] = [
  {
    id: 'example-stats',
    order: 90,
    tab: STATS_TAB,
    titleKey: 'example.bulkStats',
    descriptionKey: 'example.bulkStatsDesc',
    minWidth: 320,
    gap: 1,
    saveOneKey: 'common.savedStatsFor',
    columns: EXAMPLE_STATS.map((stat) => ({
      key: stat,
      labelKey: `example.stat.${stat}`,
      type: 'number' as const,
      min: 1,
      max: 99,
      value: (character) => Number(character.stats?.[stat] ?? 0) || 10,
    })),
    apply: (character, values) => ({
      stats: {
        ...character.stats,
        ...(values as Record<string, number>),
      },
    }),
  },
];
