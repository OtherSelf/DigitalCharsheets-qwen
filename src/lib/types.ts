'use client';

import type { DH1Character } from '@/games/dh1/types';
import type { DH2Character } from '@/games/dh2/types';
import type { DnD5eCharacter } from '@/games/dnd5e/types';
import type { CharacterRecord } from '@/games/types';

/**
 * ─── LANDMARK: CHARACTER TYPES FACADE ──────────────────────────────────────
 * Фасад ядра. После этапов 2–3 ядро больше не типизирует листы конкретной
 * игрой: `Character` — это `CharacterRecord` с произвольными дополнительными
 * полями. Конкретные типы (`DnD5eCharacter`, `DH1Character`, …) реэкспортируются
 * только для совместимости плагинов, которые ещё не перешли на свои
 * `./types` (границы плагинов учитывают это как долг).
 */

export type {
  CharacterBase,
  CombatResource,
  GameSystem,
  InventoryItem,
  Quest,
  QuestObjective,
} from '@/games/shared/types';

export { DarkHeresyCareerPaths, DarkHeresyHomeWorlds } from '@/games/dh1/types';
export type {
  Armor,
  ArmorPiece,
  BodyPart,
  DarkHeresyBase,
  DarkHeresyCareerPath,
  DarkHeresyCoreStat,
  DarkHeresyCoreStatNotes,
  DarkHeresyCoreStatUpgrades,
  DarkHeresyCoreStats,
  DarkHeresyEquipment,
  DarkHeresyHomeWorld,
  DarkHeresyStatUpgrade,
  DarkHeresyWeapons,
  MeleeWeapon,
  RangedWeapon,
  Skill,
  Talent,
} from '@/games/dh1/types';
export type {
  AttunementItem,
  DnD5eCharacter,
  DnDAbility,
  DnDActionOrFeature,
  DnDAttack,
  DnDCompanion,
  DnDMulticlass,
  DnDSavingThrow,
  DnDSkill,
  Spell,
  SpellcastingEntry,
} from '@/games/dnd5e/types';
export type { DH1Character, DH1Fatigue } from '@/games/dh1/types';
export type {
  DH2Character,
  DH2Fatigue,
  DH2StatNotes,
  DH2StatUpgrades,
  DH2Stats,
} from '@/games/dh2/types';

/**
 * Лист Dark Heresy любой редакции — только для совместимости плагинов.
 * Ядро этот union не использует.
 */
export type DarkHeresyCharacter = DH1Character | DH2Character;

/**
 * Лист любой игры/редакции глазами ядра: `CharacterRecord` + произвольные
 * поля редакции. Конкретную форму знает только плагин, который отдаёт слоты
 * и типизирует свои компоненты сам.
 */
export type Character = CharacterRecord & {
  userId?: string;
  gameSystem?: string;
  characterClass?: string;
  level?: number;
  rank?: string;
  [key: string]: unknown;
};
