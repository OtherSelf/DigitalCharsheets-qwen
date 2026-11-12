import crypto from 'crypto';

import { hashSecret, isScryptHash, verifySecretHash } from './scrypt';
import { safeStringEqual } from './timing';

/**
 * ─── LANDMARK: PASSWORD STORAGE ─────────────────────────────────────────────
 * Пароль на диске — соль + scrypt-хэш (формат и параметры в `scrypt.ts`),
 * сравнение — за постоянное время. Старые значения (несолёный sha256, без
 * префикса формата) читаются один раз: успешный вход возвращает
 * `needsRehash`, и вызывающий перезаписывает хэш.
 *
 * Политика длины — здесь же, чтобы все точки установки пароля (регистрация,
 * восстановление, профиль, админка, служебный админ) не расходились. Вход
 * длину не проверяет: иначе аккаунты, созданные до политики, потеряли бы
 * доступ, ничего не нарушив.
 */

export const MIN_PASSWORD_LENGTH = 12;
export const MAX_PASSWORD_LENGTH = 128;

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

/** Проверить пароль по сохранённому значению. */
export function verifyPassword(
  storedHash: unknown,
  password: unknown,
): PasswordCheck {
  if (typeof storedHash !== 'string' || storedHash === '') {
    return { valid: false, needsRehash: false };
  }
  if (typeof password !== 'string' || password === '') {
    return { valid: false, needsRehash: false };
  }

  if (isScryptHash(storedHash)) {
    return {
      valid: verifySecretHash(storedHash, password),
      needsRehash: false,
    };
  }

  if (LEGACY_SHA256_RE.test(storedHash)) {
    const legacy = crypto.createHash('sha256').update(password).digest('hex');
    const valid = safeStringEqual(storedHash, legacy);
    return { valid, needsRehash: valid };
  }

  // Неизвестный формат: fail-closed, без исключений на битом файле.
  return { valid: false, needsRehash: false };
}

/**
 * Сообщение об ошибке политики пароля или `null`, если пароль допустим.
 * Один текст на все точки установки — клиент показывает его как есть.
 */
export function passwordPolicyError(password: unknown): string | null {
  if (typeof password !== 'string' || password === '') {
    return 'Password is required.';
  }
  if (password.length < MIN_PASSWORD_LENGTH) {
    return `Password must be at least ${MIN_PASSWORD_LENGTH} characters.`;
  }
  if (password.length > MAX_PASSWORD_LENGTH) {
    return `Password must be at most ${MAX_PASSWORD_LENGTH} characters.`;
  }
  return null;
}
