/**
 * Базовые request-фабрики для вызова route handler'ов как обычных функций:
 * HTTP-сервер не поднимается, origin фиктивный, важны метод, заголовки и тело.
 */

/** POST с JSON-телом; URL по умолчанию — заглушка, роут его не читает. */
export const json = (body: unknown, headers: Record<string, string> = {}) =>
  new Request('http://localhost/api/test', {
    method: 'POST',
    headers: { 'content-type': 'application/json', ...headers },
    body: JSON.stringify(body),
  });

/** Произвольный запрос по абсолютному URL. */
export const req = (
  url: string,
  method = 'GET',
  headers: Record<string, string> = {},
) => new Request(url, { method, headers });

/** `params` динамического сегмента Next App Router. */
export const params = (id: string) => ({ params: Promise.resolve({ id }) });
