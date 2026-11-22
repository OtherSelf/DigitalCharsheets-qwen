import { createFromSource } from 'fumadocs-core/search/server';

import { docsSource } from '@/lib/docs/source';

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

export const { GET } = createFromSource(docsSource);
