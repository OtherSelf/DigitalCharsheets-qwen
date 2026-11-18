#!/usr/bin/env node
/**
 * ============================================================================
 *  scripts/tests/test-plugin.mjs — unit-тесты одного плагина
 * ============================================================================
 *
 *  Тесты плагина лежат рядом с кодом (`src/games/<id>/tests/unit`), но
 *  запускаются из корня. Корневой `npm test` находит их глобом, а этот скрипт
 *  гоняет только один плагин — без ручных списков файлов в package.json.
 *
 *  Использование:
 *    npm run test:plugin -- dh1
 *    npm run test:plugin -- example                    # фикстура
 *    npm run test:plugin -- src/games/dh1/tests/unit   # явный путь
 *    npm run test:plugin -- dh1 --reporter=verbose     # остальное — vitest
 *
 *  Где искать:
 *    1. аргумент с сегментом пути — как есть, от корня репозитория;
 *    2. иначе `src/games/<id>/tests` (боевой плагин);
 *    3. иначе `tests/fixtures/<id>/tests` или `tests/fixtures/<id>-plugin/tests`
 *       (эталонный плагин из тестов).
 *
 *  Связано: vitest.config.ts, docs/testing.md, tests/support/.
 * ============================================================================
 */
import { spawnSync } from 'node:child_process';
import { existsSync, readdirSync } from 'node:fs';
import { dirname, join, relative, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

const ROOT = resolve(dirname(fileURLToPath(import.meta.url)), '../..');

function usage() {
  console.log(`Unit-тесты одного игрового плагина.

  npm run test:plugin -- <id|путь>

  <id>     боевой плагин: src/games/<id>/tests
           фикстура:     tests/fixtures/<id>/tests или <id>-plugin/tests
  <путь>   каталог с тестами относительно корня репозитория

Аргументы после цели уходят в vitest как есть (--reporter, -t и т.п.).
Справка: docs/testing.md`);
}

function fail(message) {
  console.error(`test:plugin: ${message}`);
  process.exit(1);
}

/** Все `*.test.ts(x)` под каталогом, в стабильном порядке. */
function collectTests(dir, acc = []) {
  for (const entry of readdirSync(dir, { withFileTypes: true })) {
    const absolute = join(dir, entry.name);
    if (entry.isDirectory()) collectTests(absolute, acc);
    else if (entry.isFile() && /\.test\.tsx?$/.test(entry.name)) {
      acc.push(absolute);
    }
  }
  return acc;
}

const [target, ...vitestArgs] = process.argv.slice(2);

if (!target || target === '-h' || target === '--help') {
  usage();
  process.exit(target ? 0 : 1);
}

const isPath = target.includes('/') || target.includes('\\');
const candidates = isPath
  ? [resolve(ROOT, target)]
  : [
      join(ROOT, 'src/games', target, 'tests'),
      join(ROOT, 'tests/fixtures', target, 'tests'),
      join(ROOT, 'tests/fixtures', `${target}-plugin`, 'tests'),
    ];
const testsDir = candidates.find((dir) => existsSync(dir));

if (!testsDir) {
  fail(
    `не найден каталог тестов для "${target}". Ожидались:\n` +
      candidates.map((dir) => `  ${relative(ROOT, dir)}`).join('\n'),
  );
}

const files = collectTests(testsDir);
if (files.length === 0) {
  fail(`в ${relative(ROOT, testsDir)} нет ни одного *.test.ts`);
}

const vitestEntry = join(ROOT, 'node_modules/vitest/vitest.mjs');
if (!existsSync(vitestEntry)) {
  fail('нет node_modules/vitest — сначала npm ci');
}

const result = spawnSync(
  process.execPath,
  [
    vitestEntry,
    'run',
    ...files.map((file) => relative(ROOT, file)),
    ...vitestArgs,
  ],
  { cwd: ROOT, stdio: 'inherit' },
);

process.exit(result.status ?? 1);
