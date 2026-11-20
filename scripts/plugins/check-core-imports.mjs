#!/usr/bin/env node
/**
 * ============================================================================
 *  scripts/plugins/check-core-imports.mjs — гейт «ядро не импортирует игры»
 * ============================================================================
 *
 *  Обратное направление к `check-boundaries.mjs`. Тот следит, чтобы плагин
 *  зависел от ядра только по разрешённому списку. Этого мало: ядро могло
 *  импортировать папку игры напрямую (`@/games/dh2/sheet`), и никакая
 *  проверка этого не видела — purity ищет имена и поля, но не пути импортов.
 *  Такой импорт возвращает зависимость, ради устранения которой существует
 *  весь план: удалить игру станет невозможно без правок ядра.
 *
 *  Что разрешено ядру из `src/games`:
 *    • контрактные модули (`registry*`, `types`, `plugin-api*`, `plugin-host`,
 *      `character-system`, `games*`, `i18n*`, `*.generated`);
 *    • `shared/*` — игронезависимый SDK;
 *   всё, что лежит в папке плагина (`src/games/<id>/…`), — запрещено.
 *  То же правило действует для относительных импортов: путь не должен
 *  разрешаться внутрь папки плагина.
 *
 *  Использование:
 *    npm run plugins:imports            # проверка (шаг npm run verify)
 *    node scripts/plugins/check-core-imports.mjs --json
 *
 *  Связано: scripts/plugins/check-boundaries.mjs, scripts/plugins/boundaries.json,
 *           docs/game-modules.md § Import boundaries, AGENTS.md § 5.
 * ============================================================================
 */
import { readdirSync, readFileSync, statSync } from 'node:fs';
import { dirname, join, relative, resolve, sep } from 'node:path';
import { fileURLToPath } from 'node:url';

const HERE = dirname(fileURLToPath(import.meta.url));
const ROOT = resolve(HERE, '../..');

/** Каталоги ядра, которым нельзя импортировать папки игр. */
export const CORE_DIRS = [
  'src/lib',
  'src/components',
  'src/app',
  'src/context',
  'src/hooks',
  'src/games/shared',
  'src/games/i18n',
];

/**
 * Контрактные модули `src/games` (файлы и папки), которые ядро вправе
 * импортировать: это API хоста, а не конкретная игра.
 */
export const GAMES_CONTRACT = new Set([
  'types',
  'plugin-api',
  'plugin-api.constants',
  'plugin-host',
  'character-system',
  'registry',
  'games',
  'i18n',
  'shared',
]);

const SOURCE_EXTENSIONS = /\.(ts|tsx|mts)$/;

/** Спецификаторы импортов файла (статические, динамические, re-export, require). */
export function extractSpecifiers(source) {
  const patterns = [
    /\bfrom\s+['"]([^'"]+)['"]/g,
    /\bimport\s*\(\s*['"]([^'"]+)['"]\s*\)/g,
    /\bimport\s+['"]([^'"]+)['"]/g,
    /\brequire\s*\(\s*['"]([^'"]+)['"]\s*\)/g,
  ];
  const found = new Set();
  for (const pattern of patterns) {
    for (const match of source.matchAll(pattern)) found.add(match[1]);
  }
  return [...found];
}

function listSourceFiles(dir, root) {
  const found = [];
  let entries = [];
  try {
    entries = readdirSync(dir, { withFileTypes: true });
  } catch {
    return found;
  }
  for (const entry of entries) {
    const full = join(dir, entry.name);
    if (entry.isDirectory()) {
      if (entry.name === 'node_modules' || entry.name === 'tests') continue;
      found.push(...listSourceFiles(full, root));
    } else if (SOURCE_EXTENSIONS.test(entry.name)) {
      found.push(full);
    }
  }
  return found;
}

/** Папки плагинов: подкаталоги `src/games`, где лежит `plugin.json`. */
export function listPluginDirs(root = ROOT) {
  const gamesDir = join(root, 'src/games');
  let entries = [];
  try {
    entries = readdirSync(gamesDir, { withFileTypes: true });
  } catch {
    return [];
  }
  const dirs = [];
  for (const entry of entries) {
    if (!entry.isDirectory()) continue;
    try {
      if (statSync(join(gamesDir, entry.name, 'plugin.json')).isFile()) {
        dirs.push(entry.name);
      }
    } catch {
      // Нет манифеста — это не папка плагина (shared, i18n, generated-файлы).
    }
  }
  return dirs;
}

/**
 * Проверить один спецификатор: вернёт имя плагина, если импорт ведёт в его
 * папку, иначе `null`.
 *
 * @param {string} specifier
 * @param {string} fromFile абсолютный путь файла-источника
 * @param {Set<string>} plugins
 * @returns {string | null}
 */
export function pluginTarget(specifier, fromFile, plugins, root = ROOT) {
  if (specifier.startsWith('@/games/')) {
    const head = specifier.slice('@/games/'.length).split('/')[0];
    if (GAMES_CONTRACT.has(head) || /\.generated$/.test(head)) return null;
    return plugins.has(head) ? head : null;
  }
  if (specifier.startsWith('.')) {
    const target = resolve(dirname(fromFile), specifier);
    for (const plugin of plugins) {
      const pluginDir = resolve(root, 'src/games', plugin);
      if (target === pluginDir || target.startsWith(pluginDir + sep)) {
        return plugin;
      }
    }
  }
  return null;
}

export function checkCoreImports({ root = ROOT } = {}) {
  const plugins = new Set(listPluginDirs(root));
  const files = CORE_DIRS.flatMap((dir) =>
    listSourceFiles(join(root, dir), root),
  );
  const violations = [];
  for (const absolute of files) {
    const file = relative(root, absolute).split('\\').join('/');
    const source = readFileSync(absolute, 'utf8');
    for (const specifier of extractSpecifiers(source)) {
      const plugin = pluginTarget(specifier, absolute, plugins, root);
      if (plugin) violations.push({ file, plugin, specifier });
    }
  }
  return {
    filesScanned: files.length,
    plugins: [...plugins].sort(),
    violations,
  };
}

function main(argv) {
  const flags = new Set(argv);
  const unknown = [...flags].filter(
    (flag) => !['--json', '-h', '--help'].includes(flag),
  );
  if (unknown.length > 0) {
    console.error(`Неизвестный флаг: ${unknown[0]}`);
    return 2;
  }
  if (flags.has('-h') || flags.has('--help')) {
    console.log(`Гейт «ядро не импортирует папки игр».

  npm run plugins:imports   проверить ядро (шаг npm run verify)
  node scripts/plugins/check-core-imports.mjs --json   машиночитаемый отчёт`);
    return 0;
  }

  const result = checkCoreImports();

  if (flags.has('--json')) {
    console.log(JSON.stringify(result, null, 2));
    return result.violations.length > 0 ? 1 : 0;
  }

  if (result.violations.length > 0) {
    console.error('✗ ядро импортирует папки игр:');
    for (const violation of result.violations) {
      console.error(
        `  - ${violation.file}: "${violation.specifier}" (плагин ${violation.plugin})`,
      );
    }
    console.error(
      '  Ядро работает через контракт: @/games/registry, types, plugin-api, plugin-host,',
    );
    console.error(
      '  character-system, games*, i18n*, shared/*. Импорт папки игры — только из её тестов.',
    );
    return 1;
  }

  console.log(
    `✓ импорты ядра: ${result.filesScanned} файлов, плагинов ${result.plugins.length} ` +
      `(${result.plugins.join(', ')}), импортов папок игр 0`,
  );
  return 0;
}

const isMain =
  process.argv[1] &&
  resolve(process.argv[1]) === fileURLToPath(import.meta.url);

if (isMain) {
  process.exitCode = main(process.argv.slice(2));
}
