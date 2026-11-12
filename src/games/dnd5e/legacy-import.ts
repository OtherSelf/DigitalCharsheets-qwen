import type { LegacyImportContext } from '@/games/types';

/**
 * ─── LANDMARK: DND5E LEGACY IMPORT ────────────────────────────────────────
 * Разовый перенос листов из Firestore-экспорта (записи с `gameSystem:
 * 'Dungeons & Dragons'`). Конвертер и генератор имени — данные плагина
 * (этап 3), поэтому ядро не содержит проверок `system.includes('Dungeons')`;
 * сам перенос выполняется офлайн-скриптом, рантайм-роута импорта нет.
 */
type RawRow = Record<string, any>;

export function dnd5eMatchesLegacyImport(
  raw: Readonly<Record<string, unknown>>,
): boolean {
  return String(raw.gameSystem ?? '').includes('Dungeons');
}

export function dnd5eLegacyImportName(
  raw: Readonly<Record<string, unknown>>,
  index: number,
): string {
  const row = raw as RawRow;
  const characterClass = String(row.characterClass ?? 'Unknown').trim();
  const level = row.level || 1;
  const background = String(row.background ?? '').trim();
  return background
    ? `Level ${level} ${characterClass} (${background})`
    : `Level ${level} ${characterClass} #${index + 1}`;
}

export function dnd5eConvertLegacyImport(
  raw: Readonly<Record<string, unknown>>,
  context: LegacyImportContext,
): Record<string, unknown> {
  const row = raw as RawRow;
  const hitPoints =
    row.hitPoints && row.hitPoints !== 0
      ? row.hitPoints
      : { current: 0, max: 0 };
  const currency =
    row.currency && row.currency !== 0
      ? row.currency
      : { cp: 0, sp: 0, ep: 0, gp: 0, pp: 0 };
  const deathSaves =
    row.deathSaves && row.deathSaves !== 0
      ? row.deathSaves
      : { successes: 0, failures: 0 };

  return {
    id: context.createId(),
    userId: context.userId,
    gameSystem: 'Dungeons & Dragons',
    name: context.name,
    characterClass: String(row.characterClass ?? '').trim(),
    background: String(row.background ?? '').trim(),
    alignment: String(row.alignment ?? '').trim(),
    level: row.level || 1,
    inspiration:
      row.inspiration === 'Yes' ||
      row.inspiration === '1' ||
      row.inspiration === 1
        ? '1'
        : '0',
    backstory: String(row.backstory ?? '').trim(),
    age: String(row.age ?? '').trim(),
    height: String(row.height ?? '').trim(),
    weight: '',
    eyes: String(row.eyes ?? '').trim(),
    hair: String(row.hair ?? '').trim(),
    stats: {
      strength: 10,
      dexterity: 10,
      constitution: 10,
      intelligence: 10,
      wisdom: 10,
      charisma: 10,
    },
    armorClass: row.armorClass || 10,
    hitPoints,
    hitDice: String(row.hitDice ?? '').trim(),
    hitDiceUsed: row.hitDiceUsed && row.hitDiceUsed !== 0 ? row.hitDiceUsed : 0,
    speed: '30ft',
    proficiencyBonus: 2,
    initiative: 0,
    experience: row.experiencePoints || 0,
    skills: [],
    attacks: Array.isArray(row.attacks) ? row.attacks : [],
    equipment: Array.isArray(row.equipment) ? row.equipment : [],
    inventory: Array.isArray(row.inventory) ? row.inventory : [],
    currency,
    featuresAndTraits: Array.isArray(row.featuresAndTraits)
      ? row.featuresAndTraits
      : [],
    companions: Array.isArray(row.companions) ? row.companions : [],
    combatResources: Array.isArray(row.combatResources)
      ? row.combatResources
      : [],
    attunementItems: Array.isArray(row.attunementItems)
      ? row.attunementItems
      : [],
    bonds: Array.isArray(row.bonds) ? row.bonds : [],
    ideals: Array.isArray(row.ideals) ? row.ideals : [],
    flaws: Array.isArray(row.flaws) ? row.flaws : [],
    deathSaves,
    hpTracking: String(row.hpTracking ?? '').trim(),
    isMulticlass: row.isMulticlass === true,
    spells: {},
  };
}
