import type { BulkEditorTab, BulkEditorTable } from '@/games/types';

import type { DH2Character } from './types';

/**
 * ─── LANDMARK: DH2 BULK EDITOR ─────────────────────────────────────────────
 * Таблицы массового редактора `/stats-editor` для 2-й редакции: девять
 * характеристик и influence, а также жизненные показатели. Раньше это знала
 * страница ядра с `DH_STATS`/`statLabel` и ветками по `gameSystem`; теперь —
 * данные плагина (этап 3b, слот `BulkEditor`).
 */

const STAT_COLUMNS = [
  { key: 'weaponSkill', labelKey: 'dh2.weaponSkill' },
  { key: 'ballisticSkill', labelKey: 'dh2.ballisticSkill' },
  { key: 'strength', labelKey: 'common.strength' },
  { key: 'toughness', labelKey: 'dh2.toughness' },
  { key: 'agility', labelKey: 'dh2.agility' },
  { key: 'intelligence', labelKey: 'common.intelligence' },
  { key: 'perception', labelKey: 'common.perception' },
  { key: 'willpower', labelKey: 'common.willpower' },
  { key: 'fellowship', labelKey: 'dh2.fellowship' },
  { key: 'influence', labelKey: 'dh2.influence' },
] as const;

const STATS_TAB: BulkEditorTab = {
  id: 'stats',
  labelKey: 'common.statsTab',
  order: 10,
  saveAllLabelKey: 'common.saveAllStats',
  saveAllDoneKey: 'common.allStatsSaved',
};

const VITALS_TAB: BulkEditorTab = {
  id: 'dh-vitals',
  labelKey: 'common.dhVitals',
  order: 20,
  showCount: true,
  saveAllLabelKey: 'common.saveAllDhVitals',
  saveAllDoneKey: 'common.allDhVitalsSaved',
  emptyKey: 'common.noDhCharacters',
};

export const dh2BulkEditor: readonly BulkEditorTable<DH2Character>[] = [
  {
    id: 'dh2-stats',
    order: 10,
    tab: STATS_TAB,
    titleKey: 'common.dhStats',
    descriptionKey: 'common.dhStatsDesc',
    editionNameKey: 'games.dh2.name',
    minWidth: 900,
    gap: 1,
    saveOneKey: 'common.savedStatsFor',
    columns: STAT_COLUMNS.map((stat) => ({
      key: stat.key,
      labelKey: stat.labelKey,
      type: 'number' as const,
      min: 0,
      max: 100,
      value: (character) =>
        Number(
          (character.stats as Record<string, number> | undefined)?.[stat.key] ??
            0,
        ) || 30,
    })),
    apply: (_character, values) => ({
      stats: values as DH2Character['stats'],
    }),
  },
  {
    id: 'dh2-vitals',
    order: 10,
    tab: VITALS_TAB,
    titleKey: 'common.dhVitals',
    descriptionKey: 'common.dhVitalsDesc',
    minWidth: 800,
    gap: 2,
    saveOneKey: 'common.savedVitalsFor',
    columns: [
      {
        key: 'woundsMax',
        labelKey: 'common.woundsMax',
        min: 0,
        value: (character) => character.wounds?.max ?? 0,
      },
      {
        key: 'fateMax',
        labelKey: 'common.fateMax',
        min: 0,
        value: (character) => character.fatePoints?.max ?? 0,
      },
      {
        key: 'insanity',
        labelKey: 'dh2.insanity',
        min: 0,
        value: (character) => character.insanityPoints?.total ?? 0,
      },
      {
        key: 'corruption',
        labelKey: 'dh2.corruption',
        min: 0,
        value: (character) => character.corruptionPoints?.total ?? 0,
      },
      {
        key: 'experience',
        labelKey: 'dh2.experience',
        min: 0,
        value: (character) => character.experience ?? 0,
      },
    ],
    apply: (character, values) => ({
      wounds: { ...character.wounds, max: Number(values.woundsMax) || 0 },
      fatePoints: { ...character.fatePoints, max: Number(values.fateMax) || 0 },
      insanityPoints: {
        ...character.insanityPoints,
        total: Number(values.insanity) || 0,
      },
      corruptionPoints: {
        ...character.corruptionPoints,
        total: Number(values.corruption) || 0,
      },
      experience: Number(values.experience) || 0,
    }),
  },
];
