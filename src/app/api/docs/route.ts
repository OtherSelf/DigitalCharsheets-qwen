import { ApiReference } from '@scalar/nextjs-api-reference';

/**
 * ─── LANDMARK: API DOCS (SCALAR) ───────────────────────────────────────────
 * GET /api/docs — интерактивная документация по /api/openapi.json.
 *
 * UI собирается Scalar на клиенте и подгружается с jsDelivr. Версию бандла
 * фиксируем, а не берём latest: иначе внешний мажорный релиз мог бы сломать
 * страницу без каких-либо изменений в нашем репозитории. `bundle: false`
 * выбирает UMD-сборку по адресу `cdn` (ESM-вариант не поддерживает
 * фиксированный `cdn`).
 *
 * Если нужна работа в закрытом контуре без интернета — можно положить бандл
 * Scalar в `public/` и указать здесь локальный `cdn`.
 */
const SCALAR_VERSION = '1.78.0';

export const dynamic = 'force-static';

export const GET = ApiReference({
  url: '/api/openapi.json',
  pageTitle: 'Digital Character Sheets API',
  cdn: `https://cdn.jsdelivr.net/npm/@scalar/api-reference@${SCALAR_VERSION}`,
  bundle: false,
  theme: 'default',
});
