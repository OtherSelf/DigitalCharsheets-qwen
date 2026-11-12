import { getGameDefinition, listGameDefinitions } from './games';
import type { PluginAlias } from './plugin-api';
import {
  getGameModule,
  listGameModulesForGame,
  listGamePlugins,
  type AnyGameModule,
} from './registry';
import type { GameDefinition, SystemId } from './types';

/**
 * ─── LANDMARK: CHARACTER SYSTEM RESOLUTION ────────────────────────────────
 * Мост между листом и реестром для UI: по `systemId` (или legacy
 * `gameSystem`/`edition`) вернуть модуль и i18n-ключи названий.
 *
 * С этапа 2 ядро не хардкодит «Dungeons & Dragons»/«Dark Heresy»: legacy-имена
 * объявляет сам плагин в `plugin.json#aliases`, а разрешение — это выбор
 * самого специфичного совпадения. Чем больше полей совпало, тем выше
 * приоритет: `{gameSystem, edition: '2nd'}` выигрывает у `{gameSystem}`.
 */
export interface CharacterSystemSource {
  systemId?: string;
  gameSystem?: string;
  /** Legacy 1e/2e marker: используется только до миграции v2 (📌 D3). */
  edition?: string;
}

function aliasMatches(
  alias: PluginAlias,
  source: CharacterSystemSource,
): boolean {
  if (
    alias.gameSystem !== undefined &&
    alias.gameSystem !== source.gameSystem
  ) {
    return false;
  }
  if (alias.edition !== undefined && alias.edition !== source.edition) {
    return false;
  }
  // Пустое правило совпало бы с чем угодно — это ошибка манифеста, не матч.
  return alias.gameSystem !== undefined || alias.edition !== undefined;
}

function aliasSpecificity(alias: PluginAlias): number {
  return (
    (alias.gameSystem !== undefined ? 1 : 0) +
    (alias.edition !== undefined ? 1 : 0)
  );
}

/**
 * Разрешить legacy-лист по алиасам манифестов.
 *
 * @returns `systemId` плагина с самым специфичным совпадением или `undefined`.
 */
export function resolveLegacySystemId(
  source: CharacterSystemSource,
): SystemId | undefined {
  let best: { id: SystemId; score: number } | undefined;
  for (const plugin of listGamePlugins()) {
    for (const alias of plugin.manifest.aliases ?? []) {
      if (!aliasMatches(alias, source)) continue;
      const score = aliasSpecificity(alias);
      if (!best || score > best.score) {
        best = { id: plugin.manifest.id, score };
      }
    }
  }
  return best?.id;
}

export function resolveCharacterSystemId(
  character: CharacterSystemSource,
): SystemId | undefined {
  // Явный systemId авторитетен: если такого плагина нет — это «плагин не
  // установлен», а не повод угадывать редакцию по legacy-полям.
  if (character.systemId) {
    return getGameModule(character.systemId) ? character.systemId : undefined;
  }
  return resolveLegacySystemId(character);
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
