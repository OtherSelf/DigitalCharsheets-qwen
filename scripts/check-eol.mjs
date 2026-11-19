#!/usr/bin/env node
/**
 * ============================================================================
 *  scripts/check-eol.mjs — переводы строк в индексе и рабочем дереве
 * ============================================================================
 *
 *  `.gitattributes` (`* text=auto eol=lf`) требует LF, но checkout на Windows
 *  и редакторы, сохраняющие CRLF (Notepad), оставляют в рабочем дереве файлы
 *  с CRLF. `git status` их не показывает — git нормализует содержимое при
 *  чтении, — зато GitHub Desktop рисует на таком файле жёлтую плашку
 *  «This file uses 'CRLF' line endings, but Git is configured to convert them
 *  to 'LF' the next time the file is checked out», и файл выглядит
 *  «изменённым без диффа». Prettier этого не лечит: у `.nvmrc`,
 *  `.gitattributes` и `*.sh` нет парсера, а `*.md` в `.prettierignore`, —
 *  поэтому `npm run format` такие файлы не перезаписывает.
 *
 *  Поэтому проверка отдельная, по данным `git ls-files --eol`:
 *
 *    1. индекс (blob): CRLF там уедет в коммит и во все клоны — это правка
 *       индекса, скрипт её не делает, а подсказывает `git add --renormalize`;
 *    2. рабочее дерево: CRLF — шум checkout, лечится `--fix`: файл
 *       переписывается байт-в-байт, меняются только переводы строк, и
 *       `git diff` после этого пуст;
 *    3. у каждого текстового файла есть правило `eol=lf`: если кто-то сузит
 *       `* text=auto eol=lf`, проверка упадёт, а не промолчит.
 *
 *  Использование:
 *    npm run eol:check           # проверка (шаг npm run verify)
 *    npm run eol:fix             # переписать CRLF → LF в рабочем дереве
 *    node scripts/check-eol.mjs --fix --quiet
 *
 *  Код возврата: 0 — LF везде; 1 — нарушения; 2 — `git ls-files --eol`
 *  недоступен (git < 2.10) или упал.
 *  Связано: .gitattributes, .editorconfig, scripts/predeploy.sh,
 *           docs/development.md (раздел «Line endings and file modes»).
 * ============================================================================
 */
import { execFileSync } from 'node:child_process';
import { readFileSync, writeFileSync } from 'node:fs';
import { dirname, join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

const ROOT = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const ARGS = process.argv.slice(2);
const FIX = ARGS.includes('--fix');
const QUIET = ARGS.includes('--quiet');
const HELP = ARGS.includes('-h') || ARGS.includes('--help');

// `git ls-files --eol` печатает `<i/…>\t<w/…>\tattr/<…>\t<path>`; поля слева
// выровнены пробелами, путь отделён табуляцией и (с `-z`) нулём. Пустое
// значение (`i/`, `w/`) git печатает для файла, которого нет в индексе или в
// рабочем дереве, — это законный случай, а не битая строка.
const EOL_RECORD = /^i\/([a-z-]*)\s+w\/([a-z-]*)\s+attr\/(.*)\t([^\t]+)$/;
const HAS_LF = /(^|\s)eol=lf(\s|$)/;
const LIST_LIMIT = 20;

function fail(message, code = 1) {
  console.error(`✗ ${message}`);
  process.exit(code);
}

function usage() {
  console.log(`Проверка переводов строк: LF в индексе и в рабочем дереве.

Использование:
  node scripts/check-eol.mjs [--fix] [--quiet]

  --fix       переписать CRLF → LF в рабочем дереве (содержимое не меняется)
  --quiet     печатать только нарушения
  -h, --help  эта справка

Код возврата: 0 — LF везде; 1 — нарушения; 2 — git без \`ls-files --eol\`.`);
}

function git(args) {
  try {
    return execFileSync('git', args, {
      cwd: ROOT,
      maxBuffer: 64 * 1024 * 1024,
      stdio: ['ignore', 'pipe', 'pipe'],
    }).toString('utf8');
  } catch (error) {
    const stderr = String(error?.stderr ?? '').trim();
    fail(`git ${args.join(' ')} упал${stderr ? `: ${stderr}` : ''}`, 2);
  }
}

function isWorkTree() {
  try {
    const out = execFileSync('git', ['rev-parse', '--is-inside-work-tree'], {
      cwd: ROOT,
      stdio: ['ignore', 'pipe', 'ignore'],
    });
    return out.toString('utf8').trim() === 'true';
  } catch {
    return false;
  }
}

/**
 * Собирает нарушения одним проходом: не нужно трижды звать git и держать
 * в голове, что «файл изменился после --fix».
 */
function collect() {
  const out = git(['ls-files', '-z', '--eol']);
  const result = { total: 0, index: [], worktree: [], rule: [] };

  for (const record of out.split('\0')) {
    if (!record) continue;
    const match = EOL_RECORD.exec(record);
    if (!match) {
      // Неразобранная строка — упасть громко: иначе файл молча выпадет
      // из проверки, а именно этого скрипт и не должен делать.
      fail(`не удалось разобрать строку «git ls-files --eol»: ${record}`, 2);
    }
    const [, index, worktree, attrField, path] = match;
    const attrs = attrField.trim();

    // Бинарные (`-text` в индексе или в `.gitattributes`) и пустые/
    // отсутствующие файлы (`none` в индексе, пусто в рабочем дереве):
    // переводов строк у них нет, конвертировать нечего. `-text` в атрибутах
    // нужен отдельно: у вендорного бандла байты текстовые, но правило
    // `binary` сознательно отключает конверсию.
    if (index === '-text' || worktree === '-text') continue;
    if (!index || index === 'none' || !worktree || worktree === 'none')
      continue;
    if (/(^|\s)-text(\s|$)/.test(attrs)) continue;

    result.total += 1;
    if (!HAS_LF.test(attrs)) result.rule.push(path);
    if (index === 'crlf' || index === 'mixed') result.index.push(path);
    if (worktree === 'crlf' || worktree === 'mixed') result.worktree.push(path);
  }

  return result;
}

/**
 * Переписывает CRLF (и одинокие CR) в LF. latin1 — обратимое отображение
 * байт 1:1, поэтому файл с неожиданной кодировкой не портится: заменяются
 * только байты переводов строк.
 */
function fixWorktree(paths) {
  const fixed = [];
  for (const path of paths) {
    const file = join(ROOT, path);
    let text;
    try {
      text = readFileSync(file).toString('latin1');
    } catch (error) {
      fail(`не удалось прочитать ${path}: ${error.message}`, 2);
    }
    const normalized = text.replace(/\r\n/g, '\n').replace(/\r/g, '\n');
    if (normalized === text) continue;
    try {
      writeFileSync(file, Buffer.from(normalized, 'latin1'));
    } catch (error) {
      fail(`не удалось переписать ${path}: ${error.message}`, 2);
    }
    fixed.push(path);
  }
  return fixed;
}

function printList(paths) {
  const lines = paths.slice(0, LIST_LIMIT).map((path) => `    ${path}`);
  if (paths.length > LIST_LIMIT) {
    lines.push(`    … ещё ${paths.length - LIST_LIMIT}`);
  }
  console.log(lines.join('\n'));
}

if (HELP) {
  usage();
  process.exit(0);
}

if (!isWorkTree()) {
  // Ослабления здесь нет: вне git-репозитория (образ без `.git`, распакованный
  // архив) CRLF из checkout взяться не может — проверять нечего.
  console.log(
    '! пропущено: каталог не git-репозиторий (или git не найден) — ' +
      'сравнивать переводы строк не с чем',
  );
  process.exit(0);
}

let result = collect();

if (FIX && result.worktree.length > 0) {
  const fixed = fixWorktree(result.worktree);
  if (fixed.length > 0 && !QUIET) {
    console.log(`✓ переписано CRLF → LF: ${fixed.length} (рабочее дерево)`);
  }
  result = collect();
}

const violations =
  result.index.length + result.worktree.length + result.rule.length;

if (violations === 0) {
  if (!QUIET) {
    console.log(
      `✓ переводы строк: LF в индексе и рабочем дереве ` +
        `(${result.total} отслеживаемых файлов)`,
    );
  }
  process.exit(0);
}

if (result.worktree.length > 0) {
  console.log(
    `✗ CRLF в рабочем дереве (${result.worktree.length}) — шум checkout, ` +
      'GitHub Desktop показывает на таких файлах жёлтую плашку:',
  );
  printList(result.worktree);
  console.log('  Исправить: npm run eol:fix');
  console.log('');
}

if (result.index.length > 0) {
  console.log(
    `✗ CRLF в индексе (${result.index.length}) — уедет в коммит и во все клоны:`,
  );
  printList(result.index);
  console.log(
    '  Исправить: git add --renormalize . && git commit ' +
      '(индекс скрипт не трогает: это отдельная правка)',
  );
  console.log('');
}

if (result.rule.length > 0) {
  console.log(
    `✗ нет правила \`eol=lf\` в .gitattributes (${result.rule.length}):`,
  );
  printList(result.rule);
  console.log(
    '  Проверьте строку `* text=auto eol=lf`: текстовые файлы обязаны храниться с LF.',
  );
  console.log('');
}

process.exit(1);
