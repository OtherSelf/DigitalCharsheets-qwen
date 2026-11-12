import { getGameDefinition, listGameDefinitions } from './games';
import type { GeneratedPluginRegistration, PluginManifest } from './plugin-api';
import { generatedPlugins } from './registry.generated';
import type { GameDefinition, GameId, GameModule, SystemId } from './types';

/**
 * ─── LANDMARK: GAME REGISTRY ───────────────────────────────────────────────
 * Реестр модулей игр/редакций. Ядро (создание, лист, дашборд, экспорт,
 * админка) работает через этот реестр и не содержит
 * `if (gameSystem === ...)`.
 *
 * Список плагинов больше не правится руками: он генерируется
 * `scripts/plugins/generate.mjs` из манифестов `src/games/<id>/plugin.json` в
 * `./registry.generated.ts`. Добавить игру = добавить папку с манифестом и
 * пересобрать; убрать — удалить папку (реестр просто потеряет запись).
 *
 * Реестр — фабрика (`createGameRegistry`), поэтому тесты могут собрать
 * временный список с фиктивным модулем и доказать, что добавление редакции
 * не требует правок ядра.
 */

/**
 * Модуль с «размытым» типом листа: реестру важен контракт, а не конкретная
 * форма персонажа. Конкретный тип восстанавливает вызывающий код.
 */
export type AnyGameModule = GameModule<any>;

export interface GameRegistry {
  /** Модули в порядке показа (order, затем id). */
  readonly modules: readonly AnyGameModule[];
  get(id: SystemId): AnyGameModule | undefined;
  require(id: SystemId): AnyGameModule;
  list(): readonly AnyGameModule[];
  listForGame(gameId: GameId): readonly AnyGameModule[];
  games(): readonly GameDefinition[];
  getGame(gameId: GameId): GameDefinition | undefined;
}

function sortModules(modules: readonly AnyGameModule[]): AnyGameModule[] {
  return [...modules].sort(
    (a, b) => a.order - b.order || a.id.localeCompare(b.id),
  );
}

/**
 * Собрать реестр из переданных модулей.
 *
 * @throws если два модуля заявили один `id` — это ошибка разработчика,
 *         а не пользовательских данных, поэтому падаем сразу.
 */
export function createGameRegistry(
  modules: readonly AnyGameModule[],
): GameRegistry {
  const seen = new Set<string>();
  for (const gameModule of modules) {
    if (seen.has(gameModule.id)) {
      throw new Error(`Дублирующийся id модуля игры: ${gameModule.id}`);
    }
    seen.add(gameModule.id);
  }

  const sorted = sortModules(modules);
  const byId = new Map<SystemId, AnyGameModule>(
    sorted.map((gameModule) => [gameModule.id, gameModule]),
  );

  return {
    modules: sorted,
    get: (id) => byId.get(id),
    require: (id) => {
      const gameModule = byId.get(id);
      if (!gameModule) throw new Error(`Неизвестный модуль игры: ${id}`);
      return gameModule;
    },
    list: () => sorted,
    listForGame: (gameId) =>
      sorted.filter((gameModule) => gameModule.gameId === gameId),
    games: () => listGameDefinitions(),
    getGame: (gameId) => getGameDefinition(gameId),
  };
}

/**
 * Зарегистрированные плагины: манифест + модуль. Источник —
 * сгенерированный реестр (`npm run plugins:generate`), не ручной список.
 */
export const gamePlugins: readonly GeneratedPluginRegistration[] =
  generatedPlugins;

/** Боевой реестр, собранный из сгенерированного списка плагинов. */
export const gameRegistry = createGameRegistry(
  gamePlugins.map((plugin) => plugin.module),
);

export const getGameModule = (id: SystemId): AnyGameModule | undefined =>
  gameRegistry.get(id);

/** Плагин (манифест + модуль) по `systemId`. */
export const getGamePlugin = (
  id: SystemId,
): GeneratedPluginRegistration | undefined =>
  gamePlugins.find((plugin) => plugin.manifest.id === id);

/** Манифест плагина по `systemId` — источник названий и порядка (D4). */
export const getPluginManifest = (id: SystemId): PluginManifest | undefined =>
  getGamePlugin(id)?.manifest;

export const listGamePlugins = (): readonly GeneratedPluginRegistration[] =>
  gamePlugins;

export const listGameModules = (): readonly AnyGameModule[] =>
  gameRegistry.list();

export const listGameModulesForGame = (
  gameId: GameId,
): readonly AnyGameModule[] => gameRegistry.listForGame(gameId);
