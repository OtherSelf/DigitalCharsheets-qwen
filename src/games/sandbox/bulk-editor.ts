import type { BulkEditorTable } from '@/games/types';

import { SANDBOX_STATS, type SandboxCharacter } from './types';

/**
 * ─── LANDMARK: EXAMPLE BULK EDITOR ─────────────────────────────────────────
 * Таблица массового редактора `/stats-editor` для песочницы: две
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

export const sandboxBulkEditor: readonly BulkEditorTable<SandboxCharacter>[] = [
  {
    id: 'sandbox-stats',
    order: 900,
    tab: STATS_TAB,
    titleKey: 'sandbox.bulkStats',
    descriptionKey: 'sandbox.bulkStatsDesc',
    minWidth: 320,
    gap: 1,
    saveOneKey: 'common.savedStatsFor',
    columns: SANDBOX_STATS.map((stat) => ({
      key: stat,
      labelKey: `sandbox.stat.${stat}`,
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
