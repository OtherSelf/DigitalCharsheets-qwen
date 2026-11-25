#!/usr/bin/env node
/**
 * ─── LANDMARK: LEGAL SCAN ──────────────────────────────────────────────────
 * Ищет в отслеживаемых файлах строки из приватного списка маркеров (книжный
 * текст, который не должен вернуться). Список лежит вне репозитория:
 * `--markers` или `DCS_LEGAL_MARKERS`.
 *
 *   node scripts/legal/scan.mjs                  # пропуск, если маркеров нет
 *   node scripts/legal/scan.mjs --markers ../markers.txt
 *   node scripts/legal/scan.mjs --markers ../markers.txt --build .next
 *
 * Код возврата: 0 — чисто/пропуск, 1 — найдено, 2 — ошибка входа.
 */
import { execFileSync } from 'node:child_process';
import fs from 'node:fs';
import path from 'node:path';

const args = process.argv.slice(2);
const value = (name) => {
  const index = args.indexOf(name);
  return index === -1 ? undefined : args[index + 1];
};

const markersPath = value('--markers') ?? process.env.DCS_LEGAL_MARKERS;
const buildDir = value('--build');
const limit = Number(value('--limit') ?? 20);

if (!markersPath) {
  console.log(
    'legal:scan: маркеры не заданы (--markers / DCS_LEGAL_MARKERS) — пропуск',
  );
  process.exit(0);
}
if (!fs.existsSync(markersPath)) {
  console.error(`legal:scan: нет файла маркеров: ${markersPath}`);
  process.exit(2);
}

const markers = fs
  .readFileSync(markersPath, 'utf8')
  .split('\n')
  .map((line) => line.trim())
  .filter((line) => line.length >= 3)
  .sort((a, b) => b.length - a.length);

if (markers.length === 0) {
  console.log('legal:scan: список маркеров пуст — пропуск');
  process.exit(0);
}

const SKIP = /\.(png|jpe?g|webp|gif|ico|woff2?|ttf|otf|pdf|zip|gz|mp4)$/i;

function trackedFiles() {
  const out = execFileSync('git', ['ls-files', '-z'], { encoding: 'buffer' });
  return out
    .toString('utf8')
    .split('\0')
    .filter(Boolean)
    .filter((file) => !SKIP.test(file));
}

function walk(dir) {
  /** @type {string[]} */
  const files = [];
  for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
    const full = path.join(dir, entry.name);
    if (entry.isDirectory()) files.push(...walk(full));
    else if (!SKIP.test(entry.name)) files.push(full);
  }
  return files;
}

const files = [...trackedFiles()];
if (buildDir && fs.existsSync(buildDir)) files.push(...walk(buildDir));

const hits = [];
for (const file of files) {
  let text;
  try {
    text = fs.readFileSync(file, 'utf8');
  } catch {
    continue;
  }
  for (const marker of markers) {
    if (!text.includes(marker)) continue;
    const index = text.indexOf(marker);
    const line = text.slice(0, index).split('\n').length;
    hits.push({ file, line, marker });
    if (hits.length >= limit) break;
  }
  if (hits.length >= limit) break;
}

if (hits.length === 0) {
  console.log(
    `legal:scan: чисто (${files.length} файлов, ${markers.length} маркеров)`,
  );
  process.exit(0);
}

console.error(`legal:scan: найдено ${hits.length} совпадений`);
for (const hit of hits) {
  console.error(`  ${hit.file}:${hit.line}`);
}
process.exit(1);
