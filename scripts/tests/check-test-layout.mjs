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

import { gameTokens, tokenAlternation } from '../plugins/lib/manifests.mjs';

const ROOT = resolve(dirname(fileURLToPath(import.meta.url)), '../..');
const UNIT_DIR = join(ROOT, 'tests/unit');
const VISUAL_DIR = join(ROOT, 'tests/visual');
const SUPPORT_DIR = join(ROOT, 'tests/support');
const GAMES_DIR = join(ROOT, 'src/games');
const LIMIT = 400;

/**
 * Игровые упоминания в `tests/visual` и `tests/support`: сценарий одной
 * редакции должен жить в `src/games/<id>/tests/`, но пока часть общих спеков
 * упоминает игры напрямую. Храповик фиксирует текущее число: больше нельзя,
 * меньше — можно. `removeBy` — срок, к которому файл переезжает.
 *
 * Счёт — вхождения идентификаторов и строк (`Dungeons`, `dnd5e`,
 * `makeDndCharacter`, `sheet-dnd-…`), а не строки: имя селектора и имя
 * фикстуры одинаково важны. Набор токенов — из манифестов (см.
 * `GAME_TOKEN_RE`), поэтому новый опубликованный плагин попадает под храповик
 * без правки скрипта.
 */
const GAME_MENTION_ALLOWANCE = {
  // Host-сценарий проверяет API/страницу/пайплайн, а не правила редакции (D24).
  // Причина повторяется, чтобы у каждой записи было объяснение и срок.

  // CLI бэкфилла общий для обеих редакций: проверяется скрипт 0.22.0, а не
  // правила конкретной игры. Упоминания — имена systemId и ключей словарей.
  'tests/unit/legal-backfill.test.ts': {
    max: 44,
    reason:
      'общий CLI бэкфилла dh1/dh2: сценарий проверяет shared-скрипт, а не правила редакции',
    removeBy: 'удалить вместе со скриптом после релиза 0.22.0',
  },

  'tests/unit/i18n-keys.test.ts': {
    max: 1,
    reason:
      'контракт TranslationKey: нужен один пример ключа плагина, иначе не доказано, что словари плагинов входят в объединение',
    removeBy: 'остаётся: host-контракт i18n',
  },
  'tests/visual/pages.spec.ts': {
    max: 11,
    reason:
      'host-страница на поставляемом наборе (D13/D24): снимается страница, лист — фикстура',
    removeBy: 'остаётся: host-страница',
  },
  'tests/visual/i18n-raw.spec.ts': {
    max: 6,
    reason:
      'host-страница на поставляемом наборе (D13/D24): снимается страница, лист — фикстура',
    removeBy: 'остаётся: host-страница',
  },
  'tests/visual/admin.spec.ts': {
    max: 4,
    reason:
      'host-страница на поставляемом наборе (D13/D24): снимается страница, лист — фикстура',
    removeBy: 'остаётся: host-страница',
  },
  'tests/visual/history.spec.ts': {
    max: 4,
    reason:
      'host-страница на поставляемом наборе (D13/D24): снимается страница, лист — фикстура',
    removeBy: 'остаётся: host-страница',
  },
  'tests/visual/archive.spec.ts': {
    max: 2,
    reason:
      'host-страница на поставляемом наборе (D13/D24): снимается страница, лист — фикстура',
    removeBy: 'остаётся: host-страница',
  },
  'tests/visual/narrative-preview.spec.ts': {
    max: 1,
    reason:
      'host-сценарий вкладок заметок: временный лист создаётся через API, правила редакции не проверяются',
    removeBy: 'остаётся: host-сценарий',
  },
  'tests/visual/basic-pages.spec.ts': {
    max: 3,
    reason:
      'host-страница на поставляемом наборе (D13/D24): снимается страница, лист — фикстура',
    removeBy: 'остаётся: host-страница',
  },
  'tests/visual/creation.spec.ts': {
    max: 3,
    reason:
      'host-страница на поставляемом наборе (D13/D24): снимается страница, лист — фикстура',
    removeBy: 'остаётся: host-страница',
  },
  'tests/visual/helpers.ts': {
    max: 3,
    reason:
      'host-страница на поставляемом наборе (D13/D24): снимается страница, лист — фикстура',
    removeBy: 'остаётся: host-страница',
  },
  'tests/visual/fixtures.ts': {
    max: 1,
    reason:
      'host-страница на поставляемом наборе (D13/D24): снимается страница, лист — фикстура',
    removeBy: 'остаётся: host-страница',
  },
  'tests/support/character-payloads.ts': {
    max: 1,
    reason:
      'host-сценарий на живых редакциях (D24): проверяется пайплайн, а не правила игры',
    removeBy: 'остаётся: host-сценарий',
  },
  'tests/unit/account-deletion.test.ts': {
    max: 5,
    reason:
      'host-сценарий на живых редакциях (D24): проверяется пайплайн, а не правила игры',
    removeBy: 'остаётся: host-сценарий',
  },
  'tests/unit/admin/bootstrap.test.ts': {
    max: 5,
    reason:
      'host-сценарий на живых редакциях (D24): проверяется пайплайн, а не правила игры',
    removeBy: 'остаётся: host-сценарий',
  },
  'tests/unit/admin/users.test.ts': {
    max: 4,
    reason:
      'host-сценарий на живых редакциях (D24): проверяется пайплайн, а не правила игры',
    removeBy: 'остаётся: host-сценарий',
  },
  'tests/unit/admin-helpers.test.ts': {
    max: 23,
    reason:
      'host-сценарий на живых редакциях (D24): проверяется пайплайн, а не правила игры',
    removeBy: 'остаётся: host-сценарий',
  },
  'tests/unit/api/auth-sessions.test.ts': {
    max: 2,
    reason:
      'host-сценарий на живых редакциях (D24): проверяется пайплайн, а не правила игры',
    removeBy: 'остаётся: host-сценарий',
  },
  'tests/unit/api/characters.test.ts': {
    max: 9,
    reason:
      'host-сценарий на живых редакциях (D24): проверяется пайплайн, а не правила игры',
    removeBy: 'остаётся: host-сценарий',
  },
  'tests/unit/api/export.test.ts': {
    max: 2,
    reason:
      'host-сценарий на живых редакциях (D24): проверяется пайплайн, а не правила игры',
    removeBy: 'остаётся: host-сценарий',
  },
  'tests/unit/api/payload-validation.test.ts': {
    max: 1,
    reason:
      'host-сценарий на живых редакциях (D24): проверяется пайплайн, а не правила игры',
    removeBy: 'остаётся: host-сценарий',
  },
  'tests/unit/bulk-editor.test.ts': {
    max: 2,
    reason:
      'host-сценарий на живых редакциях (D24): проверяется пайплайн, а не правила игры',
    removeBy: 'остаётся: host-сценарий',
  },
  'tests/unit/character-history-api.test.ts': {
    max: 2,
    reason:
      'host-сценарий на живых редакциях (D24): проверяется пайплайн, а не правила игры',
    removeBy: 'остаётся: host-сценарий',
  },
  'tests/unit/character-migration-v2.test.ts': {
    max: 31,
    reason:
      'host-сценарий на живых редакциях (D24): проверяется пайплайн, а не правила игры',
    removeBy: 'остаётся: host-сценарий',
  },
  'tests/unit/core-imports.test.ts': {
    max: 9,
    reason: 'id игры — вход гейта импортов, а не знание хоста',
    removeBy: 'остаётся: вход гейта',
  },
  'tests/unit/core-purity.test.ts': {
    max: 11,
    reason: 'id игры — вход гейта чистоты ядра, а не знание хоста',
    removeBy: 'остаётся: вход гейта',
  },
  'tests/unit/dh-family-parity.test.ts': {
    max: 37,
    reason:
      'паритет двух редакций DH — host-level тест; модули перебираются по реестру',
    removeBy: 'остаётся: кросс-эдишн тест',
  },
  'tests/unit/exdev-storage.test.ts': {
    max: 2,
    reason:
      'host-сценарий на живых редакциях (D24): проверяется пайплайн, а не правила игры',
    removeBy: 'остаётся: host-сценарий',
  },
  'tests/unit/export/excel.test.ts': {
    max: 9,
    reason:
      'host-сценарий на живых редакциях (D24): проверяется пайплайн, а не правила игры',
    removeBy: 'остаётся: host-сценарий',
  },
  'tests/unit/export/format.test.ts': {
    max: 5,
    reason:
      'host-сценарий на живых редакциях (D24): проверяется пайплайн, а не правила игры',
    removeBy: 'остаётся: host-сценарий',
  },
  'tests/unit/export/import.test.ts': {
    max: 10,
    reason:
      'host-сценарий на живых редакциях (D24): проверяется пайплайн, а не правила игры',
    removeBy: 'остаётся: host-сценарий',
  },
  'tests/unit/export/merge.test.ts': {
    max: 14,
    reason:
      'host-сценарий на живых редакциях (D24): проверяется пайплайн, а не правила игры',
    removeBy: 'остаётся: host-сценарий',
  },
  'tests/unit/export/sanitize-filter.test.ts': {
    max: 12,
    reason:
      'host-сценарий на живых редакциях (D24): проверяется пайплайн, а не правила игры',
    removeBy: 'остаётся: host-сценарий',
  },
  'tests/unit/game-theme.test.ts': {
    max: 7,
    reason: 'id игры — значение CSS-селектора в проверке генератора темы',
    removeBy: 'остаётся: вход проверки',
  },
  'tests/unit/games/removed-plugin.test.ts': {
    max: 1,
    reason:
      'host-сценарий на живых редакциях (D24): проверяется пайплайн, а не правила игры',
    removeBy: 'остаётся: host-сценарий',
  },
  'tests/unit/history-diff.test.ts': {
    max: 2,
    reason:
      'host-сценарий на живых редакциях (D24): проверяется пайплайн, а не правила игры',
    removeBy: 'остаётся: host-сценарий',
  },
  'tests/unit/history-labels.test.ts': {
    max: 2,
    reason:
      'host-сценарий на живых редакциях (D24): проверяется пайплайн, а не правила игры',
    removeBy: 'остаётся: host-сценарий',
  },
  'tests/unit/history-recording.test.ts': {
    max: 1,
    reason:
      'host-сценарий на живых редакциях (D24): проверяется пайплайн, а не правила игры',
    removeBy: 'остаётся: host-сценарий',
  },
  'tests/unit/i18n-hardcoded.test.ts': {
    max: 3,
    reason:
      'host-сценарий на живых редакциях (D24): проверяется пайплайн, а не правила игры',
    removeBy: 'остаётся: host-сценарий',
  },
  'tests/unit/openapi.test.ts': {
    max: 1,
    reason:
      'host-сценарий на живых редакциях (D24): проверяется пайплайн, а не правила игры',
    removeBy: 'остаётся: host-сценарий',
  },
  'tests/unit/pending-draft.test.ts': {
    max: 1,
    reason:
      'host-сценарий на живых редакциях (D24): проверяется пайплайн, а не правила игры',
    removeBy: 'остаётся: host-сценарий',
  },
  'tests/unit/plugin-boundaries.test.ts': {
    max: 19,
    reason: 'id игры — вход проверки границ плагинов',
    removeBy: 'остаётся: вход гейта',
  },
  'tests/unit/plugin-slots.test.ts': {
    max: 8,
    reason:
      'host-сценарий на живых редакциях (D24): проверяется пайплайн, а не правила игры',
    removeBy: 'остаётся: host-сценарий',
  },
  'tests/unit/plugins-derive.test.ts': {
    max: 4,
    reason:
      'host-сценарий на живых редакциях (D24): проверяется пайплайн, а не правила игры',
    removeBy: 'остаётся: host-сценарий',
  },
  'tests/unit/plugins-generator.test.ts': {
    max: 4,
    reason: 'id игры — вход проверки генератора реестра',
    removeBy: 'остаётся: вход проверки',
  },
  'tests/unit/profile-update.test.ts': {
    max: 3,
    reason:
      'host-сценарий на живых редакциях (D24): проверяется пайплайн, а не правила игры',
    removeBy: 'остаётся: host-сценарий',
  },
  'tests/unit/server-derive-flag.test.ts': {
    max: 2,
    reason:
      'host-сценарий на живых редакциях (D24): проверяется пайплайн, а не правила игры',
    removeBy: 'остаётся: host-сценарий',
  },
  'tests/unit/server-derive-write.test.ts': {
    max: 1,
    reason:
      'host-сценарий на живых редакциях (D24): проверяется пайплайн, а не правила игры',
    removeBy: 'остаётся: host-сценарий',
  },
  'tests/unit/server-storage.test.ts': {
    max: 14,
    reason:
      'host-сценарий на живых редакциях (D24): проверяется пайплайн, а не правила игры',
    removeBy: 'остаётся: host-сценарий',
  },
  'tests/unit/share-api.test.ts': {
    max: 2,
    reason:
      'host-сценарий на живых редакциях (D24): проверяется пайплайн, а не правила игры',
    removeBy: 'остаётся: host-сценарий',
  },
  'tests/unit/shared-character.test.ts': {
    max: 4,
    reason:
      'host-сценарий на живых редакциях (D24): проверяется пайплайн, а не правила игры',
    removeBy: 'остаётся: host-сценарий',
  },
  'tests/unit/shares.test.ts': {
    max: 3,
    reason:
      'host-сценарий на живых редакциях (D24): проверяется пайплайн, а не правила игры',
    removeBy: 'остаётся: host-сценарий',
  },
  'tests/unit/translations.test.ts': {
    max: 15,
    reason:
      'host-сценарий на живых редакциях (D24): проверяется пайплайн, а не правила игры',
    removeBy: 'остаётся: host-сценарий',
  },
  'tests/unit/visual-naming.test.ts': {
    max: 2,
    reason: 'имена эталонов в примерах правил',
    removeBy: 'остаётся: правила имён',
  },
};

/**
 * Исключения из лимита. Потолок фиксирует текущий размер: файл может только
 * уменьшаться. `removeBy` — когда исключение должно исчезнуть.
 */
const EXCEPTIONS = {
  'auth-register.test.ts': {
    max: 410,
    reason:
      'auth/register/exists/profile в одном домене: согласие и версия политики ' +
      'добавили строки; дробление — отдельная задача',
    removeBy: 'разделить на auth-* до роста файла',
  },
  'plugins-registry.test.ts': {
    max: 504,
    reason:
      'conformance-раннер плагинов: манифесты, реестр и миграции; дробление — ' +
      'отдельная задача, файл может только уменьшаться',
    removeBy: 'остаётся: conformance-раннер',
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

/** Игровые плагины — по манифестам, а не по списку в скрипте. */
function gameIds() {
  return new Set(gameTokens(GAMES_DIR).ids);
}

const GAME_IMPORT_RE = /['"]@\/games\/([^/'"]+)\/([^'"]+)['"]/g;

/**
 * Шаблонный импорт `@/games/${id}/...`: тест сам перебирает редакции, поэтому
 * литеральные пути в нём — только типы. Без этого правила кросс-эдишн тест
 * паритета выглядел «тестом одной редакции» и требовал переезда в плагин.
 */
const DYNAMIC_GAME_IMPORT_RE = /import\(\s*`@\/games\/\$\{/;

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
  const dynamicAcrossEditions = DYNAMIC_GAME_IMPORT_RE.test(source);
  if (games.size === 1 && !dynamicAcrossEditions) {
    const [game] = games;
    result.errors.push(
      `${name}: тест одной редакции (${game}) должен лежать в ` +
        `src/games/${game}/tests/unit/. Кросс-эдишн тест импортирует две игры.`,
    );
  }
}

// ── игровые упоминания в visual/support ────────────────────────────────────
/**
 * Токены упоминаний выводятся из манифестов опубликованных плагинов
 * (`id`, `shortCode`, отображаемые имена игры и legacy-алиасы).
 */
const GAME_TOKEN_RE = new RegExp(
  `(?:^|[^A-Za-z0-9_$])(${tokenAlternation(
    gameTokens(GAMES_DIR).mentions,
  )})(?![A-Za-z0-9_$])`,
  'g',
);

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
  ...walkByExtension(UNIT_DIR, ['.ts', '.tsx']),
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

// Запись для удалённого/переименованного файла — такой же мёртвый долг, как
// нулевое упоминание: без проверки он молча переживает перенос спека.
const scannedNames = new Set(
  mentionFiles.map((absolute) =>
    relative(ROOT, absolute).split('\\').join('/'),
  ),
);
for (const name of Object.keys(GAME_MENTION_ALLOWANCE)) {
  if (!scannedNames.has(name)) {
    result.errors.push(
      `${name}: файла больше нет — удалите запись из GAME_MENTION_ALLOWANCE.`,
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
