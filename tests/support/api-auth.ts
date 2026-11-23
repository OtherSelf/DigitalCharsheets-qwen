/**
 * Сквозные auth-потоки через настоящие route handler'ы: регистрация и вход.
 *
 * Пароль по умолчанию проходит политику (минимум 12 символов); короткие
 * значения в тестах используются только как заведомо невалидные.
 */

import { expect } from 'vitest';

import { POST as registerRoute } from '@/app/api/auth/register/route';
import { POST as loginRoute } from '@/app/api/auth/route';

import { json } from './http';

export const TEST_PASSWORD = 'test-pass-1234';

/** Зарегистрировать аккаунт через /api/auth/register. */
export async function registerAs(
  username: string,
  password = TEST_PASSWORD,
  displayName?: string,
  recoveryPhrase = 'amber cobalt lantern silver ember frost',
) {
  const res = await registerRoute(
    json({ username, password, displayName, recoveryPhrase }),
  );
  const body = await res.json();
  const setCookie = res.headers.get('set-cookie') || '';
  const cookie = setCookie.split(';')[0];
  return { res, body, uid: body?.user?.uid as string, cookie };
}

/** Войти через /api/auth и вернуть uid, cookie и тело ответа. */
export async function loginAs(
  username: string,
  password = TEST_PASSWORD,
  displayName?: string,
) {
  // Большинству тестов нужен существующий аккаунт: регистрация теперь
  // отдельным роутом, а /api/auth — только вход.
  const registered = await registerAs(username, password, displayName);
  expect([200, 409]).toContain(registered.res.status);

  const res = await loginRoute(json({ username, password }));
  const body = await res.json();
  const setCookie = res.headers.get('set-cookie') || '';
  const cookie = setCookie.split(';')[0];
  return { res, body, uid: body?.user?.uid as string, cookie };
}
