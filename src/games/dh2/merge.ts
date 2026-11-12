import {
  copyDefinedFields,
  mergeCommonSections,
  NARRATIVE_FIELDS,
  type MergeSource,
  type MergeTarget,
} from '../shared/merge';
import type { GameExportConfig } from '../types';
import type { DH2Character } from './types';

/**
 * ─── LANDMARK: DH2 MERGE ───────────────────────────────────────────────────
 * Слияние импортированных данных в лист Dark Heresy 2-й редакции. Раньше это
 * была ветка `!isDnd` в ядре с проверками `isDh1/isDh2`; теперь dh2 знает
 * свои поля сам (этап 2, D10). Усталость — только `fatigue2nd`, влияние есть.
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

export function mergeDh2Data(
  target: DH2Character,
  source: Readonly<Record<string, unknown>>,
  config: GameExportConfig,
): DH2Character {
  const merged = { ...(target as unknown as MergeTarget) };
  const src = source as MergeSource;

  if (config.includeBasicInfo) {
    copyDefinedFields(merged, src, BASIC_FIELDS);
  }

  if (config.includeStats) {
    if (src.stats && typeof src.stats === 'object') {
      const stats = { ...(src.stats as Record<string, unknown>) };
      // Чужие редакции не протекают: в dh2 влияние есть всегда.
      stats.influence = stats.influence ?? 30;
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
    if (src.fatigue2nd && merged.fatigue2nd !== undefined) {
      merged.fatigue2nd = {
        ...(merged.fatigue2nd as Record<string, unknown>),
        ...(src.fatigue2nd as Record<string, unknown>),
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

  return merged as unknown as DH2Character;
}
