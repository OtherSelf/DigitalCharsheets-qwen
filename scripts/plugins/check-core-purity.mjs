#!/usr/bin/env node
/**
 * ============================================================================
 *  scripts/plugins/check-core-purity.mjs — гейт «ядро не знает игр»
 * ============================================================================
 *
 *  Правило проекта звучит как «ядро не знает конкретных игр», но проверялось
 *  только по именам игр (`dnd5e`, `Dark Heresy`). Игровые *поля*
 *  (`proficiencyBonus`, `rank`, `wounds`, `level`, …) просачивались в ядро
 *  незамеченными: админка форматировала уровень, компонент состояний знал
 *  `corruption`, словари ядра держали подписи Excel.
 *
 *  Гейт ищет в коде ядра (`src/lib`, `src/components`, `src/app`,
 *  `src/context`, `src/hooks`) имена игр и игровые поля. Комментарии и
 *  содержимое строковых литералов не считаются: подпись «Dungeons & Dragons»
 *  в словаре — это данные, а не знание ядра.
 *
 *  Стили ядра сканируются отдельно: селектор `.dnd-sheet`/`.dh-sheet` в
 *  `globals.css` — такая же зависимость от конкретной игры, как её id в
 *  коде, просто раньше её не видели (сканировались только `.ts/.tsx`).
 *  Долг по CSS фиксируется храповиком (`CSS_ALLOWLIST`): больше потолка
 *  нельзя, меньше — тоже (потолок опускают в том же коммите, который убрал
 *  блоки), иначе долг копится молча.
 *
 *  Исключения — только с причиной и сроком (`removeBy`): без них гейт
 *  зеленел бы за счёт молчания.
 *
 *  Использование:
 *    npm run plugins:purity            # проверка (шаг npm run verify)
 *    node scripts/plugins/check-core-purity.mjs --json
 *
 *  Связано: scripts/plugins/boundaries.json, scripts/predeploy.sh,
 *           docs/architecture.md
 * ============================================================================
 */
import { readdirSync, readFileSync } from 'node:fs';
import { dirname, join, relative, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

import {
  stripCommentsOnly,
  stripNonCode,
} from './lib/scan.mjs';

export { stripCommentsOnly, stripNonCode };

const ROOT = resolve(dirname(fileURLToPath(import.meta.url)), '../..');

/** Каталоги ядра, где игровых знаний быть не должно. */
export const CORE_DIRS = [
  'src/lib',
  'src/components',
  'src/app',
  'src/context',
  'src/hooks',
  // SDK-слой плагинов: механик игр здесь быть не должно (редакции держат
  // свои копии правил, D10), поэтому он сканируется как ядро.
  'src/games/shared',
];

/** Имена игр/плагинов; в коде ядра их быть не должно вообще. */
export const GAME_NAMES = [
  'dnd5e',
  'dh1',
  'dh2',
  'Dungeons',
  'Dark Heresy',
  'darkHeresy',
];

/** Игровые поля: конкретные игры, их механики и подписи. */
export const GAME_FIELDS = [
  'characterClass',
  'proficiencyBonus',
  'spellcastingAbility',
  'careerPath',
  'homeWorld',
  'divination',
  'insanity',
  'corruption',
  'fatePoints',
  'weaponSkill',
  'ballisticSkill',
  'statUpgrades',
  'aptitudes',
  'psyRating',
  'level',
  'rank',
  'wounds',
];

/**
 * Исключения. Каждое обязано иметь причину и срок снятия; просроченное
 * исключение — отдельный сигнал, но гейт его не валит (срок проверяет ревью).
 */
export const ALLOWLIST = [
  {
    file: 'src/games/shared/types.ts',
    // Общее поле листа v1, а не правило игры: его читает миграция, и на него
    // ссылается базовый тип любого листа. Уйдёт вместе с legacy-полями.
    tokens: ['characterClass'],
    reason:
      'legacy-поле v1 в общей части листа; убирается отдельной миграцией, а не вместе с переносом правил DH',
    removeBy: 'отдельная задача: удалить legacy-поля v1',
  },
];

/**
 * Игровые токены в стилях ядра. Список короткий и предметный: общий префикс
 * `dcs-` игрой не считается, поэтому класс конкретной редакции
 * (`dcs-info-grid`) перечислен отдельно.
 */
export const CSS_GAME_TOKENS = [
  ['dnd', /(?<![a-z0-9])dnd(?:5e)?(?![a-z0-9])/i],
  ['dh', /(?<![a-z0-9])dh(?:1|2)?(?![a-z0-9])/i],
  ['dark-heresy', /(?<![a-z0-9])dark[-_ ]?heresy(?![a-z0-9])/i],
  ['info-grid', /(?<![a-z0-9])(?:dcs-)?info-grid(?![a-z0-9])/i],
  ['stretch-card', /(?<![a-z0-9])stretch-card(?![a-z0-9])/i],
];

/**
 * Храповик CSS-долга: файл ядра и потолок строк с игровыми токенами.
 * `max` — точное текущее число; его опускают в том же коммите, который
 * убрал блоки, а запись удаляют вместе с последним блоком. Сейчас пуст:
 * игровая раскладка переехала в CSS-модули плагинов.
 */
export const CSS_ALLOWLIST = [];

/**
 * Точные id игр. `stripNonCode` затирает содержимое литералов, поэтому
 * `if (systemId === 'dh1')` раньше проходил незамеченным. id ищутся отдельно
 * и только целиком: подпись «Dark Heresy» в словаре — данные, а не знание
 * ядра, и остаётся разрешённой.
 */
export const GAME_IDS = ['dnd5e', 'dh1', 'dh2'];

/**
 * Исключения для id в литералах: данные i18n и подобные таблицы, где id —
 * это значение, а не ветка кода. Каждое — с причиной и сроком.
 */
export const ID_ALLOWLIST = [];

/** Файлы ядра: код (`.ts`/`.tsx`, без деклараций и тестов) или стили. */
function listFiles(dir, kind = 'code') {
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
      if (entry.name === 'node_modules' || entry.name === '__screenshots__') {
        continue;
      }
      found.push(...listFiles(full, kind));
    } else if (kind === 'css') {
      if (/\.css$/.test(entry.name)) found.push(full);
    } else if (
      /\.(ts|tsx)$/.test(entry.name) &&
      !entry.name.endsWith('.d.ts') &&
      !/\.test\.(ts|tsx)$/.test(entry.name)
    ) {
      found.push(full);
    }
  }
  return found;
}

function wordPattern(list) {
  const escaped = list.map((token) =>
    token.replace(/[.*+?^${}()|[\]\\]/g, '\\$&'),
  );
  return new RegExp(
    `(?:^|[^A-Za-z0-9_$])(${escaped.join('|')})(?![A-Za-z0-9_$])`,
    'g',
  );
}

const NAME_RE = wordPattern(GAME_NAMES);
const FIELD_RE = wordPattern(GAME_FIELDS);

/**
 * Найти нарушения в исходнике: по одной записи на строку.
 *
 * @param {string} source
 * @returns {{ line: number, tokens: string[] }[]}
 */
export function findViolations(source) {
  const lines = stripNonCode(source).split('\n');
  const violations = [];
  lines.forEach((line, index) => {
    const tokens = new Set();
    for (const match of line.matchAll(NAME_RE)) tokens.add(match[1]);
    for (const match of line.matchAll(FIELD_RE)) tokens.add(match[1]);
    if (tokens.size > 0) {
      violations.push({ line: index + 1, tokens: [...tokens].sort() });
    }
  });
  return violations;
}

/**
 * Убрать комментарии CSS, сохранив номера строк: `/* … *\/` заменяется
 * пробелами, переводы строк остаются. Подписи в комментариях — не код.
 */
export function stripCssComments(source) {
  const out = source.split('');
  let i = 0;
  while (i < source.length) {
    if (source[i] === '/' && source[i + 1] === '*') {
      const end = source.indexOf('*/', i + 2);
      const stop = end === -1 ? source.length : end + 2;
      for (let j = i; j < stop; j += 1) {
        if (out[j] !== '\n') out[j] = ' ';
      }
      i = stop;
      continue;
    }
    i += 1;
  }
  return out.join('');
}

/**
 * Найти игровые токены в стилях: по одной записи на строку.
 *
 * @param {string} source
 * @returns {{ line: number, tokens: string[] }[]}
 */
export function findCssViolations(source) {
  const lines = stripCssComments(source).split('\n');
  const violations = [];
  lines.forEach((line, index) => {
    const tokens = new Set();
    for (const [token, pattern] of CSS_GAME_TOKENS) {
      if (pattern.test(line)) tokens.add(token);
    }
    if (tokens.size > 0) {
      violations.push({ line: index + 1, tokens: [...tokens].sort() });
    }
  });
  return violations;
}

/**
 * Найти точные id игр в строковых литералах: по одной записи на строку.
 *
 * @param {string} source
 * @returns {{ line: number, tokens: string[] }[]}
 */
export function findIdViolations(source) {
  const lines = stripCommentsOnly(source).split('\n');
  const violations = [];
  lines.forEach((line, index) => {
    const ids = new Set();
    for (const id of GAME_IDS) {
      const pattern = new RegExp(`(['"\`])${id}\\1`, 'g');
      for (const _match of line.matchAll(pattern)) ids.add(id);
    }
    if (ids.size > 0) {
      violations.push({ line: index + 1, tokens: [...ids].sort() });
    }
  });
  return violations;
}

function isAllowed(file) {
  return ALLOWLIST.find((entry) => entry.file === file);
}

function idAllowance(file) {
  return ID_ALLOWLIST.find((entry) => entry.file === file);
}

function cssAllowance(file) {
  return CSS_ALLOWLIST.find((entry) => entry.file === file);
}

export function checkCore({ root = ROOT } = {}) {
  const result = {
    filesScanned: 0,
    violations: [],
    allowed: [],
    staleAllowlist: [],
    idViolations: [],
    idAllowed: [],
    staleIdAllowlist: [],
    cssScanned: 0,
    cssViolations: [],
    cssAllowed: [],
    staleCssAllowlist: [],
  };
  const files = CORE_DIRS.flatMap((dir) => listFiles(join(root, dir)));
  result.filesScanned = files.length;

  const cssFiles = CORE_DIRS.flatMap((dir) =>
    listFiles(join(root, dir), 'css'),
  );
  result.cssScanned = cssFiles.length;

  for (const absolute of cssFiles) {
    const file = relative(root, absolute).split('\\').join('/');
    const hits = findCssViolations(readFileSync(absolute, 'utf8'));
    if (hits.length === 0) continue;

    const allowance = cssAllowance(file);
    if (!allowance) {
      result.cssViolations.push({ file, hits });
      continue;
    }
    if (hits.length > allowance.max) {
      result.cssViolations.push({
        file,
        hits,
        overAllowance: allowance.max,
      });
      continue;
    }
    result.cssAllowed.push({
      file,
      lines: hits.map((hit) => hit.line),
      max: allowance.max,
      reason: allowance.reason,
      removeBy: allowance.removeBy,
    });
    if (hits.length < allowance.max) {
      result.staleCssAllowlist.push({
        file,
        actual: hits.length,
        max: allowance.max,
      });
    }
  }

  for (const allowance of CSS_ALLOWLIST) {
    if (!result.cssAllowed.some((entry) => entry.file === allowance.file)) {
      result.staleCssAllowlist.push({
        file: allowance.file,
        actual: 0,
        max: allowance.max,
      });
    }
  }

  for (const absolute of files) {
    const file = relative(root, absolute).split('\\').join('/');
    const source = readFileSync(absolute, 'utf8');
    const found = findViolations(source);
    const ids = findIdViolations(source);
    if (found.length === 0 && ids.length === 0) continue;

    if (ids.length > 0) {
      const allowId = idAllowance(file);
      if (allowId) {
        result.idAllowed.push({
          file,
          lines: ids.map((hit) => hit.line),
          reason: allowId.reason,
          removeBy: allowId.removeBy,
        });
      } else {
        result.idViolations.push({ file, hits: ids });
      }
    }

    if (found.length === 0) continue;

    // Исключение может быть на весь файл (без `tokens`) или на конкретные
    // токены: второе не открывает файл целиком и ловит новые нарушения в нём.
    const allow = isAllowed(file);
    if (allow && !allow.tokens) {
      result.allowed.push({
        file,
        lines: found.map((violation) => violation.line),
        reason: allow.reason,
        removeBy: allow.removeBy,
      });
      continue;
    }

    const allowedTokens = new Set(allow?.tokens ?? []);
    const allowedLines = [];
    const rest = [];
    for (const violation of found) {
      const leftover = violation.tokens.filter(
        (token) => !allowedTokens.has(token),
      );
      if (leftover.length === 0) allowedLines.push(violation.line);
      else rest.push({ line: violation.line, tokens: leftover });
    }
    if (allowedLines.length > 0) {
      result.allowed.push({
        file,
        lines: allowedLines,
        reason: allow.reason,
        removeBy: allow.removeBy,
      });
    }
    if (rest.length > 0) result.violations.push({ file, hits: rest });
  }

  for (const allow of ALLOWLIST) {
    if (!result.allowed.some((entry) => entry.file === allow.file)) {
      result.staleAllowlist.push(allow.file);
    }
  }

  for (const allow of ID_ALLOWLIST) {
    if (!result.idAllowed.some((entry) => entry.file === allow.file)) {
      result.staleIdAllowlist.push(allow.file);
    }
  }
  return result;
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
    console.log(`Гейт «ядро не знает игр».

  npm run plugins:purity   проверить ядро (шаг npm run verify)
  node scripts/plugins/check-core-purity.mjs --json   машиночитаемый отчёт`);
    return 0;
  }

  const result = checkCore();

  if (flags.has('--json')) {
    console.log(JSON.stringify(result, null, 2));
    return result.violations.length > 0 ? 1 : 0;
  }

  if (
    result.violations.length > 0 ||
    result.idViolations.length > 0 ||
    result.cssViolations.length > 0
  ) {
    console.error('✗ игровые знания в ядре:');
    for (const violation of result.violations) {
      const lines = violation.hits
        .map((hit) => `${hit.line} (${hit.tokens.join(', ')})`)
        .join('; ');
      console.error(`  - ${violation.file}: ${lines}`);
    }
    for (const violation of result.idViolations) {
      const lines = violation.hits
        .map((hit) => `${hit.line} (${hit.tokens.join(', ')})`)
        .join('; ');
      console.error(`  - ${violation.file} (id в литерале): ${lines}`);
    }
    for (const violation of result.cssViolations) {
      const lines = violation.hits
        .map((hit) => `${hit.line} (${hit.tokens.join(', ')})`)
        .join('; ');
      const tail =
        violation.overAllowance === undefined
          ? ''
          : ` [храповик: > ${violation.overAllowance}]`;
      console.error(`  - ${violation.file} (css): ${lines}${tail}`);
    }
    console.error(
      '  Ядро не знает игр: подпись/поле объявляет плагин (слот, схема, словарь),',
    );
    console.error(
      '  раскладку листа — CSS-модуль в папке плагина (docs/game-modules.md).',
    );
    return 1;
  }

  for (const entry of result.allowed) {
    console.warn(
      `⚠ ${entry.file}: ${entry.lines.length} строк(и) под исключением ` +
        `(${entry.removeBy})`,
    );
  }
  for (const file of result.staleAllowlist) {
    console.warn(`⚠ исключение для ${file} больше не нужно — удалите его`);
  }
  for (const entry of result.idAllowed) {
    console.warn(
      `⚠ ${entry.file}: ${entry.lines.length} литерал(ов) с id игры под ` +
        `исключением (${entry.removeBy}) — ${entry.reason}`,
    );
  }
  for (const file of result.staleIdAllowlist) {
    console.warn(`⚠ исключение для id в ${file} больше не нужно — удалите его`);
  }
  for (const entry of result.cssAllowed) {
    console.warn(
      `⚠ ${entry.file} (css): ${entry.lines.length} из ${entry.max} строк ` +
        `под храповиком (${entry.removeBy}) — ${entry.reason}`,
    );
  }
  if (result.staleCssAllowlist.length > 0) {
    for (const entry of result.staleCssAllowlist) {
      console.error(
        `✗ храповик CSS устарел: ${entry.file} — ${entry.actual} строк вместо ` +
          `${entry.max}. Опустите max (или удалите запись, если строк 0)`,
      );
    }
    return 1;
  }
  console.log(
    `✓ игровые знания: ${result.filesScanned} файлов кода и ` +
      `${result.cssScanned} файлов CSS ядра, игровых имён, полей и селекторов 0` +
      (result.allowed.length > 0
        ? ` (исключений: ${result.allowed.length})`
        : '') +
      (result.idAllowed.length > 0
        ? ` (исключений по id: ${result.idAllowed.length})`
        : '') +
      (result.cssAllowed.length > 0
        ? ` (css-храповик: ${result.cssAllowed.length})`
        : ''),
  );
  return 0;
}

const isMain =
  process.argv[1] &&
  resolve(process.argv[1]) === fileURLToPath(import.meta.url);

if (isMain) {
  process.exitCode = main(process.argv.slice(2));
}
