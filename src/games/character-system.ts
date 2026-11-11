import { getGameDefinition, listGameDefinitions } from './games';
import {
  getGameModule,
  listGameModulesForGame,
  type AnyGameModule,
} from './registry';
import type { GameDefinition, SystemId } from './types';

/**
 * ─── LANDMARK: CHARACTER SYSTEM RESOLUTION ────────────────────────────────
 * Мост между листом и реестром для UI: по `systemId` (или legacy
 * `gameSystem`) вернуть модуль и i18n-ключи названий. Ядро/UI не должны
 * хардкодить «Dungeons & Dragons»/«Dark Heresy» — только эти helpers.
 */
export interface CharacterSystemSource {
  systemId?: string;
  gameSystem?: string;
  /** Legacy 1e/2e marker: используется только до миграции v2 (📌 D3). */
  edition?: string;
}

export function resolveCharacterSystemId(
  character: CharacterSystemSource,
): SystemId | undefined {
  if (character.systemId && getGameModule(character.systemId)) {
    return character.systemId;
  }
  // Legacy-файлы/запросы до миграции v2 (📌 D3).
  if (character.gameSystem === 'Dungeons & Dragons') return 'dnd5e';
  if (character.gameSystem === 'Dark Heresy') {
    return character.edition === '2nd' ? 'dh2' : 'dh1';
  }
  return undefined;
}

export function getCharacterModule(
  character: CharacterSystemSource,
): AnyGameModule | undefined {
  const systemId = resolveCharacterSystemId(character);
  return systemId ? getGameModule(systemId) : undefined;
}

export interface SystemNameKeys {
  gameNameKey?: string;
  editionNameKey?: string;
}

export function getSystemNameKeys(
  systemId: SystemId | undefined,
): SystemNameKeys {
  const gameModule = systemId ? getGameModule(systemId) : undefined;
  if (!gameModule) return {};
  return {
    gameNameKey: getGameDefinition(gameModule.gameId)?.nameKey,
    editionNameKey: gameModule.nameKey,
  };
}

export interface CatalogGame {
  game: GameDefinition;
  editions: readonly AnyGameModule[];
}

/** Игры и их редакции в порядке показа (шаг 1–2 мастера создания). */
export function listCatalog(): CatalogGame[] {
  return listGameDefinitions().map((game) => ({
    game,
    editions: listGameModulesForGame(game.id),
  }));
}
