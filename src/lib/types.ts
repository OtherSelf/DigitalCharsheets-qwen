import type { CharacterRecord } from '@/games/types';

/**
 * ─── LANDMARK: CHARACTER TYPES FACADE ──────────────────────────────────────
 * Тонкий фасад ядра (этап 5): конкретных игровых типов здесь больше нет.
 * `Character` — это `CharacterRecord` с произвольными дополнительными полями
 * редакции; форму листа знает только плагин, а общие примитивы (квесты,
 * предметы, база листа) приходят из `@/games/shared/types`.
 *
 * Плагины импортируют свои типы из собственного `./types`, а не отсюда (это
 * проверяет `npm run plugins:boundaries`).
 */
export type {
  CharacterBase,
  CombatResource,
  GameSystem,
  InventoryItem,
  Quest,
  QuestObjective,
} from '@/games/shared/types';

/**
 * Лист любой игры/редакции глазами ядра: `CharacterRecord` + произвольные
 * поля редакции (форму знает плагин).
 */
export type Character = CharacterRecord & {
  userId?: string;
  /** Legacy-метка системы; дискриминант — `systemId` (D4). */
  gameSystem?: string;
  /** Поля редакции ядро не перечисляет — их знает плагин. */
  [key: string]: unknown;
};
