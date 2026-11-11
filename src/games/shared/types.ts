/**
 * ─── LANDMARK: SHARED_CHARACTER_TYPES ──────────────────────────────────────
 * Типы листа, не зависящие от игры/редакции. Живут отдельно от `lib/types`,
 * чтобы модули игр (`src/games/<id>/`) могли импортировать их, не подтягивая
 * клиентский фасад и не создавая циклов.
 *
 * Здесь только данные; поведение — в модулях и `src/lib`.
 */

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
