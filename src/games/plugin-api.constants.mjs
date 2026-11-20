/**
 * ============================================================================
 *  src/games/plugin-api.constants.mjs — единственный источник констант и
 *  чистой логики Plugin API
 * ============================================================================
 *
 *  Файл нарочно `.mjs`, а не `.ts`: генератор реестра
 *  (`scripts/plugins/generate.mjs`) исполняется node без сборки и не может
 *  импортировать TypeScript. Пока значения и `isHostApiCompatible` были
 *  скопированы в `plugin-api.ts` и в генератор, копии уже разошлись
 *  (`PLUGIN_MANIFEST_VERSION`: 1 против 2), а `^0.x.y` тихо трактовался как
 *  `<1.0.0`.
 *
 *  `src/games/plugin-api.ts` только реэкспортирует значения отсюда; типы
 *  (интерфейсы, `PluginUiSlot`) остаются в TS. Логика здесь чистая: без fs,
 *  без DOM, без Next — её импортируют и клиент, и сервер, и генератор.
 *
 *  Связано: src/games/plugin-api.ts, scripts/plugins/generate.mjs,
 *           docs/plugin-sdk.md
 */

/** Версия Plugin API; манифест объявляет совместимый с ней диапазон. */
export const PLUGIN_API_VERSION = '1.4.0';

/** Версия формата манифеста, которую понимает и хост, и генератор. */
export const PLUGIN_MANIFEST_VERSION = 2;

/**
 * Формы диапазона `pluginApi`, которые хост понимает осознанно.
 *
 * Ничего другого не поддерживается: `>`, `<`, `<=`, `1.x`, `=1.2.3` и
 * составные диапазоны (`>=1.0 <2`) отвергаются явно (см.
 * `isHostApiCompatible`). Молчаливая переинтерпретация опаснее отказа: хост
 * объявил бы совместимость, которой не проверял.
 */
export const SUPPORTED_PLUGIN_API_RANGES = [
  '*',
  '1.2.3',
  '^1.2.3',
  '~1.2.3',
  '>=1.2.3',
];

/**
 * Разобрать точку входа `<файл>(#<экспорт>)?`: путь должен быть
 * относительным и оставаться внутри папки плагина.
 *
 * @param {string} entry
 * @returns {{ file: string, member?: string }}
 * @throws {Error} если строка пустая, содержит абсолютный путь, `..` или
 *   больше одного `#`.
 */
export function parseEntryPoint(entry) {
  const [rawFile, member, ...rest] = String(entry ?? '').split('#');
  const file = rawFile?.trim() ?? '';
  if (!file || rest.length > 0) {
    throw new Error(`Некорректная точка входа плагина: "${entry}"`);
  }
  if (file.startsWith('/') || file.split(/[\\/]/).includes('..')) {
    throw new Error(
      `Точка входа должна быть относительным путём внутри плагина: "${entry}"`,
    );
  }
  if (member !== undefined) {
    const trimmed = member.trim();
    if (!/^[A-Za-z_$][A-Za-z0-9_$]*$/.test(trimmed)) {
      throw new Error(`Некорректное имя экспорта в точке входа: "${entry}"`);
    }
    return { file, member: trimmed };
  }
  return { file };
}

/**
 * @param {string} version
 * @returns {{ major: number, minor: number, patch: number } | undefined}
 */
function parseVersion(version) {
  const match = /^(\d+)\.(\d+)\.(\d+)$/.exec(String(version ?? '').trim());
  if (!match) return undefined;
  return {
    major: Number(match[1]),
    minor: Number(match[2]),
    patch: Number(match[3]),
  };
}

/**
 * @param {{ major: number, minor: number, patch: number }} a
 * @param {{ major: number, minor: number, patch: number }} b
 * @returns {number}
 */
function compareVersions(a, b) {
  return a.major - b.major || a.minor - b.minor || a.patch - b.patch;
}

/**
 * Совместим ли диапазон `pluginApi` манифеста с версией хоста.
 *
 * Поддержаны ровно формы из `SUPPORTED_PLUGIN_API_RANGES`. Всё остальное —
 * явный отказ, а не «несовместимо» и тем более не тихая переинтерпретация:
 * `>1.0.0` раньше означало «ровно 1.0.0», `<=2.0.0` — «ровно 2.0.0», а
 * `^0.2.3` — `<1.0.0` вместо `<0.3.0`. Хост не должен объявлять совместимость,
 * которую не проверял: пусть манифест падает на сборке.
 *
 * `^` определён только для мажора >= 1: у npm для `0.x` другая семантика
 * (совместимы патчи, не миноры), и повторять её наполовину хуже, чем отказать.
 *
 * @param {string} range
 * @param {string} [hostVersion]
 * @returns {boolean}
 * @throws {Error} если диапазон записан в неподдержанной форме или версия
 *   хоста не разбирается. Вызывающий обязан показать это как ошибку
 *   манифеста — см. `validateCollection` в генераторе.
 */
export function isHostApiCompatible(range, hostVersion = PLUGIN_API_VERSION) {
  const host = parseVersion(hostVersion);
  if (!host) {
    throw new Error(`Некорректная версия хоста: "${hostVersion}"`);
  }
  const trimmed = String(range ?? '').trim();
  if (trimmed === '*') return true;

  const operator = /^(\^|~|>=)/.exec(trimmed)?.[1] ?? '';
  const body = trimmed.slice(operator.length);
  const expected = parseVersion(body);
  if (!expected) {
    throw new Error(
      `Неподдерживаемый диапазон pluginApi: "${range}". ` +
        `Поддержаны: ${SUPPORTED_PLUGIN_API_RANGES.join(', ')}`,
    );
  }
  if (operator === '^') {
    if (expected.major === 0) {
      throw new Error(
        `Неподдерживаемый диапазон pluginApi: "${range}". ` +
          '`^` определён только для мажорной версии >= 1; ' +
          'для 0.x используйте `~` или точную версию.',
      );
    }
    // ^1.2.3 → та же мажорная версия, не ниже 1.2.3.
    return (
      host.major === expected.major && compareVersions(host, expected) >= 0
    );
  }
  if (operator === '~') {
    return (
      host.major === expected.major &&
      host.minor === expected.minor &&
      compareVersions(host, expected) >= 0
    );
  }
  if (operator === '>=') {
    return compareVersions(host, expected) >= 0;
  }
  return compareVersions(host, expected) === 0;
}
