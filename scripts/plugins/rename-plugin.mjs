/**
 * ============================================================================
 *  scripts/plugins/rename-plugin.mjs — переименование копии эталонной
 *  фикстуры в папку нового плагина
 * ============================================================================
 *
 *  Один источник правил для двух потребителей:
 *    • `tests/unit/plugin-template.test.ts` — гейт «папка + манифест =
 *      плагин»: копия фикстуры под чужим id обязана пройти проверки
 *      генератора;
 *    • `npm run plugins:scaffold -- <id>` — та же операция для человека.
 *
 *  Почему отдельный модуль, а не чеклист в docs: правила переименования —
 *  код. Чеклист в `docs/plugin-sdk.md` объясняет, что меняется и зачем,
 *  но применяет изменения этот модуль, иначе гейт и инструкция разъедутся.
 *
 *  Связано: tests/fixtures/example-plugin, docs/plugin-sdk.md (Quick start),
 *           scripts/plugins/generate.mjs
 */

import fs from 'node:fs';
import path from 'node:path';

// `prettier` — devDependency: модуль нужен только инструментам разработчика
// (гейт шаблона и `plugins:scaffold`), а не рантайму приложения.
import prettier from 'prettier';

/** Тот же шаблон, что в `plugin.schema.json#id`. */
export const PLUGIN_ID_RE = /^[a-zA-Z][a-zA-Z0-9]*$/;

/** Текстовая замена; расширения, которые переписываются. */
const TEXT_EXTENSIONS = new Set(['.ts', '.tsx', '.json']);
/** Что не копируется в плагин: тесты шаблона и служебные каталоги. */
const SKIP_DIRS = new Set(['node_modules', '.next', 'tests']);

/**
 * Правила переименования текста фикстуры. Порядок важен: `gameId` идёт до
 * `id`, `example.` — до кавычных форм, иначе часть ключей останется старой.
 *
 * @param {{id: string, gameId: string, gameTitle: string}} options
 * @returns {[string, string][]}
 */
export function renameRules({ id, gameId, gameTitle }) {
  return [
    ['exampleGame', gameId],
    ['Example Game', gameTitle],
    ['exampleModule', `${id}Module`],
    // DOM-идентификаторы и id таблицы BulkEditor: `example-stats`, `example-rank`.
    ['example-', `${id}-`],
    ['example.', `${id}.`],
    ["'example'", `'${id}'`],
    ['"example"', `"${id}"`],
  ];
}

/** `order` шаблона в модуле и таблице BulkEditor — литерал `order: 90`. */
const TEMPLATE_ORDER_RE = /\border: 90\b/g;

/**
 * @param {string} text
 * @param {{id: string, gameId: string, gameTitle: string}} options
 * @returns {string}
 */
export function renameText(text, options) {
  let result = text;
  for (const [from, to] of renameRules(options)) {
    result = result.split(from).join(to);
  }
  if (options.order !== undefined) {
    result = result.replace(TEMPLATE_ORDER_RE, `order: ${options.order}`);
  }
  return result;
}

/**
 * Скопировать плагин-шаблон в `targetDir`, переименовав текст и поправив
 * манифест. Каталог `tests/` шаблона не копируется: тесты хоста живут в
 * `tests/unit`, а не в плагине.
 *
 * @param {{
 *   sourceDir: string,
 *   targetDir: string,
 *   id: string,
 *   gameId: string,
 *   gameTitle?: string,
 *   order?: number,
 *   version?: string,
 *   name?: {en: string, ru: string},
 *   description?: {en: string, ru: string},
 * }} input
 * @returns {Promise<{manifest: any}>} итоговый манифест
 */
export async function renamePlugin(input) {
  const {
    sourceDir,
    targetDir,
    id,
    gameId,
    gameTitle = id,
    order,
    version,
    name,
    description,
  } = input;

  if (!PLUGIN_ID_RE.test(id)) {
    throw new Error(`Некорректный id плагина: "${id}" (нужно ${PLUGIN_ID_RE})`);
  }
  if (!PLUGIN_ID_RE.test(gameId)) {
    throw new Error(`Некорректный gameId: "${gameId}" (нужно ${PLUGIN_ID_RE})`);
  }
  if (!fs.existsSync(sourceDir)) {
    throw new Error(`Нет папки шаблона: ${sourceDir}`);
  }

  const options = { id, gameId, gameTitle, order };

  const copy = (from, to) => {
    fs.mkdirSync(to, { recursive: true });
    for (const entry of fs.readdirSync(from, { withFileTypes: true })) {
      if (entry.isDirectory() && SKIP_DIRS.has(entry.name)) continue;
      const source = path.join(from, entry.name);
      const target = path.join(to, entry.name);
      if (entry.isDirectory()) {
        copy(source, target);
        continue;
      }
      if (!entry.isFile()) continue;
      if (TEXT_EXTENSIONS.has(path.extname(entry.name))) {
        fs.writeFileSync(
          target,
          renameText(fs.readFileSync(source, 'utf8'), options),
        );
        continue;
      }
      fs.copyFileSync(source, target);
    }
  };

  copy(sourceDir, targetDir);

  const manifestPath = path.join(targetDir, 'plugin.json');
  const manifest = JSON.parse(fs.readFileSync(manifestPath, 'utf8'));
  manifest.id = id;
  manifest.gameId = gameId;
  manifest.game = { ...manifest.game, id: gameId };
  if (order !== undefined) {
    manifest.order = order;
    manifest.game.order = order;
  }
  if (version !== undefined) manifest.version = version;
  if (name !== undefined) manifest.name = name;
  if (description !== undefined) manifest.description = description;
  // Манифест пересобирается после правок полей, поэтому форматируем его
  // сразу: в `npm run verify` есть шаг `prettier --check`, и «сырой»
  // JSON.stringify сделал бы новый плагин красным на нём.
  fs.writeFileSync(
    manifestPath,
    await prettier.format(JSON.stringify(manifest), { parser: 'json' }),
  );

  return { manifest };
}
