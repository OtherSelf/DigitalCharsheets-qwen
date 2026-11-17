import { generatedGameDefinitions } from './games.generated';
import type { GameDefinition, GameId } from './types';

/**
 * ─── LANDMARK: GAME DEFINITIONS ────────────────────────────────────────────
 * Семейства игр (`dnd`, `darkHeresy`) генерируются из блоков `game`
 * манифестов `src/games/<id>/plugin.json` (`npm run plugins:generate`,
 * файл `games.generated.ts`). Ядро не перечисляет игры руками: добавили или
 * удалили плагин — пересобрали реестр, этот файл не менялся.
 *
 * Человекочитаемые названия/описания живут в сгенерированных ключах
 * `games.generated.*` (см. `i18n.generated.ts`), а не в общем слое i18n.
 */
export const GAME_DEFINITIONS: readonly GameDefinition[] =
  generatedGameDefinitions;

export function getGameDefinition(id: GameId): GameDefinition | undefined {
  return GAME_DEFINITIONS.find((game) => game.id === id);
}

/** Игры в порядке показа (копия, чтобы вызывающий не мутировал реестр). */
export function listGameDefinitions(): GameDefinition[] {
  return [...GAME_DEFINITIONS].sort(
    (a, b) => a.order - b.order || a.id.localeCompare(b.id),
  );
}
