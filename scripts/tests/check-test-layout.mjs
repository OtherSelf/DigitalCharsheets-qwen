#!/usr/bin/env node
/**
 * ============================================================================
 *  scripts/tests/check-test-layout.mjs — раскладка unit-тестов
 * ============================================================================
 *
 *  Два правила, которые нельзя увидеть в браузере и в tsc:
 *
 *    1. лимит 400 строк на `tests/unit/**\/*.test.ts` — иначе один файл снова
 *       превращается в «api-routes на 1 500 строк» и ревью перестаёт видеть
 *       границы. Исключения — явный список с причиной и потолком (храповик:
 *       больше потолка нельзя, меньше — можно);
 *    2. тест одной редакции не живёт в хосте. Если файл импортирует модули
 *       ровно одной игры (`@/games/<id>/…`, кроме манифеста `.json`), он
 *       должен лежать в `src/games/<id>/tests/unit/`: иначе следующая игра
 *       снова начнёт править `tests/unit`. Тест, импортирующий две редакции
 *       (паритет DH1/DH2), — наоборот, host-level (D14).
 *
 *  Использование:
 *    npm run test:layout            # проверка (шаг verify)
 *    node scripts/tests/check-test-layout.mjs --json
 *
 *  Связано: vitest.config.ts, docs/testing.md, _NEW_TESTING_PROMPT.md D6/D11.
 * ============================================================================
 */
import { readdirSync, readFileSync, statSync } from 'node:fs';
import { dirname, join, relative, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

const ROOT = resolve(dirname(fileURLToPath(import.meta.url)), '../..');
const UNIT_DIR = join(ROOT, 'tests/unit');
const GAMES_DIR = join(ROOT, 'src/games');
const LIMIT = 400;
const CORE_GAMES_DIRS = new Set(['shared', 'i18n']);

/**
 * Исключения из лимита. Потолок фиксирует текущий размер: файл может только
 * уменьшаться. `removeBy` — когда исключение должно исчезнуть.
 */
const EXCEPTIONS = {
  'history-labels.test.ts': {
    max: 569,
    reason:
      'таблица меток истории: строки-данные, дробление разрежет одну таблицу на части',
  },
  'security.test.ts': {
    max: 415,
    reason: 'сквозной сценарий безопасности; проверки связаны общим контекстом',
  },
  'plugins-registry.test.ts': {
    max: 514,
    reason:
      'conformance-раннер плагинов; заменяется авто-обнаружением на этапе 5',
    removeBy: 'этап 5',
  },
};

function walk(dir, acc = []) {
  for (const entry of readdirSync(dir, { withFileTypes: true })) {
    const absolute = join(dir, entry.name);
    if (entry.isDirectory()) walk(absolute, acc);
    else if (entry.isFile() && entry.name.endsWith('.test.ts'))
      acc.push(absolute);
  }
  return acc;
}

/** Игровые плагины — по папкам с исходниками, а не по списку в скрипте. */
function gameIds() {
  return new Set(
    readdirSync(GAMES_DIR, { withFileTypes: true })
      .filter(
        (entry) => entry.isDirectory() && !CORE_GAMES_DIRS.has(entry.name),
      )
      .map((entry) => entry.name),
  );
}

const GAME_IMPORT_RE = /['"]@\/games\/([^/'"]+)\/([^'"]+)['"]/g;

/** id игр, чьи модули (не манифесты) импортирует файл. */
function importedGames(source, ids) {
  const found = new Set();
  for (const match of source.matchAll(GAME_IMPORT_RE)) {
    const [, id, rest] = match;
    if (!ids.has(id)) continue;
    if (rest === 'plugin.json') continue;
    found.add(id);
  }
  return found;
}

const result = { files: 0, errors: [] };

for (const absolute of walk(UNIT_DIR)) {
  const name = relative(UNIT_DIR, absolute);
  const base = absolute.split(/[\\/]/).pop();
  const source = readFileSync(absolute, 'utf8');
  const lines = source.split('\n');
  if (lines.at(-1) === '') lines.pop();
  result.files += 1;

  const exception = EXCEPTIONS[base];
  if (lines.length > LIMIT) {
    if (!exception) {
      result.errors.push(
        `${name}: ${lines.length} строк > ${LIMIT}. Разделите файл по домену ` +
          '(tests/unit/<domain>/) или добавьте исключение с причиной в ' +
          'scripts/tests/check-test-layout.mjs.',
      );
    } else if (lines.length > exception.max) {
      result.errors.push(
        `${name}: ${lines.length} строк > потолка исключения ${exception.max}. ` +
          'Исключение не разрешает рост.',
      );
    }
  } else if (exception) {
    result.errors.push(
      `${name}: ${lines.length} строк ≤ ${LIMIT}, исключение больше не нужно — ` +
        'удалите его из scripts/tests/check-test-layout.mjs.',
    );
  }

  const games = importedGames(source, gameIds());
  if (games.size === 1) {
    const [game] = games;
    result.errors.push(
      `${name}: тест одной редакции (${game}) должен лежать в ` +
        `src/games/${game}/tests/unit/. Кросс-эдишн тест импортирует две игры.`,
    );
  }
}

if (process.argv.includes('--json')) {
  console.log(JSON.stringify(result, null, 2));
} else if (result.errors.length > 0) {
  console.error('✗ раскладка тестов:');
  for (const error of result.errors) console.error(`  - ${error}`);
} else {
  console.log(
    `✓ раскладка тестов: ${result.files} файлов в tests/unit, лимит ${LIMIT} строк соблюдён, ` +
      'тестов одной редакции в хосте нет',
  );
}

process.exit(result.errors.length > 0 ? 1 : 0);
