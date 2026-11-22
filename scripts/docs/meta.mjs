#!/usr/bin/env node
/**
 * ─── LANDMARK: DOCS META GENERATOR ──────────────────────────────────────────
 * `docs/meta.json` и `docs/adr/meta.json` — порядок страниц в сайдбаре
 * `/docs`. Руками они не правятся: единственный источник порядка — карта
 * `## Map` в `docs/README.md`. Скрипт читает карту и собирает оба файла.
 *
 * Контракт как у `scripts/plugins/generate.mjs`:
 *   node scripts/docs/meta.mjs            — записать meta.json;
 *   node scripts/docs/meta.mjs --check    — сравнить с диском и упасть на
 *                                            рассинхроне (шаг verify).
 *
 * Карта обязана покрывать все страницы: файл без строки в карте — ошибка
 * (иначе новая статья молча выпадет из навигации), строка без файла — тоже.
 */

import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const HERE = path.dirname(fileURLToPath(import.meta.url));
const DEFAULT_APP_DIR = path.resolve(HERE, '../..');

const ROOT_META = 'meta.json';
const ADR_DIR = 'adr';
const ADR_META = 'adr/meta.json';
const README = 'README.md';
/**
 * Пункт-ссылка в конце сайдбара: API-справочник живёт вне markdown-статей.
 * `external:` обязателен: без него Fumadocs рендерит Next-ссылку и префетчит
 * `/api/docs?_rsc=…`, а route handler на такой запрос не отвечает — страница
 * `/docs` перестаёт доходить до `networkidle`.
 */
const API_LINK = 'external:[API reference](/api/docs)';

/** Строка карты: `| [file](path) | description |`. */
const MAP_ROW = /^\| \[(?<label>[^\]]+)\]\((?<path>[^)]+)\) \| (?<description>.+) \|$/;

/**
 * Разбирает карту документации.
 * @param {string} readmeText содержимое `docs/README.md`
 * @returns {{ path: string, description: string }[]}
 */
export function parseMap(readmeText) {
  const rows = [];
  let inMap = false;
  for (const line of readmeText.split('\n')) {
    if (line.startsWith('## ')) {
      inMap = line.trim() === '## Map';
      continue;
    }
    if (!inMap) continue;
    const match = MAP_ROW.exec(line);
    if (!match?.groups) continue;
    rows.push({
      path: match.groups.path,
      description: match.groups.description.trim(),
    });
  }
  return rows;
}

/** Все markdown-страницы каталога, кроме корневого README. */
function listPages(docsDir) {
  const pages = [];
  const walk = (dir) => {
    for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
      const full = path.join(dir, entry.name);
      if (entry.isDirectory()) {
        walk(full);
        continue;
      }
      if (!entry.name.endsWith('.md')) continue;
      const relative = path.relative(docsDir, full).split(path.sep).join('/');
      if (relative !== README) pages.push(relative);
    }
  };
  walk(docsDir);
  return pages.sort();
}

/** Слиз статьи по пути файла: `adr/0001-x.md` → `0001-x`. */
function slugOf(file) {
  return file.slice(0, -'.md'.length);
}

/**
 * Проверяет карту против файлов и возвращает список проблем.
 * @returns {string[]}
 */
export function validateMap(docsDir, rows) {
  const errors = [];
  const pages = listPages(docsDir);
  const known = new Set(pages);
  const listed = new Set();

  if (rows.length === 0) {
    errors.push(
      'docs/README.md: не найдена таблица `## Map` (нужны строки `| [file](path) | что покрывает |`)',
    );
  }

  for (const row of rows) {
    if (listed.has(row.path)) {
      errors.push(`docs/README.md: страница ${row.path} указана в карте дважды`);
    }
    listed.add(row.path);
    if (!known.has(row.path)) {
      errors.push(
        `docs/README.md: в карте есть ${row.path}, но файла docs/${row.path} нет`,
      );
    }
  }

  for (const page of pages) {
    if (!listed.has(page)) {
      errors.push(
        `docs/${page}: страницы нет в карте docs/README.md — добавьте строку, иначе она выпадет из навигации`,
      );
    }
  }

  return errors;
}

/**
 * Собирает содержимое meta-файлов по карте.
 * @param {{ path: string }[]} rows
 * @returns {Map<string, object>} путь относительно docs/ → объект meta.json
 */
export function buildMeta(rows) {
  const files = new Map();
  const topicPages = [];
  const adrPages = [];
  let adrSeen = false;

  for (const row of rows) {
    if (row.path.startsWith(`${ADR_DIR}/`)) {
      if (!adrSeen) {
        adrSeen = true;
        topicPages.push(ADR_DIR);
      }
      adrPages.push(slugOf(row.path.slice(ADR_DIR.length + 1)));
      continue;
    }
    topicPages.push(slugOf(row.path));
  }

  files.set(ROOT_META, {
    title: 'Documentation',
    pages: [...topicPages, API_LINK],
  });

  if (adrPages.length > 0) {
    files.set(ADR_META, { title: 'ADR', pages: adrPages });
  }

  return files;
}

/** Канонический JSON: два пробела и перевод строки в конце. */
function serialize(meta) {
  return `${JSON.stringify(meta, null, 2)}\n`;
}

/**
 * Считает ожидаемое состояние meta-файлов.
 * @returns {{ errors: string[], files: Map<string, string> }}
 */
export function generate(docsDir) {
  const readmePath = path.join(docsDir, README);
  if (!fs.existsSync(readmePath)) {
    return { errors: [`нет файла docs/${README}`], files: new Map() };
  }

  const rows = parseMap(fs.readFileSync(readmePath, 'utf8'));
  const errors = validateMap(docsDir, rows);
  if (errors.length > 0) return { errors, files: new Map() };

  const files = new Map();
  for (const [relative, meta] of buildMeta(rows)) {
    files.set(relative, serialize(meta));
  }
  return { errors: [], files };
}

/**
 * @param {string} appDir
 * @param {{ check: boolean }} options
 * @returns {number} код возврата
 */
export function run(appDir, { check }) {
  const docsDir = path.join(appDir, 'docs');
  const { errors, files } = generate(docsDir);

  if (errors.length > 0) {
    for (const error of errors) console.error(`✗ ${error}`);
    return 1;
  }

  const drift = [];
  for (const [relative, content] of files) {
    const target = path.join(docsDir, relative);
    const current = fs.existsSync(target) ? fs.readFileSync(target, 'utf8') : null;
    if (current === content) continue;
    if (check) {
      drift.push(`docs/${relative}`);
    } else {
      fs.mkdirSync(path.dirname(target), { recursive: true });
      fs.writeFileSync(target, content);
      console.log(`✓ docs/${relative}: ${current === null ? 'создан' : 'обновлён'}`);
    }
  }

  if (check && drift.length > 0) {
    for (const file of drift) {
      console.error(
        `✗ ${file}: расходится с картой docs/README.md — запустите npm run docs:generate`,
      );
    }
    return 1;
  }

  // Лишний ADR-meta при пустом разделе — тоже рассинхрон с картой.
  const adrMeta = path.join(docsDir, ADR_META);
  if (!files.has(ADR_META) && fs.existsSync(adrMeta)) {
    console.error(
      `✗ docs/${ADR_META}: в карте нет ни одного ADR — удалите файл или добавьте строки`,
    );
    return 1;
  }

  if (!check) console.log(`документация: ${files.size} meta-файла в порядке`);
  return 0;
}

const invokedDirectly =
  process.argv[1] && path.resolve(process.argv[1]) === fileURLToPath(import.meta.url);

if (invokedDirectly) {
  const check = process.argv.includes('--check');
  const appDir = DEFAULT_APP_DIR;
  process.exit(run(appDir, { check }));
}
