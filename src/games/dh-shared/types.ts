import type { CharacterBase, InventoryItem } from '../shared/types';

/**
 * ─── LANDMARK: DARK_HERESY SHARED TYPES ────────────────────────────────────
 * Общая часть листов Dark Heresy: всё, что одинаково в 1-й и 2-й редакциях.
 * Редакционные отличия живут в `src/games/dh1/types.ts` и
 * `src/games/dh2/types.ts`:
 *
 *   • `stats` / `statUpgrades` / `statNotes` — 1e без `influence`, 2e с ним;
 *   • `fatigue1st` — только dh1, `fatigue2nd` — только dh2;
 *   • `+30` в тренировке навыков — только dh2 (поле `Skill.training` общее,
 *     различие в UI и правилах модуля);
 *   • `edition` в новых типах отсутствует (📌 D3).
 */

export const DarkHeresyHomeWorlds = [
  'Feral World',
  'Hive World',
  'Imperial World',
  'Void Born',
  'Forge World',
] as const;
export type DarkHeresyHomeWorld = (typeof DarkHeresyHomeWorlds)[number];

export const DarkHeresyCareerPaths = [
  'Adept',
  'Arbitrator',
  'Assassin',
  'Cleric',
  'Guardsman',
  'Imperial Psyker',
  'Scum',
  'Tech-Priest',
] as const;
export type DarkHeresyCareerPath = (typeof DarkHeresyCareerPaths)[number];

/**
 * Девять характеристик, общих для обеих редакций. `influence` — только 2e и
 * добавляется в `DH2Character`.
 */
export const DARK_HERESY_CORE_STATS = [
  'weaponSkill',
  'ballisticSkill',
  'strength',
  'toughness',
  'agility',
  'intelligence',
  'perception',
  'willpower',
  'fellowship',
] as const;
export type DarkHeresyCoreStat = (typeof DARK_HERESY_CORE_STATS)[number];

export type DarkHeresyCoreStats = Record<DarkHeresyCoreStat, number>;
export type DarkHeresyStatUpgrade = [boolean, boolean, boolean, boolean];
export type DarkHeresyCoreStatUpgrades = Record<
  DarkHeresyCoreStat,
  DarkHeresyStatUpgrade
>;
export type DarkHeresyCoreStatNotes = Partial<
  Record<DarkHeresyCoreStat, string>
>;

/** Навык DH: тренировки `skilled`/`+10`/`+20` есть в обеих редакциях. */
export interface Skill {
  id: string;
  name: string;
  notes: string;
  type: 'basic' | 'advanced';
  training: {
    skilled: boolean;
    plus10: boolean;
    plus20: boolean;
    /** Колонка `+30` показывается только в dh2 (capability модуля). */
    plus30: boolean;
  };
}

export interface Talent {
  id: string;
  name: string;
  notes?: string;
  description?: string;
}

export interface ArmorPiece {
  ap: number;
  type: string;
  mods: string;
  quality: string;
}

export type BodyPart =
  'Head' | 'Right arm' | 'Body' | 'Left arm' | 'Right leg' | 'Left leg';

export type Armor = Record<BodyPart, ArmorPiece | null>;

export interface MeleeWeapon {
  id: string;
  name: string;
  type: string;
  range: string;
  penetration: string;
  damage: string;
  traits: string;
  equipped?: boolean;
  notes?: string;
}

export interface RangedWeapon {
  id: string;
  name: string;
  type: string;
  range: string;
  rof: string;
  damage: string;
  clip: number;
  clipSize: number;
  reload: string;
  traits: string;
  equipped?: boolean;
  notes?: string;
}

export interface DarkHeresyWeapons {
  melee: MeleeWeapon[];
  ranged: RangedWeapon[];
}

export interface DarkHeresyEquipment {
  armor: Armor;
  weapons: DarkHeresyWeapons;
}

/**
 * Поля, одинаковые у dh1 и dh2. Характеристики, апгрейды, заметки к ним и
 * усталость добавляются редакциями — у них разный состав.
 */
export interface DarkHeresyBase extends CharacterBase {
  gameSystem: 'Dark Heresy';
  homeWorld: DarkHeresyHomeWorld | '';
  worldVariant: string;
  careerPath: DarkHeresyCareerPath | '';
  rank: string;
  /** Стабильный ID пророчества (`mutationWithout`), не текст. */
  divination: string;
  /** Стабильный ID эффекта (`insanity2`), не текст. */
  divinationEffect: string;
  quirk: string;
  height: string;
  weight: string;
  age: string;
  skinColor: string;
  hairColor: string;
  eyeColor: string;
  experience: number;
  totalExpSpent: number;
  alternatePath: string | null;
  advancedPath: string | null;
  wounds: { current: number; max: number; notes?: string };
  fatePoints: { current: number; max: number; notes?: string };
  insanityPoints: { total: number; notes?: string };
  corruptionPoints: { total: number; notes?: string };
  wealth: { throneGelt: number; monthlyIncome: number; notes?: string };
  movement: { walkHalf: number; walkFull: number; charge: number; run: number };
  equipment: DarkHeresyEquipment;
  inventory: InventoryItem[];
  skills: Skill[];
  talents: Talent[];
  criticalConditions: { id: string; name: string; notes?: string }[];
  customHouseRules?: { name: string; description: string }[];
  customResources?: {
    id: string;
    description: string;
    current: number;
    max: number;
    notes?: string;
  }[];
}
