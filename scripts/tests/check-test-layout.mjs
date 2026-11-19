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
 *       (паритет DH1/DH2), — наоборот, host-level.
 *
 *  Использование:
 *    npm run test:layout            # проверка (шаг verify)
 *    node scripts/tests/check-test-layout.mjs --json
 *
 *  Связано: vitest.config.ts, docs/testing.md.
 * ============================================================================
 */
import { readdirSync, readFileSync, statSync } from 'node:fs';
import { dirname, join, relative, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

const ROOT = resolve(dirname(fileURLToPath(import.meta.url)), '../..');
const UNIT_DIR = join(ROOT, 'tests/unit');
const VISUAL_DIR = join(ROOT, 'tests/visual');
const SUPPORT_DIR = join(ROOT, 'tests/support');
const GAMES_DIR = join(ROOT, 'src/games');
const LIMIT = 400;
const CORE_GAMES_DIRS = new Set(['shared', 'i18n']);

/**
 * Игровые упоминания в `tests/visual` и `tests/support`: сценарий одной
 * редакции должен жить в `src/games/<id>/tests/`, но пока часть общих спеков
 * упоминает игры напрямую. Храповик фиксирует текущее число: больше нельзя,
 * меньше — можно. `removeBy` — срок, к которому файл переезжает.
 *
 * Счёт — вхождения идентификаторов и строк (`Dungeons`, `dnd5e`,
 * `makeDndCharacter`, `sheet-dnd-…`), а не строки: имя селектора и имя
 * фикстуры одинаково важны.
 */
const GAME_MENTION_ALLOWANCE = {
  'tests/visual/pages.spec.ts': {
    max: 23,
    reason:
      'общие страницы проверяются на живых играх; сценарии редакций переезжают в плагины',
    removeBy: 'этап 8 трекера плагинов',
  },
  'tests/visual/dialogs.spec.ts': {
    max: 7,
    reason: 'диалоги листов DH/D&D снимаются из общего спека',
    removeBy: 'этап 8 трекера плагинов',
  },
  'tests/visual/i18n-raw.spec.ts': {
    max: 6,
    reason: 'сырые ключи словарей проверяются на реальных редакциях',
    removeBy: 'этап 8 трекера плагинов',
  },
  'tests/support/fixtures.ts': {
    max: 6,
    reason:
      'makeDndCharacter/makeDhCharacter — тест-кит хоста; +1 (systemId в DH-фикстуре) ' +
      'осознанно после ADR 0004: лист без редакции больше не угадывается',
    removeBy: 'этап 8 трекера плагинов',
  },
  'tests/visual/admin.spec.ts': {
    max: 4,
    reason: 'админка проверяется на листах двух редакций',
    removeBy: 'этап 8 трекера плагинов',
  },
  'tests/visual/form-validation.spec.ts': {
    max: 4,
    reason: 'валидация формы проверяется на живых редакциях',
    removeBy: 'этап 8 трекера плагинов',
  },
  'tests/visual/history.spec.ts': {
    max: 4,
    reason: 'история листа проверяется на живых редакциях',
    removeBy: 'этап 8 трекера плагинов',
  },
  'tests/visual/basic-pages.spec.ts': {
    max: 3,
    reason: 'базовые страницы используют листы редакций',
    removeBy: 'этап 8 трекера плагинов',
  },
  'tests/visual/creation.spec.ts': {
    max: 3,
    reason: 'мастер создания проверяется на живых редакциях',
    removeBy: 'этап 8 трекера плагинов',
  },
  'tests/visual/helpers.ts': {
    max: 3,
    reason: 'хелперы визуальных тестов знают имена редакций для навигации',
    removeBy: 'этап 8 трекера плагинов',
  },
  'tests/visual/tablet.spec.ts': {
    max: 3,
    reason: 'планшетный сценарий листа DH1',
    removeBy: 'этап 8 трекера плагинов',
  },
  'tests/visual/fixtures.ts': {
    max: 1,
    reason: 'фикстуры визуальных тестов ссылаются на лист DH',
    removeBy: 'этап 8 трекера плагинов',
  },
  'tests/visual/locale.spec.ts': {
    max: 1,
    reason: 'локаль проверяется на листе D&D',
    removeBy: 'этап 8 трекера плагинов',
  },
  'tests/support/character-payloads.ts': {
    max: 1,
    reason: 'тестовая payload-фабрика знает имя системы',
    removeBy: 'этап 8 трекера плагинов',
  },
};

/**
 * Исключения из лимита. Потолок фиксирует текущий размер: файл может только
 * уменьшаться. `removeBy` — когда исключение должно исчезнуть.
 */
const EXCEPTIONS = {
  'security.test.ts': {
    max: 415,
    reason: 'сквозной сценарий безопасности; проверки связаны общим контекстом',
  },
  'plugins-registry.test.ts': {
    max: 528,
    reason:
      'conformance-раннер плагинов; после перевода на discovery вырос на циклы ' +
      'по обнаруженным модулям, дробление — следующий шаг',
    removeBy: 'этап 10',
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

// ── игровые упоминания в visual/support ────────────────────────────────────
const GAME_TOKEN_RE =
  /dnd5e|dh1e|dh2e|dh1|dh2|Dungeons|Dark Heresy|makeDndCharacter|makeDhCharacter/g;

function walkByExtension(dir, extensions, acc = []) {
  let entries = [];
  try {
    entries = readdirSync(dir, { withFileTypes: true });
  } catch {
    return acc;
  }
  for (const entry of entries) {
    const absolute = join(dir, entry.name);
    if (entry.isDirectory()) {
      if (entry.name === '__screenshots__') continue;
      walkByExtension(absolute, extensions, acc);
    } else if (
      entry.isFile() &&
      extensions.some((ext) => entry.name.endsWith(ext))
    ) {
      acc.push(absolute);
    }
  }
  return acc;
}

const mentionFiles = [
  ...walkByExtension(VISUAL_DIR, ['.ts', '.tsx']),
  ...walkByExtension(SUPPORT_DIR, ['.ts', '.tsx']),
];

for (const absolute of mentionFiles) {
  const name = relative(ROOT, absolute).split('\\').join('/');
  const source = readFileSync(absolute, 'utf8');
  const count = (source.match(GAME_TOKEN_RE) ?? []).length;
  if (count === 0) {
    if (GAME_MENTION_ALLOWANCE[name]) {
      result.errors.push(
        `${name}: игровых упоминаний больше нет — удалите запись из ` +
          'GAME_MENTION_ALLOWANCE (храповик не разрешает пустых исключений).',
      );
    }
    continue;
  }
  const allowance = GAME_MENTION_ALLOWANCE[name];
  if (!allowance) {
    result.errors.push(
      `${name}: ${count} игровых упоминаний. Сценарий одной редакции живёт в ` +
        'src/games/<id>/tests/; добавьте запись в GAME_MENTION_ALLOWANCE с причиной ' +
        'и сроком, если файл общий.',
    );
    continue;
  }
  if (count > allowance.max) {
    result.errors.push(
      `${name}: ${count} игровых упоминаний > потолка ${allowance.max}. ` +
        'Храповик не разрешает рост.',
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
