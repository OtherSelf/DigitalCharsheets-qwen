import fs from 'node:fs';
import path from 'node:path';

import { describe, expect, it } from 'vitest';

/**
 * ─── LANDMARK: DECISION REFERENCES ─────────────────────────────────────────
 * `docs/decisions.md` — легенда для ссылок `D<n>` в документации, коде и
 * комментариях. Ссылка на несуществующий номер — тупик: читатель не может
 * узнать, что решили. Тест держит инвариант «каждая D-ссылка резолвится» и
 * запрещает перенумерацию (номера стабильны, отменённое помечается в тексте).
 */

const ROOT = process.cwd();
const DECISIONS = path.join(ROOT, 'docs', 'decisions.md');

/** Обход каталога с фильтром по расширениям. */
function walk(dir: string, extensions: readonly string[]): string[] {
  if (!fs.existsSync(dir)) return [];
  return fs.readdirSync(dir, { withFileTypes: true }).flatMap((entry) => {
    const full = path.join(dir, entry.name);
    if (entry.isDirectory()) return walk(full, extensions);
    return extensions.some((ext) => entry.name.endsWith(ext)) ? [full] : [];
  });
}

/** Номера решений из таблицы `| D<n> | … |`. */
function canonicalNumbers(): number[] {
  const text = fs.readFileSync(DECISIONS, 'utf8');
  return [...text.matchAll(/^\| D(\d+) \|/gm)].map((match) => Number(match[1]));
}

/** Ссылки `D<n>` во всех файлах, кроме самой легенды. */
function referencedNumbers(): { file: string; number: number }[] {
  const files = [
    ...walk(path.join(ROOT, 'docs'), ['.md']),
    ...walk(path.join(ROOT, 'src'), ['.ts', '.tsx']),
    ...walk(path.join(ROOT, 'scripts'), ['.mjs', '.json']),
    ...walk(path.join(ROOT, 'tests'), ['.ts', '.tsx', '.json']),
  ].filter((file) => file !== DECISIONS);

  return files.flatMap((file) => {
    const text = fs.readFileSync(file, 'utf8');
    return [...text.matchAll(/\bD(\d+)\b/g)].map((match) => ({
      file: path.relative(ROOT, file),
      number: Number(match[1]),
    }));
  });
}

describe('ссылки на решения (D)', () => {
  it('легенда содержит D1–D32 без дыр и повторов', () => {
    const numbers = canonicalNumbers().sort((a, b) => a - b);
    expect(numbers).toEqual(
      Array.from({ length: 32 }, (_, index) => index + 1),
    );
  });

  it('каждая D-ссылка в docs, src, scripts и tests есть в легенде', () => {
    const known = new Set(canonicalNumbers());
    const dangling = referencedNumbers()
      .filter(({ number }) => !known.has(number))
      .map(({ file, number }) => `${file}: D${number}`);
    expect([...new Set(dangling)].sort()).toEqual([]);
  });

  it('в репозитории нет ссылок на внешние планы _NEW_*_PROMPT', () => {
    const leftovers = [
      ...walk(path.join(ROOT, 'docs'), ['.md']),
      ...walk(path.join(ROOT, 'src'), ['.ts', '.tsx']),
      ...walk(path.join(ROOT, 'scripts'), ['.mjs', '.json']),
    ]
      .filter((file) =>
        /_NEW_[A-Z0-9_]*_PROMPT/.test(fs.readFileSync(file, 'utf8')),
      )
      .map((file) => path.relative(ROOT, file));
    expect(leftovers).toEqual([]);
  });
});
