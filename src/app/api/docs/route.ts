import { ApiReference } from '@scalar/nextjs-api-reference';

/**
 * ─── LANDMARK: API DOCS (SCALAR) ───────────────────────────────────────────
 * GET /api/docs — интерактивная документация по /api/openapi.json.
 *
 * UI собирается Scalar на клиенте, а сам бандл отдаётся со своего origin из
 * `public/vendor/scalar/`: CSP приложения (`script-src 'self'`, next.config.ts)
 * не пропускает сторонние хосты скриптов, и внешний `cdn` оставлял страницу
 * пустой. Оттуда же берётся работа в закрытом контуре без интернета.
 *
 * Версия бандла фиксирована и совпадает с именем файла в vendor: иначе внешний
 * мажорный релиз мог бы сломать страницу без изменений в репозитории.
 * `bundle: false` выбирает UMD-сборку по адресу `cdn` (ESM-вариант не
 * поддерживает `cdn`). Как обновлять файл — `public/vendor/scalar/README.md`.
 */
const SCALAR_VERSION = '1.78.0';

export const dynamic = 'force-static';

export const GET = ApiReference({
  url: '/api/openapi.json',
  pageTitle: 'Digital Character Sheets API',
  cdn: `/vendor/scalar/api-reference-${SCALAR_VERSION}.js`,
  bundle: false,
  theme: 'default',
});
