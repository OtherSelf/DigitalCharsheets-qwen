import { describe, expect, it } from 'vitest';

import { CHUNK_ERROR_PATTERNS, isChunkLoadError } from '@/lib/chunk-error';

/**
 * Распознавание чанк-ошибки — единственное, что решает, получит ли вкладка
 * выход из «лист недоступен». Формулировки разные у webpack, браузера и
 * Turbopack, поэтому проверяем каждую и то, что обычные ошибки не задеты.
 */
const chunkErrors: Array<[string, unknown]> = [
  ['webpack Error', new Error('ChunkLoadError: Loading chunk 42 failed.')],
  ['webpack без префикса', new Error('Loading chunk 7 failed.')],
  [
    'браузерный dynamic import',
    new Error(
      'Failed to fetch dynamically imported module: /_next/static/x.js',
    ),
  ],
  ['module script', new Error('Importing a module script failed.')],
  ['Turbopack', new Error('but the module factory is not available')],
  ['строка со ссылкой на чанк', 'TypeError: /_next/static/chunks/main.js 404'],
  ['объект без Error', { name: 'Error', message: 'Loading chunk 3 failed' }],
];

describe('isChunkLoadError', () => {
  it.each(chunkErrors)('узнаёт ошибку: %s', (_label, error) => {
    expect(isChunkLoadError(error)).toBe(true);
  });

  it('не считает чанк-ошибкой обычные падения и мусор', () => {
    expect(isChunkLoadError(new TypeError('cannot read properties'))).toBe(
      false,
    );
    expect(isChunkLoadError(new Error('Не удалось сохранить лист'))).toBe(
      false,
    );
    expect(isChunkLoadError(undefined)).toBe(false);
    expect(isChunkLoadError(null)).toBe(false);
    expect(isChunkLoadError(42)).toBe(false);
    expect(isChunkLoadError({})).toBe(false);
  });

  it('список паттернов непустой и содержит Turbopack-формулировку', () => {
    expect(CHUNK_ERROR_PATTERNS.length).toBeGreaterThan(4);
    expect(CHUNK_ERROR_PATTERNS).toContain('module factory is not available');
  });
});
