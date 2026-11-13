import crypto from 'crypto';

/**
 * ─── LANDMARK: SHARE TOKEN ──────────────────────────────────────────────────
 * Гостевая ссылка — bearer-токен: кто угодно с ней видит лист в режиме
 * просмотра. Поэтому токен должен быть длинным и случайным, а на диске
 * хранится только его хэш (как у recovery-токенов): копия `shares.json` не
 * даёт открыть лист.
 *
 * 32 байта в base64url — 43 символа `[A-Za-z0-9_-]`. Этого достаточно, чтобы
 * подбор был бессмысленным, а URL не разрастался. Функции чистые; файловое
 * хранилище появится отдельным слоем и будет использовать их.
 */

export const SHARE_TOKEN_BYTES = 32;
export const SHARE_TOKEN_LENGTH = 43;

const SHARE_TOKEN_RE = new RegExp(`^[A-Za-z0-9_-]{${SHARE_TOKEN_LENGTH}}$`);

/** Новый случайный токен ссылки. */
export function generateShareToken(): string {
  return crypto.randomBytes(SHARE_TOKEN_BYTES).toString('base64url');
}

/**
 * Проверка формы токена до любых обращений к диску: 43 символа base64url,
 * без padding и посторонних символов.
 */
export function isShareToken(value: unknown): value is string {
  return typeof value === 'string' && SHARE_TOKEN_RE.test(value);
}

/** Хэш токена — ключ записи в `shares.json`; сам токен на диск не попадает. */
export function hashShareToken(token: string): string {
  return crypto.createHash('sha256').update(token, 'utf8').digest('hex');
}
