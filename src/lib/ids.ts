import crypto from 'crypto';

/**
 * Идентификаторы пользователя.
 *
 * ─── LANDMARK: IMMUTABLE USER ID ─────────────────────────────────────────────
 * Раньше uid вычислялся из логина (`user-<base36-хеш>`), поэтому смена логина
 * означала физический перенос каталога с листами. Теперь uid — случайный и
 * неизменяемый: он выдаётся один раз при регистрации и живёт в `user.json`,
 * а логин — обычный изменяемый атрибут (см. `user-index.ts`).
 *
 * UID попадает в путь `<data-dir>/users/<uid>/`, поэтому формат проверяется:
 * только строчные hex и дефисы (UUID v4). Это защищает от `..` и `/` в пути,
 * даже если значение когда-нибудь придёт не из cookie.
 */

const UID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/;

/** Новый неизменяемый идентификатор пользователя (UUID v4). */
export function newUid(): string {
  return crypto.randomUUID();
}

/** Проверка формата uid. */
export function isUid(value: unknown): value is string {
  return typeof value === 'string' && UID_RE.test(value);
}

/**
 * Логин нормализуется одинаково при регистрации, входе, смене логина и
 * восстановлении: без регистра и внешних пробелов. Именно эта строка — ключ
 * индекса `логин → uid`.
 */
export function normalizeLogin(login: string): string {
  return String(login ?? '')
    .toLowerCase()
    .trim();
}

/** Человекочитаемое имя по умолчанию: часть логина до `@`. */
export function defaultDisplayName(login: string): string {
  return normalizeLogin(login).split('@')[0];
}
