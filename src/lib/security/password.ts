import crypto from 'crypto';

import {
  hashSecret,
  hashSecretAsync,
  isCurrentScryptParams,
  isScryptHash,
  verifySecretHash,
  verifySecretHashAsync,
} from './scrypt';
import { safeStringEqual } from './timing';

export {
  MAX_PASSWORD_LENGTH,
  MIN_PASSWORD_LENGTH,
  passwordPolicyError,
} from './password-policy';

/**
 * ─── LANDMARK: PASSWORD STORAGE ─────────────────────────────────────────────
 * Пароль на диске — соль + scrypt-хэш (формат и параметры в `scrypt.ts`),
 * сравнение — за постоянное время. Старые значения (несолёный sha256, без
 * префикса формата) читаются один раз: успешный вход возвращает
 * `needsRehash`, и вызывающий перезаписывает хэш.
 *
 * Политика длины живёт в `password-policy.ts` — клиентские формы импортируют
 * её, не подтягивая Node-криптографию. Вход длину не проверяет: иначе
 * аккаунты, созданные до политики, потеряли бы доступ, ничего не нарушив.
 */

/** sha256-хэш старого формата: 64 шестнадцатеричных символа. */
const LEGACY_SHA256_RE = /^[0-9a-f]{64}$/;

export interface PasswordCheck {
  valid: boolean;
  /** Хэш устарел (старый формат) — его нужно перезаписать после входа. */
  needsRehash: boolean;
}

/** Хэш нового пароля. */
export function hashPassword(password: string): string {
  return hashSecret(password);
}

function invalidPasswordCheck(): PasswordCheck {
  return { valid: false, needsRehash: false };
}

/** Пустой/нестроковый вход — отказ без обращения к хэшу. */
function readPasswordInputs(
  storedHash: unknown,
  password: unknown,
): { storedHash: string; password: string } | null {
  if (typeof storedHash !== 'string' || storedHash === '') return null;
  if (typeof password !== 'string' || password === '') return null;
  return { storedHash, password };
}

/** Старый формат sha256: успешный вход требует перехэширования. */
function verifyLegacySha256(
  storedHash: string,
  password: string,
): PasswordCheck | null {
  if (!LEGACY_SHA256_RE.test(storedHash)) return null;
  const legacy = crypto.createHash('sha256').update(password).digest('hex');
  const valid = safeStringEqual(storedHash, legacy);
  return { valid, needsRehash: valid };
}

/** Проверить пароль по сохранённому значению. */
export function verifyPassword(
  storedHash: unknown,
  password: unknown,
): PasswordCheck {
  const input = readPasswordInputs(storedHash, password);
  if (!input) return invalidPasswordCheck();

  if (isScryptHash(input.storedHash)) {
    return {
      valid: verifySecretHash(input.storedHash, input.password),
      needsRehash: !isCurrentScryptParams(input.storedHash),
    };
  }

  // Legacy sha256 — известный формат; всё остальное fail-closed.
  return (
    verifyLegacySha256(input.storedHash, input.password) ??
    invalidPasswordCheck()
  );
}

/** Асинхронный хэш для запросного пути (не блокирует event loop). */
export function hashPasswordAsync(password: string): Promise<string> {
  return hashSecretAsync(password);
}

/**
 * Асинхронная проверка для запросного пути. Логика и ответы совпадают с
 * `verifyPassword`; старый sha256 проверяется тем же синхронным кодом.
 */
export async function verifyPasswordAsync(
  storedHash: unknown,
  password: unknown,
): Promise<PasswordCheck> {
  const input = readPasswordInputs(storedHash, password);
  if (!input) return invalidPasswordCheck();

  if (isScryptHash(input.storedHash)) {
    return {
      valid: await verifySecretHashAsync(input.storedHash, input.password),
      needsRehash: !isCurrentScryptParams(input.storedHash),
    };
  }

  return (
    verifyLegacySha256(input.storedHash, input.password) ??
    invalidPasswordCheck()
  );
}
