'use client';

import type { DH1Character } from '@/games/dh1/types';
import type { DH2Character } from '@/games/dh2/types';
import type { DnD5eCharacter } from '@/games/dnd5e/types';

/**
 * ─── LANDMARK: CHARACTER TYPES FACADE ──────────────────────────────────────
 * Публичный фасад типов листов. На время перехода к модульной архитектуре
 * (📌 D1) он собирает типы из `src/games/` и сохраняет прежние имена
 * импортов, чтобы 20+ файлов не переписывались одним коммитом.
 *
 * `DarkHeresyCharacter` — union `DH1Character | DH2Character`; поля редакций
 * не смешиваются. После этапа 7 фасад схлопывается до реэкспорта.
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
 * Лист Dark Heresy любой редакции. Это не «legacy-форма с edition», а
 * честный union двух независимых типов (📌 D2/D3): dh1 без `influence` и
 * `fatigue2nd`, dh2 без `fatigue1st`. Ветвление по `systemId` допускается
 * только внутри DH-модулей; ядро работает через capability-конфиг.
 */
export type DarkHeresyCharacter = DH1Character | DH2Character;

/** Лист любой поддерживаемой игры/редакции. */
export type Character = DnD5eCharacter | DarkHeresyCharacter;
