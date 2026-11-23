/**
 * ============================================================================
 *  scripts/plugins/lib/manifests.mjs — чтение манифестов и игровые токены
 * ============================================================================
 *
 *  Единственное место, где скрипты узнают «какие игры есть в сборке»:
 *  `src/games/<id>/plugin.json`. Генератор, гейты чистоты ядра и раскладки
 *  тестов читают один и тот же список, поэтому новый плагин подхватывается
 *  без правки скриптов, а удалённый — исчезает.
 *
 *  Токены разделены на два набора:
 *
 *    • `names` — всё, что ядро не должно знать: id, gameId, shortCode,
 *      отображаемые имена игры/плагина и legacy-алиасы. Используется
 *      `check-core-purity`;
 *    • `mentions` — что считается «игровым упоминанием» в host-тестах:
 *      id, shortCode и отображаемые имена опубликованных плагинов. `gameId`
 *      сюда не входит: `dnd`/`darkHeresy` встречаются в путях и именах
 *      переменных (`dndId`), и ratchet утонул бы в ложных срабатываниях.
 *      Тестовые плагины (`sandbox`, `example`) исключены: их имена — часть
 *      тестовой инфраструктуры, а не поставляемой игры.
 *
 *  Использование:
 *    import { collectManifests, gameTokens } from './lib/manifests.mjs';
 *
 *  Связано: scripts/plugins/generate.mjs,
 *           scripts/plugins/check-core-purity.mjs,
 *           scripts/tests/check-test-layout.mjs.
 * ============================================================================
 */
import { existsSync, readdirSync, readFileSync } from 'node:fs';
import { join } from 'node:path';

/** Каталоги `src/games/*`, которые являются ядром, а не плагинами. */
export const CORE_GAMES_DIRS = new Set(['shared', 'i18n']);

export const MANIFEST_FILE = 'plugin.json';

/**
 * Собрать манифесты плагинов (папки с `plugin.json`).
 *
 * @param {string} gamesDir
 * @returns {{dirName: string, dir: string, manifest: any}[]}
 */
export function collectManifests(gamesDir) {
  const result = [];
  for (const entry of readdirSync(gamesDir, { withFileTypes: true })) {
    if (!entry.isDirectory() || CORE_GAMES_DIRS.has(entry.name)) continue;
    const dir = join(gamesDir, entry.name);
    const manifestPath = join(dir, MANIFEST_FILE);
    if (!existsSync(manifestPath)) continue;
    let manifest;
    try {
      manifest = JSON.parse(readFileSync(manifestPath, 'utf8'));
    } catch (error) {
      throw new Error(`${manifestPath}: некорректный JSON — ${error.message}`);
    }
    result.push({ dirName: entry.name, dir, manifest });
  }
  return result.sort((a, b) => a.dirName.localeCompare(b.dirName, 'en'));
}

/** Уникальные непустые строки в стабильном порядке. */
function uniqueSorted(values) {
  return [
    ...new Set(values.filter((value) => typeof value === 'string' && value)),
  ].sort((a, b) => a.localeCompare(b, 'en'));
}

/** Значения локализованного текста (`{en, ru, …}`). */
function localizedValues(text) {
  return Object.values(text ?? {}).filter(
    (value) => typeof value === 'string' && value,
  );
}

/**
 * Игровые токены сборки.
 *
 * @param {string} gamesDir
 * @returns {{ids: string[], shortCodes: string[], names: string[], mentions: string[]}}
 */
export function gameTokens(gamesDir) {
  const ids = [];
  const shortCodes = [];
  const names = [];
  const mentions = [];

  for (const { manifest } of collectManifests(gamesDir)) {
    if (!manifest.id) continue;
    ids.push(manifest.id);
    names.push(manifest.id);
    if (manifest.shortCode) {
      shortCodes.push(manifest.shortCode);
      names.push(manifest.shortCode);
    }
    if (manifest.gameId) names.push(manifest.gameId);
    names.push(...localizedValues(manifest.game?.name));
    names.push(...localizedValues(manifest.name));
    for (const alias of manifest.aliases ?? []) {
      if (alias?.gameSystem) names.push(alias.gameSystem);
    }

    // Ratchet host-тестов считает только поставляемые игры: тестовый плагин
    // (`sandbox`) и эталонная фикстура живут в тестовой инфраструктуре.
    if (manifest.defaultStatus !== 'published') continue;
    mentions.push(manifest.id);
    if (manifest.shortCode) mentions.push(manifest.shortCode);
    mentions.push(...localizedValues(manifest.game?.name));
    for (const alias of manifest.aliases ?? []) {
      if (alias?.gameSystem) mentions.push(alias.gameSystem);
    }
  }

  return {
    ids: uniqueSorted(ids),
    shortCodes: uniqueSorted(shortCodes),
    names: uniqueSorted(names),
    mentions: uniqueSorted(mentions),
  };
}

/**
 * Альтернативы для регулярного выражения: длинные первыми, чтобы `dh1e`
 * не распадался на `dh1` + `e`, и с экранированием спецсимволов.
 *
 * @param {Iterable<string>} tokens
 * @returns {string}
 */
export function tokenAlternation(tokens) {
  return uniqueSorted([...tokens])
    .sort((a, b) => b.length - a.length || a.localeCompare(b, 'en'))
    .map((token) => token.replace(/[.*+?^${}()|[\]\\]/g, '\\$&'))
    .join('|');
}
