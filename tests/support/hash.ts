/**
 * sha256-хэш для legacy-аккаунтов: до перехода на scrypt пароль хранился так,
 * и тесты проверяют, что такой аккаунт входит и получает scrypt-хэш.
 */

import crypto from 'node:crypto';

export const sha256 = (value: string) =>
  crypto.createHash('sha256').update(value).digest('hex');
