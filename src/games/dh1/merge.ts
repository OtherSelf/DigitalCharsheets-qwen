import {
  copyDefinedFields,
  mergeCommonSections,
  NARRATIVE_FIELDS,
  type MergeSource,
  type MergeTarget,
} from '../shared/merge';
import type { GameExportConfig } from '../types';
import type { DH1Character } from './types';

/**
 * ─── LANDMARK: DH1 MERGE ───────────────────────────────────────────────────
 * Слияние импортированных данных в лист Dark Heresy 1-й редакции. Раньше это
 * была ветка `!isDnd` в ядре с проверками `isDh1/isDh2`; теперь dh1 знает
 * свои поля сам (этап 2, D10). Усталость — только `fatigue1st`, влияния нет.
 */

const BASIC_FIELDS = [
  'name',
  'characterClass',
  'homeWorld',
  'worldVariant',
  'careerPath',
  'rank',
  'divination',
  'divinationEffect',
  'quirk',
  'height',
  'weight',
  'age',
  'skinColor',
  'hairColor',
  'eyeColor',
] as const;

const COMBAT_FIELDS = [
  'wounds',
  'fatePoints',
  'insanityPoints',
  'corruptionPoints',
  'movement',
  'criticalConditions',
  'customResources',
  'skills',
  'talents',
] as const;

const PROGRESSION_FIELDS = [
  'experience',
  'totalExpSpent',
  'alternatePath',
  'advancedPath',
] as const;

export function mergeDh1Data(
  target: DH1Character,
  source: Readonly<Record<string, unknown>>,
  config: GameExportConfig,
): DH1Character {
  const merged = { ...(target as unknown as MergeTarget) };
  const src = source as MergeSource;

  if (config.includeBasicInfo) {
    copyDefinedFields(merged, src, BASIC_FIELDS);
  }

  if (config.includeStats) {
    if (src.stats && typeof src.stats === 'object') {
      const stats = { ...(src.stats as Record<string, unknown>) };
      // Чужать редакции не протекают: в dh1 нет influence.
      delete stats.influence;
      merged.stats = {
        ...(merged.stats as Record<string, unknown> | undefined),
        ...stats,
      };
    }
    if (src.statNotes) merged.statNotes = src.statNotes;
    if (src.statUpgrades) merged.statUpgrades = src.statUpgrades;
  }

  if (config.includeCombat) {
    for (const key of COMBAT_FIELDS) {
      const value = src[key];
      if (value === undefined) continue;
      merged[key] =
        value && typeof value === 'object' && !Array.isArray(value)
          ? {
              ...((merged[key] as Record<string, unknown> | undefined) ?? {}),
              ...(value as Record<string, unknown>),
            }
          : value;
    }
    // Усталость — только существующее у редакции поле.
    if (src.fatigue1st && merged.fatigue1st !== undefined) {
      merged.fatigue1st = {
        ...(merged.fatigue1st as Record<string, unknown>),
        ...(src.fatigue1st as Record<string, unknown>),
      };
    }
  }

  if (config.includeInventory) {
    if (src.inventory) merged.inventory = src.inventory;
    if (src.wealth) {
      merged.wealth = {
        ...(merged.wealth as Record<string, unknown> | undefined),
        ...(src.wealth as Record<string, unknown>),
      };
    }
  }

  if (config.includeNarrative) {
    copyDefinedFields(merged, src, NARRATIVE_FIELDS);
  }

  if (config.includeProgression) {
    copyDefinedFields(merged, src, PROGRESSION_FIELDS);
  }

  mergeCommonSections(
    merged,
    src,
    config as unknown as Record<string, boolean>,
  );

  return merged as unknown as DH1Character;
}
