/**
 * Подписанная сессия для тестовых запросов к route handler'ам.
 *
 * uid берётся из сессии (как в приложении), а не из query/body: тест не должен
 * иметь возможности «представиться» чужим uid.
 */

import { createSession } from '@/lib/session';

/** Значение cookie-сессии для uid — то, что поставил бы `/api/auth`. */
export function sessionCookie(uid: string): string {
  return `dcs_session=${createSession(uid).value}`;
}

/** Заголовки запроса с сессией: `headers: sessionHeaders(uid)`. */
export function sessionHeaders(uid: string): Record<string, string> {
  return { cookie: sessionCookie(uid) };
}
