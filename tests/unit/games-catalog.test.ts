/**
 * /api/games и POST /api/characters: видимость редакций по ролям,
 * 403 на недоступную редакцию; id берутся из реестра.
 */

import { afterEach, beforeEach, describe, expect, it } from 'vitest';

import {
  GET as charactersGet,
  POST as charactersPost,
} from '@/app/api/characters/route';
import { GET as gamesGet } from '@/app/api/games/route';
import {
  gamePlugins,
  listGameModules,
  type AnyGameModule,
} from '@/games/registry';
import { setModuleStatus, setSiteTitle } from '@/lib/game-catalog';
import { authenticateUser } from '@/lib/server-auth';
import type { UserRole } from '@/lib/user-role';
import { readStoredUser, writeStoredUser } from '@/lib/user-schema';

import { removeDir, sessionHeaders, useTempDataDir } from '@tests/support';

let dataDir: string;

const MODULES = listGameModules();
const [FIRST_MODULE, SECOND_MODULE] = MODULES;
/** id, которого заведомо нет в реестре: «плагин не установлен». */
const MISSING_SYSTEM = 'missing-plugin';

beforeEach(() => {
  dataDir = useTempDataDir();
});

afterEach(() => {
  delete process.env.DCS_DATA_DIR;
  removeDir(dataDir);
});

async function createUser(
  username: string,
  role: UserRole = 'user',
): Promise<string> {
  const result = await authenticateUser(username, 'pass-one-1234');
  const uid = result.user!.uid;
  const stored = (await readStoredUser(uid))!;
  await writeStoredUser(uid, { ...stored, role });
  return uid;
}

function request(url: string, options: RequestInit = {}) {
  return new Request(`http://localhost${url}`, options);
}

async function jsonRequest(
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

function defaultsFor(gameModule: AnyGameModule) {
  return gameModule.createDefaults({ name: `Герой ${gameModule.id}` });
}

/** Вернуть все редакции в published: матрица ролей не зависит от манифестов. */
async function publishAllModules() {
  for (const gameModule of MODULES) {
    await setModuleStatus(gameModule.id, 'published');
  }
}

type GamesBody = {
  games: { id: string; editions: { id: string; status: string }[] }[];
  siteTitle: string | null;
  disabled?: string[];
};

function editionIds(body: GamesBody): string[] {
  return body.games.flatMap((game) =>
    game.editions.map((edition) => edition.id),
  );
}

async function listGames(uid?: string): Promise<GamesBody> {
  const res = await gamesGet(
    request('/api/games', { headers: uid ? await sessionHeaders(uid) : {} }),
  );
  expect(res.status).toBe(200);
  return (await res.json()) as GamesBody;
}

describe('/api/games: видимость по ролям', () => {
  it('гость и user видят только published', async () => {
    await publishAllModules();
    await setModuleStatus(FIRST_MODULE.id, 'test');
    await setModuleStatus(SECOND_MODULE.id, 'hidden');

    const hiddenForGuest = new Set([FIRST_MODULE.id, SECOND_MODULE.id]);
    const visibleForGuest = MODULES.map((gameModule) => gameModule.id).filter(
      (id) => !hiddenForGuest.has(id),
    );

    const guest = await listGames();
    const guestIds = editionIds(guest);
    for (const id of visibleForGuest) expect(guestIds).toContain(id);
    for (const id of hiddenForGuest) expect(guestIds).not.toContain(id);

    const user = await listGames(await createUser('plain-user'));
    const userIds = editionIds(user);
    for (const id of visibleForGuest) expect(userIds).toContain(id);
    for (const id of hiddenForGuest) expect(userIds).not.toContain(id);
  });

  it('tester и admin видят test, admin — hidden', async () => {
    await publishAllModules();
    await setModuleStatus(FIRST_MODULE.id, 'test');
    await setModuleStatus(SECOND_MODULE.id, 'hidden');

    const tester = await listGames(await createUser('tester-one', 'tester'));
    const testerIds = editionIds(tester);
    expect(testerIds).toContain(FIRST_MODULE.id);
    expect(testerIds).not.toContain(SECOND_MODULE.id);
    for (const gameModule of MODULES) {
      if (gameModule.id === SECOND_MODULE.id) continue;
      expect(testerIds).toContain(gameModule.id);
    }
    expect(testerIds).toHaveLength(MODULES.length - 1);

    const admin = await listGames(await createUser('admin-one', 'admin'));
    const adminIds = editionIds(admin);
    for (const gameModule of MODULES) {
      expect(adminIds).toContain(gameModule.id);
    }
    expect(adminIds).toHaveLength(MODULES.length);
  });

  it('отдаёт переопределённый заголовок сайта', async () => {
    await setSiteTitle('Наш стол');
    expect((await listGames()).siteTitle).toBe('Наш стол');
  });
});

describe('POST /api/characters: проверка доступа к редакции', () => {
  it('user не может создать test-редакцию (403), tester может', async () => {
    await setModuleStatus(FIRST_MODULE.id, 'test');
    const user = await createUser('blocked-user');
    const tester = await createUser('allowed-tester', 'tester');
    const payload = defaultsFor(FIRST_MODULE);

    const denied = await charactersPost(
      await jsonRequest('/api/characters', 'POST', payload, user),
    );
    expect(denied.status).toBe(403);
    expect((await denied.json()).reason).toBe('module_forbidden');

    const allowed = await charactersPost(
      await jsonRequest('/api/characters', 'POST', payload, tester),
    );
    expect(allowed.status).toBe(201);
    expect((await allowed.json()).systemId).toBe(FIRST_MODULE.id);
  });

  it('user не может создать скрытую редакцию (403), admin может', async () => {
    await setModuleStatus(FIRST_MODULE.id, 'hidden');
    const user = await createUser('hidden-user');
    const admin = await createUser('hidden-admin', 'admin');
    const payload = defaultsFor(FIRST_MODULE);

    const denied = await charactersPost(
      await jsonRequest('/api/characters', 'POST', payload, user),
    );
    expect(denied.status).toBe(403);
    expect((await denied.json()).reason).toBe('module_forbidden');

    const allowed = await charactersPost(
      await jsonRequest('/api/characters', 'POST', payload, admin),
    );
    expect(allowed.status).toBe(201);
    expect((await allowed.json()).systemId).toBe(FIRST_MODULE.id);
  });

  it('published-редакцию user создаёт нормально', async () => {
    await setModuleStatus(SECOND_MODULE.id, 'published');
    const user = await createUser('normal-user');
    const res = await charactersPost(
      await jsonRequest(
        '/api/characters',
        'POST',
        defaultsFor(SECOND_MODULE),
        user,
      ),
    );
    expect(res.status).toBe(201);
    expect((await res.json()).systemId).toBe(SECOND_MODULE.id);
  });

  it('без сессии — 401, без системы — 400', async () => {
    const noSession = await charactersPost(
      await jsonRequest('/api/characters', 'POST', defaultsFor(FIRST_MODULE)),
    );
    expect(noSession.status).toBe(401);

    const user = await createUser('unknown-sys');
    const unknown = await charactersPost(
      await jsonRequest(
        '/api/characters',
        'POST',
        { name: 'X', gameSystem: 'Unknown' },
        user,
      ),
    );
    expect(unknown.status).toBe(400);
    expect((await unknown.json()).reason).toBe('unknown_system');
  });

  it('скрытие редакции не прячет уже созданный лист', async () => {
    const user = await createUser('owner-user');
    const created = await charactersPost(
      await jsonRequest(
        '/api/characters',
        'POST',
        defaultsFor(FIRST_MODULE),
        user,
      ),
    );
    expect(created.status).toBe(201);

    await setModuleStatus(FIRST_MODULE.id, 'hidden');
    const list = await charactersGet(
      request('/api/characters', { headers: await sessionHeaders(user) }),
    );
    expect(list.status).toBe(200);
    expect((await list.json()).map((c: { id: string }) => c.id)).toContain(
      (await created.json()).id,
    );
  });
});
