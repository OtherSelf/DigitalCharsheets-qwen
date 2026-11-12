#!/usr/bin/env node
/**
 * ============================================================================
 *  scripts/plugins/check-boundaries.mjs — границы импортов игровых плагинов
 * ============================================================================
 *
 *  Плагин игры (`src/games/<id>/`) должен зависеть от ядра только через
 *  разрешённый список. Правила лежат рядом, в `scripts/plugins/boundaries.json`:
 *
 *    forbidden  — то, что нельзя импортировать никогда (Next.js app router,
 *                 серверные модули Node, запись в data-dir);
 *    allowed    — то, что разрешено всегда (UI-кит, plugin API, i18n, React,
 *                 zod, иконки, радикс-примитивы);
 *    legacy     — долг этапа 0: импорты ядра, которые ещё остались в модулях и
 *                 будут убраны на этапах 2–3. Здесь важно не «разрешить», а
 *                 зафиксировать: число файлов на каждый модуль может только
 *                 уменьшаться.
 *
 *  Почему отдельный скрипт, а не правило ESLint: нужен «храповик» — точный
 *  счётчик файлов на каждый legacy-импорт, который падает и при росте, и при
 *  неубранной записи после сокращения. Такое состояние ESLint не хранит.
 *
 *  Что проверяется:
 *    1. `forbidden` — точное совпадение или маска `*`;
 *    2. относительные импорты: обязаны оставаться внутри `src/games/` и в
 *       пределах СВОЕГО плагина (кросс-плагинные импорты запрещены);
 *    3. `allowed` — маски `*` разрешены;
 *    4. `legacy` — счётчик файлов: больше — ошибка (новая зависимость),
 *       меньше — ошибка (запись устарела, запустите `--update`).
 *
 *  Использование:
 *    npm run plugins:boundaries            # проверка (этот же вызов в verify)
 *    npm run plugins:boundaries -- --update   # пересчитать счётчики legacy
 *    npm run plugins:boundaries -- --json     # машиночитаемый отчёт
 *
 *  Связано: scripts/predeploy.sh (шаг «линт»), docs/game-modules.md § Rules,
 *           _NEW_FUTURE2_PROMPT.md § 5.1 (правила импортов плагина).
 * ============================================================================
 */
import { readdirSync, readFileSync, writeFileSync } from 'node:fs';
import { dirname, join, relative, resolve, sep } from 'node:path';
import { fileURLToPath } from 'node:url';

const HERE = dirname(fileURLToPath(import.meta.url));
const ROOT = resolve(HERE, '../..');
const GAMES_DIR = join(ROOT, 'src/games');
const CONFIG_PATH = join(ROOT, 'scripts/plugins/boundaries.json');

/** Каталоги `src/games/*`, которые являются ядром, а не плагинами. */
const CORE_GAMES_DIRS = new Set(['shared', 'i18n']);

/** Расширения, в которых ищем импорты. */
const SOURCE_EXTENSIONS = ['.ts', '.tsx', '.mts'];

// ────────────────────────────────────────────────────────────────────────────
//  Чистые функции (их же использует tests/unit/plugin-boundaries.test.ts)
// ────────────────────────────────────────────────────────────────────────────

/**
 * Спецификаторы импортов файла: `import x from 'a'`, `import 'a'`,
 * `import('a')`, `export … from 'a'`, `require('a')`.
 *
 * Повтор одного и того же модуля в файле считается один раз — счётчики в
 * конфиге означают «сколько файлов плагинов импортируют модуль».
 *
 * @param {string} source
 * @returns {string[]}
 */
export function extractSpecifiers(source) {
  const patterns = [
    /\bfrom\s+['"]([^'"]+)['"]/g,
    /\bimport\s*\(\s*['"]([^'"]+)['"]\s*\)/g,
    /\bimport\s+['"]([^'"]+)['"]/g,
    /\brequire\s*\(\s*['"]([^'"]+)['"]\s*\)/g,
  ];
  const found = new Set();
  for (const pattern of patterns) {
    for (const match of source.matchAll(pattern)) {
      const specifier = match[1].trim();
      if (specifier) found.add(specifier);
    }
  }
  return [...found];
}

/** Относительный ли спецификатор (`./x`, `../x`, `/x`). */
export function isRelativeSpecifier(specifier) {
  return (
    specifier.startsWith('./') ||
    specifier.startsWith('../') ||
    specifier === '.' ||
    specifier === '..' ||
    specifier.startsWith('/')
  );
}

/**
 * Совпадает ли спецификатор с маской. Поддерживается `*` (любая подстрока):
 * `@/components/ui/*`, `next/*`, `@/app*`.
 *
 * @param {string} specifier
 * @param {string} pattern
 */
export function matchesPattern(specifier, pattern) {
  if (specifier === pattern) return true;
  if (!pattern.includes('*')) return false;
  const escaped = pattern
    .split('*')
    .map((part) => part.replace(/[.*+?^${}()|[\]\\]/g, '\\$&'))
    .join('.*');
  return new RegExp(`^${escaped}$`).test(specifier);
}

/**
 * Лежит ли путь внутри каталога (по сегментам, а не по префиксу строки).
 *
 * @param {string} parent
 * @param {string} child
 */
export function isInside(parent, child) {
  const rel = relative(parent, child);
  return rel === '' || (!rel.startsWith('..') && !rel.startsWith(sep));
}

/**
 * Проверка одного набора импортов против конфига.
 *
 * @param {{
 *   root?: string,
 *   gamesDir?: string,
 *   plugins: Record<string, string[]>,   // id плагина → абсолютные пути файлов
 *   config: { forbidden: {pattern: string, hint: string}[], allowed: string[],
 *             legacy: Record<string, {files: number, removeBy?: string|null,
 *             why?: string}> },
 * }} input
 * @returns {{
 *   errors: {file: string, specifier: string, message: string}[],
 *   counts: Record<string, number>,
 *   newLegacy: string[],
 *   staleLegacy: string[],
 * }}
 */
export function evaluateBoundaries({ gamesDir = GAMES_DIR, plugins, config }) {
  const errors = [];
  const counts = {};
  const forbidden = config.forbidden ?? [];
  const allowed = config.allowed ?? [];
  const legacy = config.legacy ?? {};
  const pluginIds = Object.keys(plugins);

  for (const [pluginId, files] of Object.entries(plugins)) {
    for (const absolute of files) {
      const file = isInside(ROOT, absolute)
        ? relative(ROOT, absolute)
        : absolute;
      const source = readFileSync(absolute, 'utf8');
      for (const specifier of extractSpecifiers(source)) {
        // 1. Абсолютно запрещённое.
        const ban = forbidden.find((rule) =>
          matchesPattern(specifier, rule.pattern),
        );
        if (ban) {
          errors.push({
            file,
            specifier,
            message: ban.hint,
          });
          continue;
        }

        // 2. Относительные пути: только внутри своего плагина.
        if (isRelativeSpecifier(specifier)) {
          const target = resolve(dirname(absolute), specifier);
          if (!isInside(gamesDir, target)) {
            errors.push({
              file,
              specifier,
              message:
                'относительный импорт выходит за пределы src/games — ' +
                'импортируйте ядро через @/… (см. allowed в boundaries.json)',
            });
            continue;
          }
          const other = pluginIds.find(
            (id) => id !== pluginId && isInside(join(gamesDir, id), target),
          );
          if (other) {
            errors.push({
              file,
              specifier,
              message: `кросс-плагинный импорт: ${pluginId} не может зависеть от ${other} (редакции независимы, D10)`,
            });
          }
          continue;
        }

        // 3. Разрешённые модули.
        if (allowed.some((pattern) => matchesPattern(specifier, pattern))) {
          continue;
        }

        // 4. Долг этапа 0 (только сокращается). Считаем все «прочие»
        // импорты, чтобы `--update` мог занести новый долг в конфиг, а в
        // обычном режиме такой импорт остался ошибкой.
        counts[specifier] = (counts[specifier] ?? 0) + 1;
        if (!Object.hasOwn(legacy, specifier)) {
          errors.push({
            file,
            specifier,
            message:
              'импорт не разрешён плагину: добавьте модуль в allowed ' +
              '(если это часть Plugin API) или в legacy с обоснованием ' +
              '(если это временный долг этапа 2–3)',
          });
        }
      }
    }
  }

  const newLegacy = [];
  const staleLegacy = [];
  for (const [specifier, entry] of Object.entries(legacy)) {
    const actual = counts[specifier] ?? 0;
    const expected = entry.files ?? 0;
    if (actual > expected) {
      newLegacy.push(specifier);
      errors.push({
        file: 'scripts/plugins/boundaries.json',
        specifier,
        message:
          `новая зависимость: ${actual} файл(ов) импортируют модуль, ` +
          `в legacy записано ${expected}. Плагинам это не разрешено; ` +
          'если долг осознанно расширяется — npm run plugins:boundaries -- --update',
      });
    } else if (actual < expected) {
      staleLegacy.push(specifier);
      errors.push({
        file: 'scripts/plugins/boundaries.json',
        specifier,
        message:
          `долг сократился: осталось ${actual} файл(ов) из ${expected}. ` +
          'Обновите счётчик: npm run plugins:boundaries -- --update',
      });
    }
  }

  return { errors, counts, newLegacy, staleLegacy };
}

// ────────────────────────────────────────────────────────────────────────────
//  Файловая система
// ────────────────────────────────────────────────────────────────────────────

/**
 * Файлы исходников плагина (рекурсивно).
 *
 * @param {string} dir
 * @param {string[]} [acc]
 * @returns {string[]}
 */
export function listSourceFiles(dir, acc = []) {
  for (const entry of readdirSync(dir, { withFileTypes: true })) {
    const absolute = join(dir, entry.name);
    if (entry.isDirectory()) {
      listSourceFiles(absolute, acc);
    } else if (SOURCE_EXTENSIONS.some((ext) => entry.name.endsWith(ext))) {
      acc.push(absolute);
    }
  }
  return acc;
}

/**
 * Плагины по файловой системе: `src/games/<id>/index.ts` → id.
 *
 * @param {string} [gamesDir]
 * @returns {Record<string, string[]>}
 */
export function collectPlugins(gamesDir = GAMES_DIR) {
  const dirs = readdirSync(gamesDir, { withFileTypes: true })
    .filter((entry) => entry.isDirectory())
    .map((entry) => entry.name);
  const plugins = {};
  for (const name of dirs) {
    if (CORE_GAMES_DIRS.has(name)) continue;
    const index = join(gamesDir, name, 'index.ts');
    let files;
    try {
      files = listSourceFiles(join(gamesDir, name));
    } catch {
      continue;
    }
    if (files.some((file) => file === index)) {
      plugins[name] = files;
    }
  }
  return plugins;
}

/** @param {string} [configPath] */
export function readConfig(configPath = CONFIG_PATH) {
  return JSON.parse(readFileSync(configPath, 'utf8'));
}

/** @param {unknown} config @param {string} [configPath] */
export function writeConfig(config, configPath = CONFIG_PATH) {
  const ordered = {
    ...config,
    legacy: Object.fromEntries(
      Object.entries(config.legacy ?? {}).sort(([a], [b]) =>
        a.localeCompare(b, 'en'),
      ),
    ),
  };
  writeFileSync(configPath, `${JSON.stringify(ordered, null, 2)}\n`, 'utf8');
}

// ────────────────────────────────────────────────────────────────────────────
//  CLI
// ────────────────────────────────────────────────────────────────────────────

function parseArgs(argv) {
  const flags = { update: false, json: false };
  for (const arg of argv) {
    if (arg === '--update') flags.update = true;
    else if (arg === '--json') flags.json = true;
    else if (arg === '-h' || arg === '--help') flags.help = true;
    else throw new Error(`Неизвестный флаг: ${arg}`);
  }
  return flags;
}

function printHelp() {
  console.log(`Проверка границ импортов игровых плагинов.

  npm run plugins:boundaries              проверить (как в npm run verify)
  npm run plugins:boundaries -- --update  пересчитать счётчики legacy
  npm run plugins:boundaries -- --json    отчёт в JSON

Правила: scripts/plugins/boundaries.json
Документация: docs/game-modules.md § Rules`);
}

function main(argv) {
  const flags = parseArgs(argv);
  if (flags.help) {
    printHelp();
    return 0;
  }

  const config = readConfig();
  const plugins = collectPlugins();
  const report = evaluateBoundaries({ plugins, config });

  if (flags.update) {
    for (const [specifier, count] of Object.entries(report.counts)) {
      const entry = config.legacy[specifier] ?? { files: 0 };
      entry.files = count;
      entry.removeBy ??= null;
      config.legacy[specifier] = entry;
    }
    for (const specifier of Object.keys(config.legacy)) {
      if (!report.counts[specifier]) delete config.legacy[specifier];
    }
    config.legacy = Object.fromEntries(
      Object.entries(config.legacy).sort(([a], [b]) =>
        a.localeCompare(b, 'en'),
      ),
    );
    writeConfig(config);
    const added = Object.entries(config.legacy).filter(
      ([, entry]) => entry.removeBy == null,
    );
    console.log(
      `boundaries: счётчики legacy обновлены (${Object.keys(config.legacy).length} записей).`,
    );
    for (const specifier of report.newLegacy) {
      console.log(
        `  + ${specifier}: долг вырос (проверьте, что это осознанно)`,
      );
    }
    for (const specifier of report.staleLegacy) {
      console.log(`  - ${specifier}: долг сократился`);
    }
    if (added.length) {
      console.log(
        'У новых записей нет поля removeBy — укажите этап, на котором долг уйдёт:',
      );
      for (const [specifier] of added) console.log(`  - ${specifier}`);
    }
    return 0;
  }

  if (flags.json) {
    console.log(
      JSON.stringify(
        {
          plugins: Object.fromEntries(
            Object.entries(plugins).map(([id, files]) => [id, files.length]),
          ),
          errors: report.errors,
          legacy: report.counts,
        },
        null,
        2,
      ),
    );
    return report.errors.length ? 1 : 0;
  }

  for (const error of report.errors) {
    console.error(`✗ ${error.file}: ${error.specifier}`);
    console.error(`  ${error.message}`);
  }

  const pluginList = Object.entries(plugins)
    .map(([id, files]) => `${id} (${files.length} файлов)`)
    .join(', ');
  if (report.errors.length) {
    console.error(
      `\nboundaries: ${report.errors.length} нарушений · плагины: ${pluginList}`,
    );
    return 1;
  }
  console.log(`✓ boundaries: правила импортов соблюдены · ${pluginList}`);
  return 0;
}

const isMain =
  process.argv[1] &&
  resolve(process.argv[1]) === fileURLToPath(import.meta.url);

if (isMain) {
  try {
    process.exitCode = main(process.argv.slice(2));
  } catch (error) {
    console.error(`boundaries: ${error.message}`);
    process.exitCode = 1;
  }
}
