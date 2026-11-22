import fs from 'node:fs';
import path from 'node:path';

import { describe, expect, it } from 'vitest';

/**
 * ─── LANDMARK: DOCS INTEGRITY ───────────────────────────────────────────────
 * `/docs` рендерит существующие `docs/*.md`, поэтому расхождение между картой
 * `docs/README.md`, файлами и `meta.json` видно только в браузере. Здесь оно
 * ловится в обычном `npm test`:
 *
 *   • каждая строка карты указывает на существующий файл;
 *   • каждый файл, кроме README, есть в карте (сирот нет);
 *   • `docs/meta.json` и `docs/adr/meta.json` совпадают с генератором;
 *   • у страницы есть `title`/`description`, `title` повторяет первый `# H1`;
 *   • относительные ссылки на `*.md` внутри `docs/` ведут на существующие
 *     страницы, а не за пределы каталога.
 */

const ROOT = process.cwd();
const DOCS = path.join(ROOT, 'docs');
const README = 'README.md';

interface MapRow {
  path: string;
  description: string;
}

interface MetaGenerator {
  parseMap(readme: string): MapRow[];
  buildMeta(rows: MapRow[]): Map<string, object>;
}

let generatorPromise: Promise<MetaGenerator> | undefined;

function generator(): Promise<MetaGenerator> {
  generatorPromise ??= import('../../scripts/docs/meta.mjs').then(
    (module) => module as unknown as MetaGenerator,
  );
  return generatorPromise;
}

function walk(dir: string, base = dir): string[] {
  return fs.readdirSync(dir, { withFileTypes: true }).flatMap((entry) => {
    const full = path.join(dir, entry.name);
    if (entry.isDirectory()) return walk(full, base);
    if (!entry.name.endsWith('.md')) return [];
    return [path.relative(base, full).split(path.sep).join('/')];
  });
}

function readPage(relative: string) {
  const text = fs.readFileSync(path.join(DOCS, relative), 'utf8');
  const match = /^---\n([\s\S]*?)\n---\n\n?/.exec(text);
  const frontmatter = match?.[1] ?? '';
  const body = match ? text.slice(match[0].length) : text;

  const value = (key: string): string | undefined => {
    const line = new RegExp(`^${key}: (.+)$`, 'm').exec(frontmatter)?.[1];
    if (!line) return undefined;
    return line.startsWith('"') ? JSON.parse(line) : line;
  };

  return {
    frontmatter,
    body,
    title: value('title'),
    description: value('description'),
  };
}

/** Первый заголовок первого уровня — то, что видит читатель на странице. */
function firstHeading(body: string): string | undefined {
  return body
    .split('\n')
    .find((line) => line.startsWith('# '))
    ?.slice(2)
    .trim();
}

/** Снимает inline-разметку, чтобы сравнить описание с колонкой карты. */
function plain(text: string): string {
  return text
    .replace(/\*\*(.+?)\*\*/g, '$1')
    .replace(/`([^`]+)`/g, '$1')
    .trim();
}

/** Ссылки из markdown вне код-блоков и inline-кода. */
function links(text: string): string[] {
  const withoutFences = text.replace(/^(`{3,}|~{3,})[\s\S]*?^\1/gm, '');
  const withoutInlineCode = withoutFences.replace(/`[^`\n]*`/g, '');
  return [...withoutInlineCode.matchAll(/\[[^\]]*\]\(([^)\s]+)\)/g)].map(
    (match) => match[1],
  );
}

const pages = walk(DOCS).sort();

async function readMap(): Promise<MapRow[]> {
  const { parseMap } = await generator();
  return parseMap(fs.readFileSync(path.join(DOCS, README), 'utf8'));
}

describe('docs: карта и файлы', () => {
  it('каждая строка карты указывает на существующий файл', async () => {
    const rows = await readMap();
    expect(rows.length, 'карта пуста или сломалась').toBeGreaterThan(15);
    const missing = rows
      .filter((row) => !pages.includes(row.path))
      .map((row) => row.path);
    expect(missing, 'в карте есть, файла нет').toEqual([]);
  });

  it('сирот нет: каждый файл, кроме README, есть в карте', async () => {
    const rows = await readMap();
    const listed = new Set(rows.map((row) => row.path));
    const orphans = pages.filter(
      (page) => page !== README && !listed.has(page),
    );
    expect(orphans, 'файл без строки в карте').toEqual([]);
  });

  it('README — единственная страница вне карты', async () => {
    const rows = await readMap();
    const listed = new Set(rows.map((row) => row.path));
    expect(pages.includes(README)).toBe(true);
    expect(listed.has(README)).toBe(false);
  });

  it('docs/meta.json и docs/adr/meta.json совпадают с генератором', async () => {
    const { buildMeta } = await generator();
    const meta = buildMeta(await readMap());
    for (const [relative, expected] of meta) {
      const file = path.join(DOCS, relative);
      expect(
        fs.existsSync(file),
        `нет docs/${relative} — запустите npm run docs:generate`,
      ).toBe(true);
      expect(JSON.parse(fs.readFileSync(file, 'utf8'))).toEqual(expected);
    }
  });
});

describe('docs: frontmatter', () => {
  it('title повторяет первый # H1, description — строку карты', async () => {
    const descriptions = new Map(
      (await readMap()).map((row) => [row.path, plain(row.description)]),
    );
    const problems: string[] = [];

    for (const page of pages) {
      const { frontmatter, title, description } = readPage(page);
      const heading = firstHeading(readPage(page).body);
      if (!frontmatter) problems.push(`${page}: нет frontmatter`);
      if (!title) problems.push(`${page}: пустой title`);
      if (!description) problems.push(`${page}: пустой description`);
      if (title !== heading) {
        problems.push(`${page}: title «${title}» ≠ H1 «${heading}»`);
      }
      const expected = descriptions.get(page);
      if (expected !== undefined && description !== expected) {
        problems.push(`${page}: description разошёлся с картой`);
      }
    }

    expect(problems).toEqual([]);
  });

  it('на каждой странице один # H1 вне код-блоков', () => {
    const problems = pages
      .map((page) => {
        // В README и game-modules.md есть `# ` внутри примеров кода — они не
        // заголовки страницы, поэтому код-блоки исключаются.
        const body = readPage(page).body.replace(
          /^(`{3,}|~{3,})[\s\S]*?^\1/gm,
          '',
        );
        const count = body.match(/^# /gm)?.length ?? 0;
        return { page, count };
      })
      .filter(({ count }) => count !== 1)
      .map(({ page, count }) => `${page}: H1 × ${count}`);
    expect(problems).toEqual([]);
  });
});

describe('docs: ссылки', () => {
  it('относительные *.md ведут на существующий файл', async () => {
    const problems: string[] = [];
    for (const page of pages) {
      const text = readPage(page).body;
      for (const href of links(text)) {
        if (!href || href.startsWith('#') || href.startsWith('/')) continue;
        if (/^[a-z][a-z0-9+.-]*:/i.test(href)) continue;
        const [pathPart] = href.split('#');
        if (!pathPart.endsWith('.md')) continue;

        const absolute = path.resolve(
          path.dirname(path.join(DOCS, page)),
          pathPart,
        );
        const insideDocs = path.relative(DOCS, absolute);
        // Внутри docs/ ссылка обязана вести на страницу из карты: по ней
        // remark-плагин строит /docs/<slug>. Снаружи — на существующий файл
        // репозитория (на сайте он станет кодом, на GitHub останется ссылкой).
        if (insideDocs.startsWith('..') || path.isAbsolute(insideDocs)) {
          if (!fs.existsSync(absolute)) problems.push(`${page}: ${href}`);
          continue;
        }
        const target = insideDocs.split(path.sep).join('/');
        if (!pages.includes(target)) problems.push(`${page}: ${href}`);
      }
    }
    expect(problems, 'относительная *.md-ссылка в никуда').toEqual([]);
  });
});
