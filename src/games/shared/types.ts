import type { SystemId } from '../types';

/**
 * ─── LANDMARK: SHARED_CHARACTER_TYPES ──────────────────────────────────────
 * Типы листа, не зависящие от игры/редакции. Живут отдельно от `lib/types`,
 * чтобы модули игр (`src/games/<id>/`) могли импортировать их, не подтягивая
 * клиентский фасад и не создавая циклов.
 *
 * Здесь только данные; поведение — в модулях и `src/lib`.
 */

/**
 * Человекочитаемое имя системы в legacy-данных (schemaVersion 1).
 *
 * 📌 D4: начиная с v2 дискриминантом листа служит `systemId`, а это поле
 * читается только миграцией и не пишется в новые файлы. До этапа 3 UI
 * продолжает на него опираться — поэтому поле пока обязательно.
 */
export type GameSystem = 'Dungeons & Dragons' | 'Dark Heresy';

/** Общая часть любого листа. */
export interface CharacterBase {
  id: string;
  name: string;
  characterClass: string;
  /** Legacy-дискриминант v1; в v2 заменяется на `systemId` (📌 D4). */
  gameSystem: GameSystem;
  /** Машинный ID редакции (`dnd5e`, `dh1`, `dh2`); появляется в v2. */
  systemId?: SystemId;
  backstory: string;
  notes: string;
  questLog: Quest[];
  /** Версия формата файла листа; у legacy-файлов отсутствует. */
  schemaVersion?: number;
}

/** Предмет инвентаря (D&D и Dark Heresy). */
export interface InventoryItem {
  id: string;
  name: string;
  status: 'default' | 'lost';
  notes?: string;
}

/** Универсальный счётчик-ресурс (бой, дом. правила, способности). */
export interface CombatResource {
  id: string;
  description: string;
  current: number;
  max: number;
  notes?: string;
}

/** Цель квестового задания. */
export interface QuestObjective {
  id: string;
  text: string;
  completed: boolean;
}

/** Запись квестового журнала (общая для всех игр). */
export interface Quest {
  id: string;
  title: string;
  status: 'active' | 'completed';
  description: string;
  createdAt: string;
  updatedAt: string;
  // Optional UX fields (backward compatible)
  priority?: 'main' | 'side' | 'personal';
  notes?: string;
  rewards?: string;
  npcs?: string;
  locations?: string;
  objectives?: QuestObjective[];
}
