'use client';

import type {
  DarkHeresyBase,
  DarkHeresyCoreStatNotes,
  DarkHeresyCoreStats,
  DarkHeresyCoreStatUpgrades,
} from '@/games/dh-shared/types';
import type { DnD5eCharacter } from '@/games/dnd5e/types';

/**
 * ─── LANDMARK: CHARACTER TYPES FACADE ──────────────────────────────────────
 * Публичный фасад типов листов. На время перехода к модульной архитектуре
 * (📌 D1) он собирает типы из `src/games/` и сохраняет прежние имена
 * импортов, чтобы 20+ файлов не переписывались одним коммитом.
 *
 * После этапа 3 (флоу/листы) и этапа 7 фасад схлопывается до реэкспорта;
 * legacy-тип `DarkHeresyCharacter` (v1, с `edition` и двойной усталостью)
 * удаляется вместе с поддержкой чтения v1.
 */

export type {
  CharacterBase,
  CombatResource,
  GameSystem,
  InventoryItem,
  Quest,
  QuestObjective,
} from '@/games/shared/types';

export {
  DarkHeresyCareerPaths,
  DarkHeresyHomeWorlds,
} from '@/games/dh-shared/types';
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
} from '@/games/dh-shared/types';
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
 * Legacy-форма листа Dark Heresy (schemaVersion 1).
 *
 * @deprecated Это переходный тип: он объединяет обе редакции и содержит
 * `edition`, `fatigue1st`/`fatigue2nd` и `influence`. Новый код работает с
 * `DH1Character` / `DH2Character` из модулей; миграция v2 (этап 2) удаляет
 * лишние поля, после чего этот тип уйдёт из фасада.
 */
export interface DarkHeresyCharacter extends DarkHeresyBase {
  edition?: '1st' | '2nd' | 'hybrid';
  stats: DarkHeresyCoreStats & { influence: number };
  statUpgrades: DarkHeresyCoreStatUpgrades & {
    influence: [boolean, boolean, boolean, boolean];
  };
  statNotes?: DarkHeresyCoreStatNotes & { influence?: string };
  fatigue1st: { current: number; notes?: string };
  fatigue2nd: { current: number; notes?: string };
}

/** Лист любой поддерживаемой редакции (v1-совместимый union до этапа 3). */
export type Character = DnD5eCharacter | DarkHeresyCharacter;
