/**
 * Минимальные валидные персонажи для тестов хоста.
 *
 * `makeCharacter(systemId, overrides)` — единственная фабрика: лист собирает
 * сам плагин через `createDefaults`, поэтому хост не знает полей редакций и не
 * ломается при удалении или добавлении игры. Сценарий передаёт только те
 * данные, которые проверяет; всё остальное — контрактный дефолт плагина.
 *
 * `createDemo` остаётся для `/demo`: это витрина, а не заготовка теста.
 */

import { getGamePlugin, listGamePlugins } from '@/games/registry';
import type { SystemId } from '@/games/types';

/**
 * Валидный лист любой зарегистрированной редакции: поля берутся из
 * `createDefaults()` плагина, хост добавляет только служебные `id`/`userId`.
 *
 * @throws если такого плагина нет в сборке — тест должен падать явно, а не
 *   проверять пустой объект
 */
export function makeCharacter(
  systemId: string,
  overrides: Record<string, any> = {},
): any {
  const entry = getGamePlugin(systemId as SystemId);
  if (!entry) {
    throw new Error(`makeCharacter: нет плагина ${systemId} в сборке`);
  }
  return {
    ...entry.module.createDefaults({ name: 'Test Character', ...overrides }),
    id: `${systemId}-fixture`,
    userId: 'user-test',
    systemId,
    ...overrides,
  };
}

/** Есть ли плагин в этой сборке (редакцию могли удалить из репозитория). */
export function hasPlugin(systemId: string): boolean {
  return getGamePlugin(systemId as SystemId) !== undefined;
}

/** Идентификаторы плагинов текущей сборки — для итерации без списка игр. */
export function pluginIds(): string[] {
  return listGamePlugins().map((entry) => entry.manifest.id);
}
