import type { LegacyImportContext } from '@/games/types';

/**
 * ─── LANDMARK: DH1 LEGACY IMPORT ──────────────────────────────────────────
 * Разовый перенос листов Dark Heresy из Firestore-экспорта (записи с
 * `gameSystem: 'Dark Heresy'` без `edition` → 1-я редакция). Раньше конвертер
 * жил в `src/app/api/import/route.ts`; теперь — данные плагина (этап 3).
 */
type RawRow = Record<string, any>;

const ARMOR_PARTS = [
  'Head',
  'Right arm',
  'Body',
  'Left arm',
  'Right leg',
  'Left leg',
] as const;

export function dh1MatchesLegacyImport(
  raw: Readonly<Record<string, unknown>>,
): boolean {
  return String(raw.gameSystem ?? '').includes('Dark Heresy');
}

export function dh1LegacyImportName(
  raw: Readonly<Record<string, unknown>>,
  index: number,
): string {
  const row = raw as RawRow;
  const career = String(row.careerPath ?? 'Unknown').trim();
  const world = String(row.homeWorld ?? '').trim();
  return world ? `${career} (${world})` : `${career} #${index + 1}`;
}

export function dh1ConvertLegacyImport(
  raw: Readonly<Record<string, unknown>>,
  context: LegacyImportContext,
): Record<string, unknown> {
  const row = raw as RawRow;
  const rawEquipment =
    row.equipment && row.equipment !== 0 ? row.equipment : {};
  const armor = rawEquipment.armor || {};
  const weapons = rawEquipment.weapons || {};

  const normalizedArmor: Record<string, unknown> = {};
  for (const part of ARMOR_PARTS) {
    normalizedArmor[part] =
      armor[part] && armor[part] !== 0 ? armor[part] : null;
  }

  const wounds =
    row.wounds && row.wounds !== 0
      ? row.wounds
      : { current: 0, max: 0, notes: '' };
  const fatePoints =
    row.fatePoints && row.fatePoints !== 0
      ? row.fatePoints
      : { current: 1, max: 1, notes: '' };
  const insanityPoints =
    row.insanityPoints && row.insanityPoints !== 0
      ? row.insanityPoints
      : { total: 0, notes: '' };
  const corruptionPoints =
    row.corruptionPoints && row.corruptionPoints !== 0
      ? row.corruptionPoints
      : { total: 0, notes: '' };

  return {
    id: context.createId(),
    userId: context.userId,
    gameSystem: 'Dark Heresy',
    name: context.name,
    careerPath: String(row.careerPath ?? '').trim(),
    characterClass: String(row.characterClass ?? '').trim(),
    homeWorld: String(row.homeWorld ?? '').trim(),
    rank: 'Acolyte',
    advancedPath:
      row.advancedPath && row.advancedPath !== 0
        ? String(row.advancedPath).trim()
        : null,
    alternatePath:
      row.alternatePath && row.alternatePath !== 0
        ? String(row.alternatePath).trim()
        : null,
    divination: String(row.divination ?? '').trim(),
    divinationEffect: String(row.divinationEffect ?? '').trim(),
    backstory: String(row.backstory ?? '').trim(),
    age: String(row.age ?? '').trim(),
    height: String(row.height ?? '').trim(),
    weight: '',
    hairColor: String(row.hairColor ?? '').trim(),
    eyeColor: String(row.eyeColor ?? '').trim(),
    skinColor: '',
    quirk: '',
    worldVariant: '',
    stats: {
      weaponSkill: 30,
      ballisticSkill: 30,
      strength: 30,
      toughness: 30,
      agility: 30,
      intelligence: 30,
      perception: 30,
      willpower: 30,
      fellowship: 30,
      influence: 0,
    },
    statUpgrades: {},
    statNotes: {},
    skills: [],
    talents: [],
    movement: { walkHalf: 0, walkFull: 0, charge: 0, run: 0 },
    wounds,
    fatePoints,
    insanityPoints,
    corruptionPoints,
    experience: row.experience || 0,
    totalExpSpent: row.experience || 0,
    equipment: {
      armor: normalizedArmor,
      weapons: {
        melee: Array.isArray(weapons.melee) ? weapons.melee : [],
        ranged: Array.isArray(weapons.ranged) ? weapons.ranged : [],
      },
    },
    inventory: Array.isArray(row.inventory) ? row.inventory : [],
    wealth: { throneGelt: 0, monthlyIncome: 0 },
  };
}
