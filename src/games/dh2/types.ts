import type { CharacterBase, InventoryItem } from '../shared/types';

/**
 * ─── LANDMARK: DARK_HERESY TYPES (BASE) ────────────────────────────────
 * Типы листа Dark Heresy, продублированные внутри каждого модуля.
 * Модуль самодостаточен: общих DH-файлов между редакциями нет.
 * Редакционные отличия добавляются в конце этого файла.
 */

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
export type DarkHeresyStatUpgrade = [
  boolean,
  boolean,
  boolean,
  boolean,
  boolean,
];
export type DarkHeresyCoreStatUpgrades = Record<
  DarkHeresyCoreStat,
  DarkHeresyStatUpgrade
>;
export type DarkHeresyCoreStatNotes = Partial<
  Record<DarkHeresyCoreStat, string>
>;

/**
 * Профиль аптитюд 2e: `profile` выводится из мира, бэкграунда и роли,
 * `chosen` разрешает дубли (игрок берёт другую аптитюду характеристики),
 * `extra` — ручные правки владельца. Значения — смысловые id аптитюд.
 */
export interface DH2AptitudeProfile {
  profile: string[];
  chosen: Record<string, string>;
  extra: string[];
}

/** Пси-профиль 2e: рейтинг, известные дисциплины и силы. */
export interface DH2PsyProfile {
  rating: number;
  disciplines: string[];
  powers: string[];
}

/**
 * Выборы стартового пакета, которые игрок сделал при создании. Пакет остаётся
 * подсказкой: на лист выбранные навыки и таланты игрок вносит вручную (D11).
 * `skills`/`talents` выровнены по `choose`-слотам бэкграунда, `''` — не выбрано.
 */
export interface DH2StartingChoices {
  /** Выбранный талант роли (один из двух в `role.talentChoice`). */
  roleTalent?: string;
  skills: string[];
  talents: string[];
}

export type DH2ExperienceKind =
  | 'characteristic'
  | 'skill'
  | 'talent'
  | 'psychic-power'
  | 'psy-rating'
  | 'elite-advance'
  /** Ручная покупка: цена и назначение вводит игрок (D4). */
  | 'other'
  /** Начисление или штраф опыта; удаление снимает его с `experience`. */
  | 'award';

/** Строка журнала покупок: цена по таблицам 2-2/2-4/2-6 и ссылка на покупку. */
export interface DH2ExperienceEntry {
  id: string;
  kind: DH2ExperienceKind;
  ref: string;
  cost: number;
  createdAt: string;
}

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
  /** Мир 2e: смысловой id (`feral-world`). */
  homeWorld: string;
  /** Бэкграунд 2e: смысловой id (`adeptus-arbites`). */
  background: string;
  /** Роль 2e: смысловой id (`assassin`). */
  role: string;
  /** Профиль аптитюд 2e. */
  aptitudes: DH2AptitudeProfile;
  /** Элитные продвижения 2e: `psyker`, `untouchable`, `inquisitor`. */
  eliteAdvances: string[];
  /** Пси-профиль 2e. */
  psy: DH2PsyProfile;
  /** Выборы стартового пакета при создании (D11). */
  startingChoices?: DH2StartingChoices;
  /** Пророчество 2e: id строки таблицы 2-9 (`d100-10`), не текст. */
  divination: string;
  /** Пол персонажа: свободная строка (правила редакции его не ограничивают). */
  gender: string;
  /** Журнал покупок опыта 2e. */
  experienceLog: DH2ExperienceEntry[];
  height: string;
  weight: string;
  age: string;
  skinColor: string;
  hairColor: string;
  eyeColor: string;
  experience: number;
  totalExpSpent: number;
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

export type DH2Stats = DarkHeresyCoreStats & { influence: number };
export type DH2StatUpgrades = DarkHeresyCoreStatUpgrades & {
  influence: DarkHeresyStatUpgrade;
};
export type DH2StatNotes = DarkHeresyCoreStatNotes & { influence?: string };

export interface DH2Fatigue {
  current: number;
  notes?: string;
}

/**
 * Лист Dark Heresy 2-й редакции. Только 2e-поля:
 *   • десять характеристик, включая `influence`;
 *   • усталость — `fatigue2nd` (`fatigue1st` не существует);
 *   • в навыках доступна тренировка `+30`;
 *   • `edition` отсутствует: редакция задаётся модулем/`systemId` (D3).
 */
/** Вид состояния (Безумие/Порча): расстройство, осквернение, мутация, рудимент. */
export type ConditionKind = 'disorder' | 'corruption' | 'mutation' | 'rudiment';

/** Источник состояния: игрок, пророчество или миграция старых данных. */
export type ConditionSource = 'manual' | 'divination' | 'legacy';

/** Структурированное состояние листа (D7); форма повторяется в каждом модуле. */
export interface ConditionEntry {
  id: string;
  kind: ConditionKind;
  name: string;
  severity?: string;
  effect?: string;
  notes?: string;
  source?: ConditionSource;
}

export interface DH2Character extends DarkHeresyBase {
  systemId?: 'dh2';
  stats: DH2Stats;
  statUpgrades: DH2StatUpgrades;
  statNotes?: DH2StatNotes;
  fatigue2nd: DH2Fatigue;
  /** Структурированные состояния (D7): счётчики Безумия/Порчи остаются выше. */
  conditions?: ConditionEntry[];
}
