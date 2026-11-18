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

const ROOT = resolve(dirname(fileURLToPath(import.meta.url)), '../..');

/** Каталоги ядра, где игровых знаний быть не должно. */
export const CORE_DIRS = [
  'src/lib',
  'src/components',
  'src/app',
  'src/context',
  'src/hooks',
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
export const ALLOWLIST = [];

/** Файлы ядра: `.ts`/`.tsx`, без деклараций и тестов. */
function listFiles(dir) {
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
      found.push(...listFiles(full));
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

/**
 * Заменить комментарии и содержимое литералов пробелами, сохранив переводы
 * строк: номера строк остаются исходными, а «игровые» слова внутри строк не
 * считаются кодом.
 *
 * Шаблонные литералы с `${...}` требуют стека: подстановка — снова код, и
 * внутри неё может быть свой шаблон. Без стека сканер «уезжает» в строковое
 * состояние и перестаёт видеть комментарии ниже.
 */
export function stripNonCode(source) {
  const out = source.split('');
  const blank = (from, to) => {
    for (let j = from; j < to; j += 1) {
      if (out[j] !== '\n') out[j] = ' ';
    }
  };
  let mode = 'code';
  const templateStack = [];
  let braceDepth = 0;
  let i = 0;
  while (i < source.length) {
    const ch = source[i];
    const next = source[i + 1];
    if (mode === 'code') {
      if (ch === '/' && next === '/') {
        const end = source.indexOf('\n', i);
        const stop = end === -1 ? source.length : end;
        blank(i, stop);
        i = stop;
        continue;
      }
      if (ch === '/' && next === '*') {
        const end = source.indexOf('*/', i + 2);
        const stop = end === -1 ? source.length : end + 2;
        blank(i, stop);
        i = stop;
        continue;
      }
      if (ch === '(' && next === '*') {
        // Комментарий в JSX: {/* ... */}
        const end = source.indexOf('*)', i + 2);
        if (end !== -1) {
          blank(i, end + 2);
          i = end + 2;
          continue;
        }
      }
      if (ch === "'" || ch === '"') {
        mode = ch;
        blank(i, i + 1);
        i += 1;
        continue;
      }
      if (ch === '`') {
        mode = '`';
        blank(i, i + 1);
        i += 1;
        continue;
      }
      if (ch === '{') {
        braceDepth += 1;
        i += 1;
        continue;
      }
      if (ch === '}') {
        if (braceDepth > 0) {
          braceDepth -= 1;
        } else if (templateStack.length > 0) {
          // `}` закрывает подстановку: это часть литерала, а не код.
          blank(i, i + 1);
          mode = '`';
          templateStack.pop();
        }
        i += 1;
        continue;
      }
      i += 1;
      continue;
    }

    // Внутри строки или шаблона: сам литерал — не код, поэтому затираем его.
    if (ch === '\\') {
      blank(i, i + 2);
      i += 2;
      continue;
    }
    if (mode === '`' && ch === '$' && next === '{') {
      // Подстановка — снова код; шаблон вернётся после закрывающей скобки.
      blank(i, i + 2);
      templateStack.push(braceDepth);
      braceDepth = 0;
      mode = 'code';
      i += 2;
      continue;
    }
    if (ch === mode) {
      blank(i, i + 1);
      mode = 'code';
      i += 1;
      continue;
    }
    blank(i, i + 1);
    i += 1;
  }
  return out.join('');
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

function isAllowed(file) {
  return ALLOWLIST.find((entry) => entry.file === file);
}

export function checkCore({ root = ROOT } = {}) {
  const result = {
    filesScanned: 0,
    violations: [],
    allowed: [],
    staleAllowlist: [],
  };
  const files = CORE_DIRS.flatMap((dir) => listFiles(join(root, dir)));
  result.filesScanned = files.length;

  for (const absolute of files) {
    const file = relative(root, absolute).split('\\').join('/');
    const source = readFileSync(absolute, 'utf8');
    const found = findViolations(source);
    if (found.length === 0) continue;

    const allow = isAllowed(file);
    if (allow) {
      result.allowed.push({
        file,
        lines: found.map((violation) => violation.line),
        reason: allow.reason,
        removeBy: allow.removeBy,
      });
      continue;
    }
    result.violations.push({ file, hits: found });
  }

  for (const allow of ALLOWLIST) {
    if (!result.allowed.some((entry) => entry.file === allow.file)) {
      result.staleAllowlist.push(allow.file);
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

  if (result.violations.length > 0) {
    console.error('✗ игровые знания в ядре:');
    for (const violation of result.violations) {
      const lines = violation.hits
        .map((hit) => `${hit.line} (${hit.tokens.join(', ')})`)
        .join('; ');
      console.error(`  - ${violation.file}: ${lines}`);
    }
    console.error(
      '  Ядро не знает игр: подпись/поле объявляет плагин (слот, схема, словарь).',
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
  console.log(
    `✓ игровые знания: ${result.filesScanned} файлов ядра, игровых имён и полей 0` +
      (result.allowed.length > 0
        ? ` (исключений: ${result.allowed.length})`
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
