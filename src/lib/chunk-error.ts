// src/lib/chunk-error.ts

/**
 * ─── LANDMARK: CHUNK ERROR ──────────────────────────────────────────────────
 * Ошибка загрузки чанка выглядит как угодно в зависимости от браузера и
 * бандлера, а общего кода у неё нет. Распознаём по тексту: это единственное,
 * что доступно и в React-границе (`error.message`), и в `window.onerror`.
 *
 * Зачем: после деплоя или рестарта стенда вкладка ссылается на удалённые
 * файлы, и без этого распознавания пользователь видит мёртвую карточку
 * «лист недоступен» без выхода. Распознанная ошибка даёт одно восстановление
 * (перезагрузку или «Повторить»), см. `error.tsx` и `sheet-error-boundary.tsx`.
 */
export const CHUNK_ERROR_PATTERNS = [
  // webpack / Next: имя ошибки и текст запроса чанка.
  'ChunkLoadError',
  'Loading chunk',
  // Динамический `import()` в браузере.
  'Failed to fetch dynamically imported module',
  'Importing a module script failed',
  // Turbopack после рестарта dev-сервера: вкладка патчит чужой граф модулей.
  'module factory is not available',
  // Общий признак: в тексте фигурирует адрес нашего же чанка.
  '/_next/static/',
] as const;

/** Текст ошибки в одном поле — из Error, DOMException, строки или события. */
function describeError(error: unknown): string {
  if (typeof error === 'string') return error;

  if (error instanceof Error) return `${error.name}: ${error.message}`;

  if (error && typeof error === 'object') {
    const { message, name } = error as { message?: unknown; name?: unknown };
    if (typeof message === 'string') {
      return typeof name === 'string' && name !== ''
        ? `${name}: ${message}`
        : message;
    }
  }

  return '';
}

export function isChunkLoadError(error: unknown): boolean {
  const text = describeError(error);
  if (text === '') return false;
  return CHUNK_ERROR_PATTERNS.some((pattern) => text.includes(pattern));
}
