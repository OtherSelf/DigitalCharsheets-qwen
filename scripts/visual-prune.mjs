#!/usr/bin/env node
/**
 * ─── LANDMARK: VISUAL SNAPSHOT ORPHANS ─────────────────────────────────────
 * Playwright не удаляет эталоны, когда тест или его скриншот убрали: PNG
 * остаётся в __screenshots__ навсегда. Скрипт сверяет имена *.png, которые
 * встречаются в spec-файлах, с файлами в __screenshots__.
 *
 * Использование:
 *   node scripts/visual-prune.mjs           # показать осиротевшие файлы
 *   node scripts/visual-prune.mjs --write   # удалить их
 *   node scripts/visual-prune.mjs --check   # exit 1, если есть сироты
 *
 * Имена снимков в этом проекте — строковые литералы в spec-файлах (включая
 * массивы секций), поэтому текстового сканирования достаточно. Динамические
 * имена не поддерживаются намеренно: такой тест нужно писать явно.
 */
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const APP_DIR = path.resolve(
  path.dirname(fileURLToPath(import.meta.url)),
  '..',
);
const VISUAL_DIR = path.join(APP_DIR, 'tests', 'visual');
const SNAPSHOTS_DIR = path.join(VISUAL_DIR, '__screenshots__');

const args = new Set(process.argv.slice(2));
const write = args.has('--write') || args.has('-w');
const check = args.has('--check');

function walk(dir, predicate, result = []) {
  for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
    const full = path.join(dir, entry.name);
    if (entry.isDirectory()) walk(full, predicate, result);
    else if (predicate(full)) result.push(full);
  }
  return result;
}

function relative(file) {
  return path.relative(APP_DIR, file);
}

if (!fs.existsSync(SNAPSHOTS_DIR)) {
  console.log('[visual-prune] нет каталога эталонов — нечего чистить');
  process.exit(0);
}

const specs = walk(
  VISUAL_DIR,
  (file) => file.endsWith('.spec.ts') || file.endsWith('.ts'),
);

const referenced = new Set();
const pngLiteral = /['"`]([A-Za-z0-9._-]+\.png)['"`]/g;
for (const file of specs) {
  const text = fs.readFileSync(file, 'utf8');
  for (const match of text.matchAll(pngLiteral)) referenced.add(match[1]);
}

const snapshots = walk(SNAPSHOTS_DIR, (file) => file.endsWith('.png'));
const orphans = snapshots.filter(
  (file) => !referenced.has(path.basename(file)),
);

if (orphans.length === 0) {
  console.log(`[visual-prune] сирот нет (${snapshots.length} эталонов)`);
  process.exit(0);
}

console.log(`[visual-prune] осиротевших эталонов: ${orphans.length}`);
for (const file of orphans.sort()) console.log(`  ${relative(file)}`);

if (write) {
  for (const file of orphans) {
    // Страховка: удаляем только внутри tests/visual/__screenshots__.
    if (!path.resolve(file).startsWith(SNAPSHOTS_DIR + path.sep)) {
      console.error(`[visual-prune] пропуск вне каталога эталонов: ${file}`);
      process.exitCode = 1;
      continue;
    }
    fs.rmSync(file, { force: true });
  }
  console.log(`[visual-prune] удалено: ${orphans.length}`);
} else if (check) {
  process.exitCode = 1;
} else {
  console.log('[visual-prune] запусти с --write, чтобы удалить');
}
