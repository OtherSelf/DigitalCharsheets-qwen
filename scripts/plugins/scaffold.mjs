/**
 * ============================================================================
 *  scripts/plugins/scaffold.mjs — новый плагин из эталонной фикстуры
 * ============================================================================
 *
 *  `npm run plugins:scaffold -- <id> [--game <gameId>] [--order <n>]
 *                                [--title <en>] [--title-ru <ru>]`
 *
 *  Копирует `tests/fixtures/example-plugin` в `src/games/<id>/`, применяя те
 *  же правила переименования, что и гейт `tests/unit/plugin-template.test.ts`
 *  (общий модуль `rename-plugin.mjs`), и пересобирает реестр — после команды
 *  `npm run plugins:check` и `prettier --check` уже зелёные.
 *
 *  Что остаётся человеку: типы/схема/лист/форма своей игры. Список полей,
 *  которые нельзя забыть, — `docs/plugin-sdk.md` § Renaming the template.
 *
 *  Связано: scripts/plugins/rename-plugin.mjs, scripts/plugins/generate.mjs,
 *           docs/plugin-sdk.md
 */

import { spawnSync } from 'node:child_process';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

import { PLUGIN_ID_RE, renamePlugin } from './rename-plugin.mjs';

const APP_DIR = path.resolve(
  path.dirname(fileURLToPath(import.meta.url)),
  '../..',
);
const GAMES_DIR = path.join(APP_DIR, 'src/games');
const TEMPLATE_DIR = path.join(APP_DIR, 'tests/fixtures/example-plugin');

function usage(message) {
  if (message) console.error(`✗ ${message}\n`);
  console.error(
    'Использование: npm run plugins:scaffold -- <id> [--game <gameId>] ' +
      '[--order <n>] [--title <en>] [--title-ru <ru>]',
  );
  process.exit(1);
}

function parseArgs(argv) {
  const [id, ...rest] = argv;
  if (!id) usage('нужен id плагина');
  if (!PLUGIN_ID_RE.test(id)) {
    usage(`некорректный id "${id}": нужен ${PLUGIN_ID_RE}`);
  }
  const options = { id };
  for (let index = 0; index < rest.length; index += 1) {
    const flag = rest[index];
    const value = rest[index + 1];
    if (!value) usage(`флаг ${flag} требует значения`);
    index += 1;
    if (flag === '--game') options.gameId = value;
    else if (flag === '--order') options.order = Number(value);
    else if (flag === '--title') options.title = value;
    else if (flag === '--title-ru') options.titleRu = value;
    else usage(`неизвестный флаг ${flag}`);
  }
  return options;
}

/** Следующий свободный order: максимум по манифестам + 10. */
function nextOrder() {
  const orders = fs
    .readdirSync(GAMES_DIR, { withFileTypes: true })
    .filter((entry) => entry.isDirectory())
    .map((entry) => path.join(GAMES_DIR, entry.name, 'plugin.json'))
    .filter((file) => fs.existsSync(file))
    .map((file) => JSON.parse(fs.readFileSync(file, 'utf8')).order);
  return (orders.length > 0 ? Math.max(...orders) : 0) + 10;
}

const options = parseArgs(process.argv.slice(2));
const targetDir = path.join(GAMES_DIR, options.id);

if (fs.existsSync(targetDir)) {
  usage(`папка ${path.relative(APP_DIR, targetDir)} уже существует`);
}

const gameId = options.gameId ?? `${options.id}Game`;
if (!PLUGIN_ID_RE.test(gameId)) {
  usage(`некорректный gameId "${gameId}": нужен ${PLUGIN_ID_RE}`);
}
const order = options.order ?? nextOrder();
if (!Number.isInteger(order) || order < 0) {
  usage(`некорректный order: ${options.order}`);
}
const title = options.title ?? options.id;
const titleRu = options.titleRu ?? title;

const { manifest } = await renamePlugin({
  sourceDir: TEMPLATE_DIR,
  targetDir,
  id: options.id,
  gameId,
  gameTitle: title,
  order,
  version: '0.1.0',
  name: { en: title, ru: titleRu },
  description: {
    en: `${title} — game plugin`,
    ru: `${titleRu} — плагин игры`,
  },
});

const generate = spawnSync(process.execPath, ['scripts/plugins/generate.mjs'], {
  cwd: APP_DIR,
  stdio: 'inherit',
});
if (generate.status !== 0) {
  console.error('✗ генерация реестра упала — почините манифест и повторите');
  process.exit(generate.status ?? 1);
}

console.log(`
✓ Плагин ${manifest.id} создан: ${path.relative(APP_DIR, targetDir)}
  следующие шаги:
    1. типы/схема/лист/форма: src/games/${manifest.id}/
    2. docs/plugin-sdk.md § Renaming the template — поля, которые нельзя забыть
    3. npm run verify
`);
