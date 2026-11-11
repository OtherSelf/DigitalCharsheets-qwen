import type { GameExportConfig } from '../types';
import type { DH1Character } from './types';

/**
 * ─── LANDMARK: DH EXPORT ───────────────────────────────────────────────────
 * JSON-поля Dark Heresy 1-й редакции: только её поле усталости
 * (`fatigue1st`) и её состав характеристик.
 */
export function buildDh1PortableJson(
  character: DH1Character,
  config: GameExportConfig,
): Record<string, unknown> {
  const result: Record<string, unknown> = {};

  if (config.includeBasicInfo) {
    Object.assign(result, {
      name: character.name,
      characterClass: character.characterClass,
      homeWorld: character.homeWorld,
      worldVariant: character.worldVariant,
      careerPath: character.careerPath,
      rank: character.rank,
      divination: character.divination,
      divinationEffect: character.divinationEffect,
      quirk: character.quirk,
      height: character.height,
      weight: character.weight,
      age: character.age,
      skinColor: character.skinColor,
      hairColor: character.hairColor,
      eyeColor: character.eyeColor,
    });
  }

  if (config.includeStats) {
    result.stats = character.stats;
    result.statNotes = character.statNotes;
    result.statUpgrades = character.statUpgrades;
  }

  if (config.includeCombat) {
    const fatigue = character.fatigue1st;
    Object.assign(result, {
      wounds: character.wounds,
      fatePoints: character.fatePoints,
      insanityPoints: character.insanityPoints,
      corruptionPoints: character.corruptionPoints,
      fatigue1st: fatigue,
      criticalConditions: character.criticalConditions,
      customResources: character.customResources,
      movement: character.movement,
      skills: character.skills,
      talents: character.talents,
    });
  }

  if (config.includeEquipment) result.equipment = character.equipment;
  if (config.includeInventory) {
    result.inventory = character.inventory;
    result.wealth = character.wealth;
  }

  if (config.includeNarrative) {
    result.backstory = character.backstory;
    result.notes = character.notes;
  }

  if (config.includeProgression) {
    Object.assign(result, {
      experience: character.experience,
      totalExpSpent: character.totalExpSpent,
      alternatePath: character.alternatePath,
      advancedPath: character.advancedPath,
    });
  }

  if (config.includeQuestLog) result.questLog = character.questLog;
  if (config.includeCustomHouseRules) {
    result.customHouseRules = character.customHouseRules;
  }

  return result;
}
