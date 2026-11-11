import type { GameExportConfig } from '../types';
import type { DnD5eCharacter } from './types';

/**
 * ─── LANDMARK: DND5E EXPORT ────────────────────────────────────────────────
 * JSON-поля D&D 5e для переносимого экспорта. Раньше эта логика была в
 * `src/lib/export-utils.ts` с ветками по `gameSystem`; теперь ядро только
 * собирает конверт, а состав полей задаёт модуль.
 *
 * Идентичность (`id`, `systemId`, `schemaVersion`, legacy `gameSystem`)
 * добавляет ядро — адаптер её не трогает.
 */
export function buildDnd5ePortableJson(
  character: DnD5eCharacter,
  config: GameExportConfig,
): Record<string, unknown> {
  const result: Record<string, unknown> = {};

  if (config.includeBasicInfo) {
    Object.assign(result, {
      name: character.name,
      characterClass: character.characterClass,
      race: character.race,
      background: character.background,
      alignment: character.alignment,
      age: character.age,
      height: character.height,
      weight: character.weight,
      eyes: character.eyes,
      skin: character.skin,
      hair: character.hair,
      proficiencyBonus: character.proficiencyBonus,
    });
  }

  if (config.includeStats) {
    result.stats = character.stats;
    result.statNotes = character.statNotes;
  }

  if (config.includeCombat) {
    Object.assign(result, {
      armorClass: character.armorClass,
      speed: character.speed,
      hitPoints: character.hitPoints,
      hpTracking: character.hpTracking,
      hitPointsNotes: character.hitPointsNotes,
      temporaryHitPoints: character.temporaryHitPoints,
      hitDice: character.hitDice,
      hitDiceUsed: character.hitDiceUsed,
      deathSaves: character.deathSaves,
      exhaustion: character.exhaustion,
      savingThrows: character.savingThrows,
      skills: character.skills,
      attacks: character.attacks,
      combatResources: character.combatResources,
    });
  }

  if (config.includeEquipment) result.equipment = character.equipment;
  if (config.includeInventory) {
    result.inventory = character.inventory;
    result.currency = character.currency;
    result.attunementItems = character.attunementItems;
  }

  if (config.includeSpells) {
    Object.assign(result, {
      spells: character.spells,
      spellSlots: character.spellSlots,
      spellcastingAbility: character.spellcastingAbility,
      spellAttackBonus: character.spellAttackBonus,
      spellSaveDifficulty: character.spellSaveDifficulty,
      spellcastingEntries: character.spellcastingEntries,
    });
  }

  if (config.includeNarrative) {
    Object.assign(result, {
      backstory: character.backstory,
      notes: character.notes,
      otherProficienciesAndLanguages: character.otherProficienciesAndLanguages,
      personalityTraits: character.personalityTraits,
      ideals: character.ideals,
      bonds: character.bonds,
      flaws: character.flaws,
      featuresAndTraits: character.featuresAndTraits,
    });
  }

  if (config.includeProgression) {
    Object.assign(result, {
      level: character.level,
      experiencePoints: character.experiencePoints,
      isMulticlass: character.isMulticlass,
      multiclasses: character.multiclasses,
      divineBoons: character.divineBoons,
      allowDivineBoonsBeforeLevel20: character.allowDivineBoonsBeforeLevel20,
      inspiration: character.inspiration,
      allowInspirationHomeRule: character.allowInspirationHomeRule,
    });
  }

  if (config.includeCompanions) result.companions = character.companions;
  if (config.includeQuestLog) result.questLog = character.questLog;
  if (config.includeCustomHouseRules) {
    result.customHouseRules = character.customHouseRules;
  }

  return result;
}
