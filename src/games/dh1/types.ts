import type { CharacterBase, InventoryItem } from '../shared/types';

/**
 * ─── LANDMARK: DARK_HERESY TYPES (BASE) ────────────────────────────────
 * Типы листа Dark Heresy, продублированные внутри каждого модуля.
 * Модуль самодостаточен: общих DH-файлов между редакциями нет.
 * Редакционные отличия добавляются в конце этого файла.
 */

export const DarkHeresyHomeWorlds = [
  'Feral World',
  'Hive World',
  'Imperial World',
  'Void Born',
  'Forge World',
  'Schola Progenium',
  'Noble Born',
  'Mind-Cleared',
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
 * Девять базовых характеристик Dark Heresy. `influence` добавляется
 * только в `DH2Character`.
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

/** Навык DH: тренировки `skilled`/`+10`/`+20`; `+30` использует только dh2. */
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
  /** Вес предмета по листу (свободная строка: «6 кг», «1,5»). */
  weight?: string;
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
  /** Вес по листу; необязателен для legacy-листов. */
  weight?: string;
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
  /** Бронебойность (Бро.) по таблице оружия; в legacy-листах отсутствует. */
  penetration?: string;
  clip: number;
  clipSize: number;
  reload: string;
  traits: string;
  /** Вес по листу; необязателен для legacy-листов. */
  weight?: string;
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
  /** Общий вес брони по листу (свободная строка). */
  armorWeight?: string;
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

export interface DH1Fatigue {
  current: number;
  notes?: string;
}

/** Свободная строка списка (черта, мутация, элитное улучшение). */
export interface DH1ListEntry {
  id: string;
  name: string;
  notes?: string;
}

/** Психосила в листе: имя и порог; справочник сил — отдельная задача. */
export interface DH1PsyPower {
  id: string;
  name: string;
  threshold?: string;
  notes?: string;
}

/** Идентичность игрока и персонажа (поля листа «Личные данные»). */
export interface DH1Identity {
  playerName?: string;
  gender?: string;
  build?: string;
  /** Ведущая рука: строка, чтобы не ломать ввод мастером. */
  handedness?: string;
}

/** Переносимый вес и производные от Силы (свободные строки). */
export interface DH1Carry {
  totalCarriedWeight?: string;
  carry?: string;
  lift?: string;
  push?: string;
}

/** Пси-блок листа: рейтинг, дисциплина, силы, «Испытываемы Против». */
export interface DH1Psy {
  rating?: number;
  discipline?: string;
  powers?: DH1PsyPower[];
  testedAgainst?: string;
}

/** Детали Безумия (степень, травма, расстройства, серьёзность). */
export interface DH1InsanityDetails {
  degree?: string;
  traumaModifier?: string;
  disorders?: string;
  severity?: string;
}

/** Детали Порчи (степень, тест на Осквернение, Осквернения). */
export interface DH1CorruptionDetails {
  degree?: string;
  test?: string;
  defilements?: string;
}

/**
 * Лист Dark Heresy 1-й редакции. Только 1e-поля:
 *   • девять характеристик без `influence`;
 *   • усталость — `fatigue1st` (`fatigue2nd` не существует);
 *   • `+30` в навыках не используется в UI;
 *   • `edition` отсутствует: редакция задаётся модулем/`systemId` (D3).
 *
 * Поля ниже добавлены аддитивно (D3 DH1APP): старые листы читаются без
 * миграции, отсутствие любого блока означает «не заполнено».
 */
export interface DH1Character extends DarkHeresyBase {
  systemId?: 'dh1';
  stats: DarkHeresyCoreStats;
  statUpgrades: DarkHeresyCoreStatUpgrades;
  statNotes?: DarkHeresyCoreStatNotes;
  fatigue1st: DH1Fatigue;
  identity?: DH1Identity;
  carry?: DH1Carry;
  traits?: DH1ListEntry[];
  mutations?: DH1ListEntry[];
  eliteAdvances?: DH1ListEntry[];
  psy?: DH1Psy;
  insanityDetails?: DH1InsanityDetails;
  corruptionDetails?: DH1CorruptionDetails;
}
