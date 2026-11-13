/**
 * ─── LANDMARK: JSON BODY LIMIT ──────────────────────────────────────────────
 * Тело запроса от клиента — входные данные, и «сколько там байт» решает
 * клиент. Без лимита один PUT с многомегабайтным `backstory` уходит в память
 * процесса, в JSON.parse и в файл листа на диске.
 *
 * Лимит проверяется дважды: по `Content-Length` (дешёво, до чтения) и по факту
 * прочитанной строки (заголовку можно не верить или не прислать его вовсе).
 * Ответ — `413`, а не `500`: для клиента это понятная ошибка ввода.
 */

export const MAX_CHARACTER_BODY_BYTES = 1024 * 1024;

export type ReadJsonBodyResult =
  | { ok: true; body: Record<string, unknown> }
  | {
      ok: false;
      status: 400 | 413;
      error: string;
      reason: 'bad_request' | 'payload_too_large';
      issues?: undefined;
    };

/**
 * Прочитать JSON-объект из запроса с ограничением размера.
 * Массив, `null` и примитивы — это `400`: ожидается объект.
 */
export async function readJsonObject(
  request: Request,
  maxBytes: number = MAX_CHARACTER_BODY_BYTES,
): Promise<ReadJsonBodyResult> {
  const declared = Number(request.headers.get('content-length') ?? '');
  if (Number.isFinite(declared) && declared > maxBytes) {
    return {
      ok: false,
      status: 413,
      error: `Request body is too large (limit ${maxBytes} bytes).`,
      reason: 'payload_too_large',
    };
  }

  let text: string;
  try {
    text = await request.text();
  } catch {
    return {
      ok: false,
      status: 400,
      error: 'Invalid or empty JSON body.',
      reason: 'bad_request',
    };
  }

  // `text.length` — символы UTF-16; для лимита важны байты. Буфер считаем
  // один раз: тела листов обычно небольшие.
  const bytes = Buffer.byteLength(text, 'utf8');
  if (bytes > maxBytes) {
    return {
      ok: false,
      status: 413,
      error: `Request body is too large (limit ${maxBytes} bytes).`,
      reason: 'payload_too_large',
    };
  }

  let parsed: unknown;
  try {
    parsed = JSON.parse(text);
  } catch {
    return {
      ok: false,
      status: 400,
      error: 'Invalid or empty JSON body.',
      reason: 'bad_request',
    };
  }

  if (!parsed || typeof parsed !== 'object' || Array.isArray(parsed)) {
    return {
      ok: false,
      status: 400,
      error: 'Invalid JSON body: expected an object.',
      reason: 'bad_request',
    };
  }

  return { ok: true, body: parsed as Record<string, unknown> };
}
