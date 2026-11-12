import type { BulkEditorTable } from '@/games/types';

import type { DnD5eCharacter } from './types';

/** Legacy-зеркало опыта: страница ядра писала и `experience`, и `experiencePoints`. */
type DnD5eCharacterWithLegacy = DnD5eCharacter & { experience?: number };

/**
 * ─── LANDMARK: DND5E BULK EDITOR ───────────────────────────────────────────
 * Таблицы массового редактора `/stats-editor` для D&D 5e: характеристики
 * (6 значений) и жизненные показатели. Раньше это знала страница ядра с
 * ветками `gameSystem === 'Dungeons & Dragons'`; теперь — данные плагина
 * (этап 3b, слот `BulkEditor`).
 */

const DND_STATS = [
  { key: 'strength', labelKey: 'common.statStrAbbr' },
  { key: 'dexterity', labelKey: 'common.statDexAbbr' },
  { key: 'constitution', labelKey: 'common.statConAbbr' },
  { key: 'intelligence', labelKey: 'common.statIntAbbr' },
  { key: 'wisdom', labelKey: 'common.statWisAbbr' },
  { key: 'charisma', labelKey: 'common.statChaAbbr' },
] as const;

const STATS_TAB = {
  id: 'stats',
  labelKey: 'common.statsTab',
  order: 10,
  saveAllLabelKey: 'common.saveAllStats',
  saveAllDoneKey: 'common.allStatsSaved',
} as const;

export const dnd5eBulkEditor: readonly BulkEditorTable<DnD5eCharacter>[] = [
  {
    id: 'dnd5e-stats',
    order: 30,
    tab: STATS_TAB,
    titleKey: 'dnd5e.bulkStats',
    descriptionKey: 'dnd5e.bulkStatsDesc',
    minWidth: 700,
    gap: 1,
    saveOneKey: 'common.savedStatsFor',
    columns: DND_STATS.map((stat) => ({
      key: stat.key,
      labelKey: stat.labelKey,
      type: 'number' as const,
      min: 0,
      max: 30,
      value: (character) => Number(character.stats?.[stat.key] ?? 0) || 10,
    })),
    apply: (character, values) => ({
      stats: {
        ...character.stats,
        ...(values as Record<string, number>),
      },
    }),
  },
  {
    id: 'dnd5e-vitals',
    order: 30,
    tab: {
      id: 'dnd-vitals',
      labelKey: 'dnd5e.bulkVitals',
      order: 30,
      showCount: true,
      saveAllLabelKey: 'dnd5e.bulkSaveVitals',
      saveAllDoneKey: 'dnd5e.bulkVitalsSaved',
      emptyKey: 'dnd5e.bulkNoCharacters',
    },
    titleKey: 'dnd5e.bulkVitals',
    descriptionKey: 'dnd5e.bulkVitalsDesc',
    minWidth: 850,
    gap: 2,
    gridTemplate: '180px 70px 90px 70px 70px 100px 110px 60px',
    saveOneKey: 'common.savedVitalsFor',
    columns: [
      {
        key: 'level',
        labelKey: 'dnd.level',
        min: 1,
        max: 20,
        value: (character) => character.level ?? 1,
      },
      {
        key: 'hitPointsMax',
        labelKey: 'common.hpMax',
        min: 0,
        value: (character) => character.hitPoints?.max ?? 0,
      },
      {
        key: 'armorClass',
        labelKey: 'dnd.armorClass',
        min: 0,
        value: (character) => character.armorClass ?? 10,
      },
      {
        key: 'proficiencyBonus',
        labelKey: 'common.profShort',
        min: 0,
        value: (character) => character.proficiencyBonus ?? 2,
      },
      {
        key: 'speed',
        labelKey: 'dnd.speed',
        type: 'text',
        value: (character) => String(character.speed ?? '30ft'),
      },
      {
        key: 'experiencePoints',
        labelKey: 'dh1.experience',
        min: 0,
        value: (character) => {
          const legacy = character as DnD5eCharacterWithLegacy;
          return legacy.experiencePoints ?? legacy.experience ?? 0;
        },
      },
    ],
    apply: (character, values) => {
      const experiencePoints = Number(values.experiencePoints) || 0;
      // Скорость исторически хранится строкой («30ft»), а в типе — число:
      // сохраняем прежнее поведение массового редактора.
      const patch: Record<string, unknown> = {
        level: Number(values.level) || 1,
        hitPoints: {
          ...character.hitPoints,
          max: Number(values.hitPointsMax) || 0,
        },
        armorClass: Number(values.armorClass) || 0,
        proficiencyBonus: Number(values.proficiencyBonus) || 0,
        speed: String(values.speed ?? ''),
        experiencePoints,
        experience: experiencePoints,
      };
      return patch as Partial<DnD5eCharacter>;
    },
  },
];
