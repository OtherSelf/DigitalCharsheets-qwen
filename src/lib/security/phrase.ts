import crypto from 'crypto';

import { safeStringEqual } from './timing';

/**
 * ─── LANDMARK: RECOVERY PHRASE ──────────────────────────────────────────────
 * Recovery-фраза — секрет, доказывающий владение аккаунтом, поэтому:
 *
 *   1) на диске лежит **хэш** (`scrypt$N$r$p$<salt>$<hash>`), как у пароля:
 *      копия `user.json` больше не выдаёт фразу;
 *   2) сравнение — **полное**: канонизированные слова должны совпасть и по
 *      составу, и по порядку. «Хотя бы одно слово» и «слова из листов»
 *      доказательством владения не являются (их знает любой, кто видел лист);
 *   3) сравнение не зависит от длины и позиции расхождения — `timingSafeEqual`.
 *
 * Нормализация не зависит от алфавита: `toLowerCase` + `normalize('NFC')` и
 * разбиение по пробелам работают для кириллицы и латиницы одинаково, в отличие
 * от `\b`-регулярки, которая на кириллице не срабатывала.
 */

const SCRYPT_PREFIX = 'scrypt';
/** Параметры scrypt: ~16 МБ памяти и ~50 мс на проверку. */
const SCRYPT_N = 16384;
const SCRYPT_R = 8;
const SCRYPT_P = 1;
const SCRYPT_MAXMEM = 64 * 1024 * 1024;
const SALT_BYTES = 16;
const KEY_LENGTH = 32;
/** Границы разумного при разборе чужого/битого хэша (защита от N=2^30). */
const MAX_N = 1_048_576;
const MAX_R = 32;
const MAX_P = 16;

/** Слова фразы в каноническом виде. */
export function normalizePhraseWords(phrase: unknown): string[] {
  if (typeof phrase !== 'string') return [];
  return phrase
    .toLowerCase()
    .normalize('NFC')
    .trim()
    .split(/\s+/)
    .filter((word) => word.length > 0);
}

/** Каноническая строка фразы: слова через один пробел. */
export function normalizePhrase(phrase: unknown): string {
  return normalizePhraseWords(phrase).join(' ');
}

/** Похоже ли значение на хэш фразы (а не на старый открытый текст). */
export function isRecoveryPhraseHash(value: unknown): value is string {
  return typeof value === 'string' && value.startsWith(`${SCRYPT_PREFIX}$`);
}

/** Захэшировать фразу. Формат версионирован: параметры лежат в строке. */
export function hashRecoveryPhrase(phrase: string): string {
  const normalized = normalizePhrase(phrase);
  const salt = crypto.randomBytes(SALT_BYTES);
  const derived = crypto.scryptSync(normalized, salt, KEY_LENGTH, {
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

interface ParsedHash {
  n: number;
  r: number;
  p: number;
  salt: Buffer;
  hash: Buffer;
}

function parseHash(value: string): ParsedHash | null {
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

/**
 * Совпадает ли ввод с сохранённой фразой.
 *
 * Старый формат (фраза открытым текстом) поддерживается только для чтения:
 * вызывающий код, убедившись в совпадении, обязан перезаписать значение
 * хэшем — это делает `verifyRecovery` в `server-auth.ts`.
 */
export function recoveryPhraseMatches(stored: unknown, input: string): boolean {
  const normalized = normalizePhrase(input);
  if (!normalized) return false;
  if (typeof stored !== 'string' || stored === '') return false;

  if (!isRecoveryPhraseHash(stored)) {
    // Legacy: сравнение канонических строк за постоянное время.
    return safeStringEqual(normalizePhrase(stored), normalized);
  }

  const parsed = parseHash(stored);
  if (!parsed) return false;

  let derived: Buffer;
  try {
    derived = crypto.scryptSync(normalized, parsed.salt, parsed.hash.length, {
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
