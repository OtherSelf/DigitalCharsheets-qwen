/**
 * ─── LANDMARK: ERROR PAGE CODES ─────────────────────────────────────────────
 * Статусы, для которых приложение показывает отдельный человеческий экран, а
 * не сырой ответ Next. Список — часть контракта: `/error/<code>` строит
 * статические страницы только для него, а неизвестный код уходит в `notFound`.
 *
 * 413 и 409 выбраны не случайно: это реальные ответы API (слишком большое
 * тело запроса, конфликт версий), и пользователю нужен экран с объяснением,
 * а не JSON-ошибка. 4xx/5xx, которых здесь нет, остаются обычными ответами
 * API — выдумывать для них страницу без сценария нельзя.
 */

export const ERROR_PAGE_CODES = [
  400, 401, 403, 404, 409, 413, 429, 500, 503,
] as const;

export type ErrorPageCode = (typeof ERROR_PAGE_CODES)[number];

/** Доступные действия на экране ошибки; кнопка `retry` требует обработчик. */
export interface ErrorPageActions {
  readonly home?: boolean;
  readonly login?: boolean;
  readonly back?: boolean;
  readonly retry?: boolean;
  readonly reload?: boolean;
}

/**
 * Что осмысленно предложить на каждом статусе. `retry` — повтор запроса без
 * перезагрузки (есть только у границы рендера); `reload` — полная перезагрузка
 * вкладки. Для 401 предлагаем вход, для 429 — перезагрузку, а не «повторить
 * сейчас же».
 */
export const ERROR_PAGE_ACTIONS: Readonly<
  Record<ErrorPageCode, ErrorPageActions>
> = {
  400: { home: true, back: true },
  401: { login: true, home: true },
  403: { home: true, back: true },
  404: { home: true, back: true },
  409: { retry: true, reload: true, home: true },
  413: { back: true, home: true },
  429: { reload: true, home: true },
  500: { retry: true, reload: true, home: true },
  503: { reload: true, home: true },
};

/** Действие в шапке: 401 ведёт на вход, остальные — по текущей сессии. */
export function errorHeaderAction(code: ErrorPageCode): 'login' | 'auto' {
  return code === 401 ? 'login' : 'auto';
}

/**
 * Код из контракта — число. Строку (`params.code` из URL) сначала разбирает
 * `parseErrorPageCode`: предикат, который объявляет строку числом, врёт о типе,
 * и `code === 404` для `"404"` не срабатывает.
 */
function isErrorPageCode(value: unknown): value is ErrorPageCode {
  return (
    typeof value === 'number' &&
    (ERROR_PAGE_CODES as readonly number[]).includes(value)
  );
}

/**
 * Разобрать код из URL/`params`. `null` — код вне контракта, вызывающий
 * отдаёт `notFound()`. Возвращает уже `ErrorPageCode`, поэтому вызывающему не
 * приходится сужать `string | number` самому.
 */
export function parseErrorPageCode(
  value: string | number | null | undefined,
): ErrorPageCode | null {
  if (value === null || value === undefined) return null;
  const code = typeof value === 'number' ? value : Number(value);
  return isErrorPageCode(code) ? code : null;
}
