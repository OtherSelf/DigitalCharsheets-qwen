/**
 * Сквозной поток «регистрация → вход → создание персонажа» для тестов,
 * которые проверяют формы создания каждой игровой системы.
 *
 * Cookie хранится по uid: запросы к API авторизуются только сессионной
 * cookie, uid из query/body не принимается.
 */

import { expect } from 'vitest';

import { POST as registerRoute } from '@/app/api/auth/register/route';
import { POST as loginRoute } from '@/app/api/auth/route';
import {
  GET as charactersGet,
  POST as charactersPost,
} from '@/app/api/characters/route';

import type { AnyCharacter } from './character-payloads';

export const AUTH_URL = 'http://localhost/api/auth';
export const REGISTER_URL = 'http://localhost/api/auth/register';
export const PHRASE_URL = 'http://localhost/api/auth/phrase';
export const CHARACTERS_URL = 'http://localhost/api/characters';
export const EXPORT_URL = 'http://localhost/api/export';

export const PASSWORD = 'secret-pass-1234';
export const RECOVERY_PHRASE = 'amber cobalt lantern';

export const jsonRequest = (
  url: string,
  body: unknown,
  headers: Record<string, string> = {},
) =>
  new Request(url, {
    method: 'POST',
    headers: { 'content-type': 'application/json', ...headers },
    body: JSON.stringify(body),
  });

export const getRequest = (url: string, headers: Record<string, string> = {}) =>
  new Request(url, { method: 'GET', headers });

/** Сессионные cookie по uid: запросы к API авторизуются только ими. */
const cookiesByUid = new Map<string, string>();

export function cookieFor(uid: string): Record<string, string> {
  const cookie = cookiesByUid.get(uid);
  expect(
    cookie,
    `нет сессии для uid ${uid} — сначала register/login`,
  ).toBeTruthy();
  return { cookie: cookie! };
}

export async function login(
  username: string,
  password: string,
  displayName?: string,
) {
  const res = await loginRoute(
    jsonRequest(AUTH_URL, { username, password, displayName }),
  );
  const body = await res.json();
  const cookie = (res.headers.get('set-cookie') || '').split(';')[0];
  if (body?.user?.uid && cookie) cookiesByUid.set(body.user.uid, cookie);
  return { status: res.status, body };
}

/** Регистрирует аккаунт через отдельный роут (вход больше не создаёт его). */
export async function register(username: string, displayName?: string) {
  const res = await registerRoute(
    jsonRequest(REGISTER_URL, {
      username,
      password: PASSWORD,
      displayName,
      recoveryPhrase: RECOVERY_PHRASE,
    }),
  );
  const body = await res.json();
  const cookie = (res.headers.get('set-cookie') || '').split(';')[0];
  if (body?.user?.uid && cookie) cookiesByUid.set(body.user.uid, cookie);
  expect(res.status, `регистрация ${username}: ${JSON.stringify(body)}`).toBe(
    200,
  );
  expect(body.success).toBe(true);
  return body.user as {
    uid: string;
    username: string;
    displayName: string;
    hasRecoveryPhrase: boolean;
  };
}

export async function createCharacter(userId: string, payload: AnyCharacter) {
  const res = await charactersPost(
    jsonRequest(CHARACTERS_URL, payload, cookieFor(userId)),
  );
  const body = await res.json();
  return { status: res.status, body };
}

export async function listCharacters(userId: string) {
  const res = await charactersGet(
    getRequest(CHARACTERS_URL, cookieFor(userId)),
  );
  expect(res.status).toBe(200);
  return (await res.json()) as AnyCharacter[];
}
