/**
 * Общие хелперы API игр: реестр, роли, запросы и ответ `/api/games`.
 * Держим их здесь, чтобы `games-catalog.test.ts` и `admin/games.test.ts`
 * не расходились в подготовке данных.
 */

import { expect } from 'vitest';

import { GET as gamesGet } from '@/app/api/games/route';
import { listGameModules, type AnyGameModule } from '@/games/registry';
import { setModuleStatus } from '@/lib/game-catalog';
import { authenticateUser } from '@/lib/server-auth';
import type { UserRole } from '@/lib/user-role';
import { readStoredUser, writeStoredUser } from '@/lib/user-schema';

import { sessionHeaders } from './auth';

export const MODULES = listGameModules();
export const [FIRST_MODULE, SECOND_MODULE] = MODULES;
/** id, которого заведомо нет в реестре: «плагин не установлен». */
export const MISSING_SYSTEM = 'missing-plugin';

export async function createUser(
  username: string,
  role: UserRole = 'user',
): Promise<string> {
  const result = await authenticateUser(username, 'pass-one-1234');
  const uid = result.user!.uid;
  const stored = (await readStoredUser(uid))!;
  await writeStoredUser(uid, { ...stored, role });
  return uid;
}

export function request(url: string, options: RequestInit = {}) {
  return new Request(`http://localhost${url}`, options);
}

export async function jsonRequest(
  url: string,
  method: string,
  body: unknown,
  uid?: string,
) {
  return request(url, {
    method,
    headers: {
      'content-type': 'application/json',
      ...(uid ? await sessionHeaders(uid) : {}),
    },
    body: JSON.stringify(body),
  });
}

export function defaultsFor(gameModule: AnyGameModule) {
  return gameModule.createDefaults({ name: `Герой ${gameModule.id}` });
}

/** Вернуть все редакции в published: матрица ролей не зависит от манифестов. */
export async function publishAllModules() {
  for (const gameModule of MODULES) {
    await setModuleStatus(gameModule.id, 'published');
  }
}

export type GamesBody = {
  games: { id: string; editions: { id: string; status: string }[] }[];
  siteTitle: string | null;
  disabled?: string[];
};

export function editionIds(body: GamesBody): string[] {
  return body.games.flatMap((game) =>
    game.editions.map((edition) => edition.id),
  );
}

export async function listGames(uid?: string): Promise<GamesBody> {
  const res = await gamesGet(
    request('/api/games', { headers: uid ? await sessionHeaders(uid) : {} }),
  );
  expect(res.status).toBe(200);
  return (await res.json()) as GamesBody;
}
