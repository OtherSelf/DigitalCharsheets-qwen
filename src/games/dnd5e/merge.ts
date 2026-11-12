import {
  copyDefinedFields,
  mergeCommonSections,
  NARRATIVE_FIELDS,
  type MergeSource,
  type MergeTarget,
} from '../shared/merge';
import type { GameExportConfig } from '../types';
import type { DnD5eCharacter } from './types';

/**
 * ─── LANDMARK: DND5E MERGE ─────────────────────────────────────────────────
 * Слияние импортированных данных в лист D&D 5e. Раньше это была ветка
 * `isDnd` в `src/lib/export-utils.ts`; теперь — забота модуля (этап 2).
 * Цель и источник уже нормализованы хостом и относятся к одной редакции.
 */

const BASIC_FIELDS = [
  'name',
  'characterClass',
  'race',
  'background',
  'alignment',
  'age',
  'height',
  'weight',
  'eyes',
  'skin',
  'hair',
  'proficiencyBonus',
] as const;

const COMBAT_FIELDS = [
  'armorClass',
  'speed',
  'hpTracking',
  'hitPointsNotes',
  'temporaryHitPoints',
  'hitDice',
  'exhaustion',
  'savingThrows',
  'skills',
  'attacks',
  'combatResources',
] as const;

const PROGRESSION_FIELDS = [
  'level',
  'experiencePoints',
  'isMulticlass',
  'multiclasses',
  'divineBoons',
  'allowDivineBoonsBeforeLevel20',
  'inspiration',
  'allowInspirationHomeRule',
] as const;

const SPELL_FIELDS = [
  'spells',
  'spellSlots',
  'spellcastingAbility',
  'spellAttackBonus',
  'spellSaveDifficulty',
  'spellcastingEntries',
] as const;

export function mergeDnd5eData(
  target: DnD5eCharacter,
  source: Readonly<Record<string, unknown>>,
  config: GameExportConfig,
): DnD5eCharacter {
  const merged = { ...(target as unknown as MergeTarget) };
  const src = source as MergeSource;

  if (config.includeBasicInfo) {
    copyDefinedFields(merged, src, BASIC_FIELDS);
  }

  if (config.includeStats) {
    if (src.stats && typeof src.stats === 'object') {
      merged.stats = {
        ...(merged.stats as Record<string, unknown> | undefined),
        ...(src.stats as Record<string, unknown>),
      };
    }
    if (src.statNotes) merged.statNotes = src.statNotes;
  }

  if (config.includeCombat) {
    copyDefinedFields(merged, src, COMBAT_FIELDS);
    if (src.hitPoints) {
      merged.hitPoints = {
        ...(merged.hitPoints as Record<string, unknown> | undefined),
        ...(src.hitPoints as Record<string, unknown>),
      };
    }
    if (src.hitDiceUsed) {
      merged.hitDiceUsed = {
        ...(merged.hitDiceUsed as Record<string, unknown> | undefined),
        ...(src.hitDiceUsed as Record<string, unknown>),
      };
    }
    if (src.deathSaves) {
      merged.deathSaves = {
        ...(merged.deathSaves as Record<string, unknown> | undefined),
        ...(src.deathSaves as Record<string, unknown>),
      };
    }
  }

  if (config.includeInventory) {
    if (src.inventory) merged.inventory = src.inventory;
    if (src.currency) {
      merged.currency = {
        ...(merged.currency as Record<string, unknown> | undefined),
        ...(src.currency as Record<string, unknown>),
      };
    }
    if (src.attunementItems !== undefined) {
      merged.attunementItems = src.attunementItems;
    }
  }

  if (config.includeSpells) {
    copyDefinedFields(merged, src, SPELL_FIELDS);
  }

  if (config.includeNarrative) {
    copyDefinedFields(merged, src, NARRATIVE_FIELDS);
  }

  if (config.includeProgression) {
    copyDefinedFields(merged, src, PROGRESSION_FIELDS);
  }

  if (config.includeCompanions && src.companions) {
    merged.companions = src.companions;
  }

  mergeCommonSections(
    merged,
    src,
    config as unknown as Record<string, boolean>,
  );

  return merged as unknown as DnD5eCharacter;
}
