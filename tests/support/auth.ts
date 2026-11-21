/**
 * Подписанная сессия для тестовых запросов к route handler'ам.
 *
 * uid берётся из сессии (как в приложении), а не из query/body: тест не должен
 * иметь возможности «представиться» чужим uid.
 */

import { createSession } from '@/lib/session';

/** Значение cookie-сессии для uid — то, что поставил бы `/api/auth`. */
export async function sessionCookie(uid: string): Promise<string> {
  return `dcs_session=${(await createSession(uid)).value}`;
}

/** Заголовки запроса с сессией: `headers: await sessionHeaders(uid)`. */
export async function sessionHeaders(
  uid: string,
): Promise<Record<string, string>> {
  return { cookie: await sessionCookie(uid) };
}
