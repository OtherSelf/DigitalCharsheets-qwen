import type { GameExportConfig } from '../types';
import type { DH1Character } from './types';

/**
 * ─── LANDMARK: DH EXPORT ───────────────────────────────────────────────────
 * JSON-поля Dark Heresy 1-й редакции: только её поле усталости
 * (`fatigue1st`) и её состав характеристик.
 */

/**
 * Копия legacy-блока без вытесненных ключей. Миграция v6 переносит их во
 * вкладку заметок «Наследие», поэтому в экспорте их быть не должно; пустой
 * блок не выводим совсем.
 */
function withoutLegacyKeys(
  value: Record<string, unknown> | undefined,
  keys: readonly string[],
): Record<string, unknown> | undefined {
  if (!value) return undefined;
  const next = { ...value };
  for (const key of keys) delete next[key];
  return Object.keys(next).length > 0 ? next : undefined;
}
export function buildDh1PortableJson(
  character: DH1Character,
  config: GameExportConfig,
): Record<string, unknown> {
  const result: Record<string, unknown> = {};

  if (config.includeBasicInfo) {
    // Identity собирается по полям листа: старые файлы несут identity.playerName,
    // а экспорт не должен выносить его наружу.
    const identity = character.identity;
    Object.assign(result, {
      name: character.name,
      characterClass: character.characterClass,
      homeWorld: character.homeWorld,
      worldVariant: character.worldVariant,
      careerPath: character.careerPath,
      rank: character.rank,
      divination: character.divination,
      divinationEffect: character.divinationEffect,
      divinationText: character.divinationText,
      divinationEffectText: character.divinationEffectText,
      quirk: character.quirk,
      height: character.height,
      weight: character.weight,
      age: character.age,
      skinColor: character.skinColor,
      hairColor: character.hairColor,
      eyeColor: character.eyeColor,
      identity: identity
        ? {
            gender: identity.gender,
            build: identity.build,
            handedness: identity.handedness,
          }
        : undefined,
    });
  }

  if (config.includeStats) {
    result.stats = character.stats;
    result.statNotes = character.statNotes;
    result.statUpgrades = character.statUpgrades;
  }

  if (config.includeCombat) {
    const fatigue = character.fatigue1st;
    const insanityDetails = withoutLegacyKeys(
      character.insanityDetails as Record<string, unknown> | undefined,
      ['degree', 'traumaModifier'],
    );
    const corruptionDetails = withoutLegacyKeys(
      character.corruptionDetails as Record<string, unknown> | undefined,
      ['degree', 'test'],
    );
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
      mutations: character.mutations,
      conditions: character.conditions,
      psy: character.psy,
      // `traits`, `eliteAdvances` и degree/trauma/test Безумия и Порчи —
      // legacy-поля: миграция v6 переносит их во вкладку заметок «Наследие»,
      // поэтому в экспорт они не попадают (импорт старых файлов их принимает).
      ...(insanityDetails ? { insanityDetails } : {}),
      ...(corruptionDetails ? { corruptionDetails } : {}),
    });
  }

  if (config.includeEquipment) {
    result.equipment = character.equipment;
    result.carry = character.carry;
  }
  if (config.includeInventory) {
    result.inventory = character.inventory;
    result.wealth = character.wealth;
  }

  if (config.includeNarrative) {
    result.backstory = character.backstory;
    result.notes = character.notes;
    result.noteTabs = character.noteTabs;
  }

  if (config.includeProgression) {
    Object.assign(result, {
      experience: character.experience,
      totalExpSpent: character.totalExpSpent,
      experienceLog: character.experienceLog,
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
