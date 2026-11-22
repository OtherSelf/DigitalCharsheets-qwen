import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';

import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

/**
 * ─── LANDMARK: DOCS META GENERATOR ──────────────────────────────────────────
 * `scripts/docs/meta.mjs` — единственный способ получить порядок страниц
 * `/docs` из карты `docs/README.md`. Тест проверяет то, что нельзя увидеть на
 * сайте: генератор падает на сироте и на строке без файла, `--check` ловит
 * рассинхрон, и нормальная карта даёт оба meta-файла без лишних страниц.
 */

interface MapRow {
  path: string;
  description: string;
}

interface Generator {
  parseMap(readme: string): MapRow[];
  validateMap(docsDir: string, rows: MapRow[]): string[];
  buildMeta(rows: MapRow[]): Map<string, Record<string, unknown>>;
  generate(docsDir: string): { errors: string[]; files: Map<string, string> };
  run(appDir: string, options: { check: boolean }): number;
}

let generator: Generator;
let appDir: string;

const README = `# Documentation

Intro text.

## Map

| File | What it covers |
| --- | --- |
| [one.md](one.md) | First |
| [adr/0001-a.md](adr/0001-a.md) | ADR one |
| [two.md](two.md) | Second |

## Conventions

- not a map row
`;

beforeEach(async () => {
  generator ??=
    (await import('../../scripts/docs/meta.mjs')) as unknown as Generator;
  appDir = fs.mkdtempSync(path.join(os.tmpdir(), 'dcs-docs-meta-'));
  vi.spyOn(console, 'log').mockImplementation(() => {});
  vi.spyOn(console, 'error').mockImplementation(() => {});
});

afterEach(() => {
  fs.rmSync(appDir, { recursive: true, force: true });
  vi.restoreAllMocks();
});

/** Создаёт минимальный docs/ с картой из `rows` и файлами из `files`. */
function writeDocs({
  rows = ['one.md', 'adr/0001-a.md', 'two.md'],
  files = ['one.md', 'adr/0001-a.md', 'two.md'],
  readme = README,
} = {}) {
  const docs = path.join(appDir, 'docs');
  fs.mkdirSync(path.join(docs, 'adr'), { recursive: true });
  const table = rows
    .map((file) => `| [${file}](${file}) | ${file} |`)
    .join('\n');
  fs.writeFileSync(
    path.join(docs, 'README.md'),
    readme.replace(
      /^\| \[one\.md\][\s\S]*?^\| \[two\.md\]\(two\.md\) \| Second \|$/m,
      table,
    ),
  );
  for (const file of files) {
    fs.writeFileSync(path.join(docs, file), `# ${file}\n`);
  }
  return docs;
}

describe('docs/meta.json: карта → порядок страниц', () => {
  it('разбирает только таблицу ## Map', () => {
    const rows = generator.parseMap(README);
    expect(rows.map((row) => row.path)).toEqual([
      'one.md',
      'adr/0001-a.md',
      'two.md',
    ]);
  });

  it('собирает корневой meta с папкой ADR на её месте и ссылкой на API', () => {
    const rows = generator.parseMap(README);
    const meta = generator.buildMeta(rows);
    expect([...meta.keys()]).toEqual(['meta.json', 'adr/meta.json']);
    expect(meta.get('meta.json')?.pages).toEqual([
      'one',
      'adr',
      'two',
      'external:[API reference](/api/docs)',
    ]);
    expect(meta.get('adr/meta.json')?.pages).toEqual(['0001-a']);
  });

  it('нормальная карта генерируется и сходится в режиме --check', () => {
    const docs = writeDocs();
    const { errors, files } = generator.generate(docs);
    expect(errors).toEqual([]);
    expect([...files.keys()].sort()).toEqual(['adr/meta.json', 'meta.json']);

    expect(generator.run(appDir, { check: false })).toBe(0);
    expect(generator.run(appDir, { check: true })).toBe(0);
  });
});

describe('docs/meta.json: расхождения карты и файлов', () => {
  it('файл без строки в карте — ошибка', () => {
    const docs = writeDocs({
      files: ['one.md', 'adr/0001-a.md', 'two.md', 'orphan.md'],
    });
    const { errors } = generator.generate(docs);
    expect(errors.join('\n')).toContain('orphan.md');
    expect(errors.join('\n')).toContain('нет в карте');
  });

  it('строка карты без файла — ошибка', () => {
    const docs = writeDocs({ files: ['one.md', 'adr/0001-a.md'] });
    const { errors } = generator.generate(docs);
    expect(errors.join('\n')).toContain('two.md');
    expect(errors.join('\n')).toContain('файла');
  });

  it('устаревший meta.json ловится в режиме --check и не перезаписывается', () => {
    const docs = writeDocs();
    expect(generator.run(appDir, { check: false })).toBe(0);
    const metaPath = path.join(docs, 'meta.json');
    fs.writeFileSync(metaPath, '{}\n');

    expect(generator.run(appDir, { check: true })).toBe(1);
    expect(fs.readFileSync(metaPath, 'utf8')).toBe('{}\n');

    expect(generator.run(appDir, { check: false })).toBe(0);
    expect(generator.run(appDir, { check: true })).toBe(0);
  });

  it('лишний adr/meta.json без ADR в карте — ошибка', () => {
    const docs = writeDocs({ rows: ['one.md', 'two.md'] });
    fs.writeFileSync(path.join(docs, 'adr', 'meta.json'), '{}\n');
    expect(generator.run(appDir, { check: true })).toBe(1);
  });
});
