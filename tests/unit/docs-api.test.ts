import fs from 'node:fs';
import path from 'node:path';

import { describe, expect, it } from 'vitest';

import { openApiDocument } from '@/lib/openapi';

/**
 * ─── LANDMARK: DOCS API MAP ─────────────────────────────────────────────────
 * `openapi.test.ts` сверяет машинную спеку с route.ts, но человеческая карта
 * в `docs/api.md` живёт отдельно и уже расходилась с ней: операции архива и
 * корзины были в OpenAPI, но не в таблице. Здесь обе стороны сравниваются как
 * множества «метод + путь»; новая операция обязана появиться в обеих.
 */

const API_DOC = path.join(process.cwd(), 'docs', 'api.md');
const HTTP_METHODS = ['get', 'post', 'put', 'patch', 'delete'] as const;

/** Строки таблиц вида `| \`GET\` | \`/api/...\` | ... |`. */
function documentedOperations(text: string): Set<string> {
  const operations = new Set<string>();
  for (const line of text.split('\n')) {
    const match = /^\|\s*`(GET|POST|PUT|PATCH|DELETE)`\s*\|\s*`([^`]+)`/.exec(
      line,
    );
    if (match) operations.add(`${match[1].toLowerCase()} ${match[2]}`);
  }
  return operations;
}

function specOperations(): Set<string> {
  const operations = new Set<string>();
  const paths = openApiDocument.paths as Record<
    string,
    Record<string, unknown>
  >;
  for (const [route, item] of Object.entries(paths)) {
    for (const method of HTTP_METHODS) {
      if (method in item) operations.add(`${method} ${route}`);
    }
  }
  return operations;
}

function difference(left: Set<string>, right: Set<string>): string[] {
  return [...left].filter((value) => !right.has(value)).sort();
}

describe('docs/api.md и OpenAPI', () => {
  it('карта эндпоинтов совпадает со спекой', () => {
    const text = fs.readFileSync(API_DOC, 'utf8');
    const documented = documentedOperations(text);
    const spec = specOperations();

    expect(difference(spec, documented), 'нет в docs/api.md').toEqual([]);
    expect(difference(documented, spec), 'нет в OpenAPI').toEqual([]);
  });

  it('описывает buildId у /api/version', () => {
    const text = fs.readFileSync(API_DOC, 'utf8');
    expect(text).toContain('buildId');
  });
});
