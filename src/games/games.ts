import type { GameDefinition, GameId } from './types';

/**
 * ─── LANDMARK: GAME DEFINITIONS ────────────────────────────────────────────
 * Игры-«семейства», а не редакции: D&D и Dark Heresy. Редакции берутся из
 * модулей (`src/games/registry.ts`), а здесь задаётся порядок карточек на
 * шаге выбора игры и i18n-ключи названия/описания.
 *
 * Человекочитаемые названия живут только в i18n; в данных листа их нет.
 */
export const GAME_DEFINITIONS: readonly GameDefinition[] = [
  {
    id: 'dnd',
    order: 10,
    nameKey: 'common.dungeonsAndDragons',
    descriptionKey: 'games.dnd.description',
  },
  {
    id: 'darkHeresy',
    order: 20,
    nameKey: 'common.darkHeresy',
    descriptionKey: 'games.darkHeresy.description',
  },
];

export function getGameDefinition(id: GameId): GameDefinition | undefined {
  return GAME_DEFINITIONS.find((game) => game.id === id);
}

/** Игры в порядке показа (копия, чтобы вызывающий не мутировал реестр). */
export function listGameDefinitions(): GameDefinition[] {
  return [...GAME_DEFINITIONS].sort(
    (a, b) => a.order - b.order || a.id.localeCompare(b.id),
  );
}
