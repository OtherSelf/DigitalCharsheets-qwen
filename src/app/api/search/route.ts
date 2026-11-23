import { createFromSource } from 'fumadocs-core/search/server';

import { jsonError } from '@/lib/api/respond';
import { docsSource } from '@/lib/docs/source';
import {
  getAuthRateLimiter,
  rateLimitKey,
  SEARCH_RATE_LIMIT,
} from '@/lib/security/rate-limit';

/**
 * ─── LANDMARK: DOCS SEARCH (/api/search) ────────────────────────────────────
 * Поиск по документации на своём origin: `createFromSource` строит индекс из
 * `structuredData` страниц, обработчик отвечает на `?query=`.
 *
 * Почему не `staticGET` (готовый JSON на билде): экспорт всех индексов весит
 * ~450 КБ в gzip, а HTML-правило заголовков отдаёт `/api/*` с `no-store` —
 * браузер тянул бы его заново при каждом открытии поиска. Здесь сервер держит
 * индекс в памяти (20 страниц), а в браузер уходят только совпадения.
 *
 * Роут не является публичным API: `tests/unit/openapi.test.ts` исключает его
 * из сверки со спекой наравне с `/api/docs`.
 */
export const dynamic = 'force-dynamic';

const searchHandler = createFromSource(docsSource);

/**
 * Лимит по IP: поиск строит ответ по индексу в памяти, но не должен быть
 * бесплатным способом нагрузить процесс. GET, поэтому сессия не обязательна.
 */
export async function GET(request: Request) {
  const limiter = getAuthRateLimiter().check(
    rateLimitKey('search', request),
    SEARCH_RATE_LIMIT,
  );
  if (!limiter.allowed) {
    return jsonError(
      429,
      'Too many search requests. Try again later.',
      'rate_limited',
      { 'Retry-After': String(limiter.retryAfterSeconds) },
    );
  }
  return searchHandler.GET(request);
}
