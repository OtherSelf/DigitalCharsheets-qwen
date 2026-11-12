import crypto from 'crypto';

/**
 * ─── LANDMARK: SCRYPT HASHES ────────────────────────────────────────────────
 * Один формат хэша для всех секретов приложения (пароль, recovery-фраза):
 *
 *     scrypt$<N>$<r>$<p>$<salt base64url>$<hash base64url>
 *
 * Параметры лежат в самой строке, поэтому старые значения продолжают
 * проверяться после изменения констант, а сравнение — `timingSafeEqual`
 * (см. `timing.ts`). Соль на каждое значение своя: одинаковые пароли выглядят
 * на диске по-разному, таблицы предвычисления бесполезны.
 */

const SCRYPT_PREFIX = 'scrypt';
/** ~16 МБ памяти и ~50 мс на проверку — ощутимо для перебора, терпимо для входа. */
const SCRYPT_N = 16384;
const SCRYPT_R = 8;
const SCRYPT_P = 1;
const SCRYPT_MAXMEM = 64 * 1024 * 1024;
const SALT_BYTES = 16;
const KEY_LENGTH = 32;
/** Границы разумного при разборе чужого/битого хэша (защита от N = 2^30). */
const MAX_N = 1_048_576;
const MAX_R = 32;
const MAX_P = 16;

/** Похоже ли значение на scrypt-хэш этого формата. */
export function isScryptHash(value: unknown): value is string {
  return typeof value === 'string' && value.startsWith(`${SCRYPT_PREFIX}$`);
}

/** Захэшировать секрет с новой солью. */
export function hashSecret(secret: string): string {
  const salt = crypto.randomBytes(SALT_BYTES);
  const derived = crypto.scryptSync(secret, salt, KEY_LENGTH, {
    N: SCRYPT_N,
    r: SCRYPT_R,
    p: SCRYPT_P,
    maxmem: SCRYPT_MAXMEM,
  });
  return [
    SCRYPT_PREFIX,
    SCRYPT_N,
    SCRYPT_R,
    SCRYPT_P,
    salt.toString('base64url'),
    derived.toString('base64url'),
  ].join('$');
}

export interface ParsedScryptHash {
  n: number;
  r: number;
  p: number;
  salt: Buffer;
  hash: Buffer;
}

/** Разобрать хэш; `null` — формат/параметры не те. */
export function parseScryptHash(value: string): ParsedScryptHash | null {
  const parts = value.split('$');
  if (parts.length !== 6) return null;
  const [scheme, nRaw, rRaw, pRaw, saltB64, hashB64] = parts;
  if (scheme !== SCRYPT_PREFIX) return null;

  const n = Number(nRaw);
  const r = Number(rRaw);
  const p = Number(pRaw);
  if (!Number.isInteger(n) || n < 1024 || n > MAX_N) return null;
  if (!Number.isInteger(r) || r < 1 || r > MAX_R) return null;
  if (!Number.isInteger(p) || p < 1 || p > MAX_P) return null;

  const salt = Buffer.from(saltB64, 'base64url');
  const hash = Buffer.from(hashB64, 'base64url');
  if (salt.length < 8 || hash.length < 16) return null;
  return { n, r, p, salt, hash };
}

/** Совпадает ли секрет с сохранённым scrypt-хэшем (постоянное время). */
export function verifySecretHash(stored: unknown, secret: string): boolean {
  if (!isScryptHash(stored)) return false;
  const parsed = parseScryptHash(stored);
  if (!parsed) return false;

  let derived: Buffer;
  try {
    derived = crypto.scryptSync(secret, parsed.salt, parsed.hash.length, {
      N: parsed.n,
      r: parsed.r,
      p: parsed.p,
      maxmem: SCRYPT_MAXMEM,
    });
  } catch {
    // Битые параметры в файле: это не совпадение, а испорченные данные.
    return false;
  }
  if (derived.length !== parsed.hash.length) return false;
  return crypto.timingSafeEqual(derived, parsed.hash);
}
