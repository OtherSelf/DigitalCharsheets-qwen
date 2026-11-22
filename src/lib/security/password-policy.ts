/**
 * Политика длины пароля. Отдельный модуль без Node-криптографии: константы
 * нужны клиентским формам (login/settings/admin), а `password.ts` тянет
 * scrypt и не должен попадать в браузерный бандл.
 */

export const MIN_PASSWORD_LENGTH = 12;
export const MAX_PASSWORD_LENGTH = 128;

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
