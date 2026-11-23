#!/usr/bin/env node
/**
 * Храповик дублирования: jscpd по исходникам, тестам и скриптам.
 *
 * Игры, словари, generated-файлы, fixtures и vendor исключены осознанно
 * (DEDUPE-12): это данные/независимые копии редакций, а не долг ядра.
 * Порог — не хуже baseline; рост клонов или строк валит проверку.
 *
 *   npm run dedupe:check
 */
import { spawnSync } from 'node:child_process';
import { mkdtempSync, readFileSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { dirname, join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

const ROOT = resolve(dirname(fileURLToPath(import.meta.url)), '../..');
const MAX_DUPLICATED_LINES = 720;
const MAX_CLONES = 45;

const ALLOWLIST = [
  { path: 'src/games/', reason: 'независимые редакции (D10)' },
  { path: 'tests/unit/fixtures/', reason: 'игровые фикстуры' },
  { path: 'public/vendor/', reason: 'вендорная копия SheetJS' },
  { path: 'src/lib/i18n/translations.', reason: 'ключевой каркас en/ru' },
  { path: '.generated.', reason: 'генерация из манифестов' },
];

const IGNORE = [
  '**/src/games/**',
  '**/__screenshots__/**',
  '**/*.generated.*',
  '**/translations.*.ts',
  '**/fixtures/**',
  '**/node_modules/**',
  '**/.next/**',
  '**/public/vendor/**',
];

function isAllowed(file) {
  return ALLOWLIST.some((entry) => file.includes(entry.path));
}

const output = mkdtempSync(join(tmpdir(), 'dcs-jscpd-'));
try {
  const result = spawnSync(
    join(ROOT, 'node_modules/.bin/jscpd'),
    [
      'src',
      'tests',
      'scripts',
      '--ignore',
      IGNORE.join(','),
      '--min-lines',
      '8',
      '--min-tokens',
      '70',
      '--reporters',
      'json',
      '--output',
      output,
      '--silent',
    ],
    { cwd: ROOT, encoding: 'utf8' },
  );

  if (result.error) {
    console.error(`dedupe: jscpd не запустился: ${result.error.message}`);
    process.exit(1);
  }
  if (result.status !== 0) {
    console.error(result.stderr || result.stdout || 'dedupe: jscpd failed');
    process.exit(result.status ?? 1);
  }

  const report = JSON.parse(
    readFileSync(join(output, 'jscpd-report.json'), 'utf8'),
  );
  const duplicates = (report.duplicates ?? []).filter(
    (clone) =>
      !isAllowed(clone.firstFile.name) && !isAllowed(clone.secondFile.name),
  );
  const lines = duplicates.reduce((sum, clone) => sum + clone.lines, 0);
  const clones = duplicates.length;

  console.log(
    `dedupe: ${clones} клонов / ${lines} строк ` +
      `(порог ${MAX_CLONES} / ${MAX_DUPLICATED_LINES})`,
  );
  for (const entry of ALLOWLIST) {
    console.log(`  allowlist: ${entry.path} — ${entry.reason}`);
  }

  if (clones > MAX_CLONES || lines > MAX_DUPLICATED_LINES) {
    const top = [...duplicates].sort((a, b) => b.lines - a.lines).slice(0, 10);
    for (const clone of top) {
      console.error(
        `  ${clone.firstFile.name}:${clone.firstFile.start} ↔ ` +
          `${clone.secondFile.name}:${clone.secondFile.start} ` +
          `(${clone.lines} строк)`,
      );
    }
    console.error(
      'dedupe: рост дублирования — разберите клон или обновите baseline',
    );
    process.exit(1);
  }
} finally {
  rmSync(output, { recursive: true, force: true });
}
