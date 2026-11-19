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

function createUser(username: string, role: UserRole = 'user'): string {
  const result = authenticateUser(username, 'pass-one-1234');
  const uid = result.user!.uid;
  const stored = readStoredUser(uid)!;
  writeStoredUser(uid, { ...stored, role });
  return uid;
}

function request(url: string, options: RequestInit = {}) {
  return new Request(`http://localhost${url}`, options);
}

function jsonRequest(url: string, method: string, body: unknown, uid?: string) {
  return request(url, {
    method,
    headers: {
      'content-type': 'application/json',
      ...(uid ? sessionHeaders(uid) : {}),
    },
    body: JSON.stringify(body),
  });
}

function defaultsFor(gameModule: AnyGameModule) {
  return gameModule.createDefaults({ name: `Герой ${gameModule.id}` });
}

/** Вернуть все редакции в published: матрица ролей не зависит от манифестов. */
function publishAllModules() {
  for (const gameModule of MODULES) {
    setModuleStatus(gameModule.id, 'published');
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
    request('/api/games', { headers: uid ? sessionHeaders(uid) : {} }),
  );
  expect(res.status).toBe(200);
  return (await res.json()) as GamesBody;
}

describe('/api/games: видимость по ролям', () => {
  it('гость и user видят только published', async () => {
    publishAllModules();
    setModuleStatus(FIRST_MODULE.id, 'test');
    setModuleStatus(SECOND_MODULE.id, 'hidden');

    const hiddenForGuest = new Set([FIRST_MODULE.id, SECOND_MODULE.id]);
    const visibleForGuest = MODULES.map((gameModule) => gameModule.id).filter(
      (id) => !hiddenForGuest.has(id),
    );

    const guest = await listGames();
    const guestIds = editionIds(guest);
    for (const id of visibleForGuest) expect(guestIds).toContain(id);
    for (const id of hiddenForGuest) expect(guestIds).not.toContain(id);

    const user = await listGames(createUser('plain-user'));
    const userIds = editionIds(user);
    for (const id of visibleForGuest) expect(userIds).toContain(id);
    for (const id of hiddenForGuest) expect(userIds).not.toContain(id);
  });

  it('tester и admin видят test, admin — hidden', async () => {
    publishAllModules();
    setModuleStatus(FIRST_MODULE.id, 'test');
    setModuleStatus(SECOND_MODULE.id, 'hidden');

    const tester = await listGames(createUser('tester-one', 'tester'));
    const testerIds = editionIds(tester);
    expect(testerIds).toContain(FIRST_MODULE.id);
    expect(testerIds).not.toContain(SECOND_MODULE.id);
    for (const gameModule of MODULES) {
      if (gameModule.id === SECOND_MODULE.id) continue;
      expect(testerIds).toContain(gameModule.id);
    }
    expect(testerIds).toHaveLength(MODULES.length - 1);

    const admin = await listGames(createUser('admin-one', 'admin'));
    const adminIds = editionIds(admin);
    for (const gameModule of MODULES) {
      expect(adminIds).toContain(gameModule.id);
    }
    expect(adminIds).toHaveLength(MODULES.length);
  });

  it('отдаёт переопределённый заголовок сайта', async () => {
    setSiteTitle('Наш стол');
    expect((await listGames()).siteTitle).toBe('Наш стол');
  });
});

describe('POST /api/characters: проверка доступа к редакции', () => {
  it('user не может создать test-редакцию (403), tester может', async () => {
    setModuleStatus(FIRST_MODULE.id, 'test');
    const user = createUser('blocked-user');
    const tester = createUser('allowed-tester', 'tester');
    const payload = defaultsFor(FIRST_MODULE);

    const denied = await charactersPost(
      jsonRequest('/api/characters', 'POST', payload, user),
    );
    expect(denied.status).toBe(403);
    expect((await denied.json()).reason).toBe('module_forbidden');

    const allowed = await charactersPost(
      jsonRequest('/api/characters', 'POST', payload, tester),
    );
    expect(allowed.status).toBe(201);
    expect((await allowed.json()).systemId).toBe(FIRST_MODULE.id);
  });

  it('user не может создать скрытую редакцию (403), admin может', async () => {
    setModuleStatus(FIRST_MODULE.id, 'hidden');
    const user = createUser('hidden-user');
    const admin = createUser('hidden-admin', 'admin');
    const payload = defaultsFor(FIRST_MODULE);

    const denied = await charactersPost(
      jsonRequest('/api/characters', 'POST', payload, user),
    );
    expect(denied.status).toBe(403);
    expect((await denied.json()).reason).toBe('module_forbidden');

    const allowed = await charactersPost(
      jsonRequest('/api/characters', 'POST', payload, admin),
    );
    expect(allowed.status).toBe(201);
    expect((await allowed.json()).systemId).toBe(FIRST_MODULE.id);
  });

  it('published-редакцию user создаёт нормально', async () => {
    setModuleStatus(SECOND_MODULE.id, 'published');
    const user = createUser('normal-user');
    const res = await charactersPost(
      jsonRequest('/api/characters', 'POST', defaultsFor(SECOND_MODULE), user),
    );
    expect(res.status).toBe(201);
    expect((await res.json()).systemId).toBe(SECOND_MODULE.id);
  });

  it('без сессии — 401, без системы — 400', async () => {
    const noSession = await charactersPost(
      jsonRequest('/api/characters', 'POST', defaultsFor(FIRST_MODULE)),
    );
    expect(noSession.status).toBe(401);

    const user = createUser('unknown-sys');
    const unknown = await charactersPost(
      jsonRequest(
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
    const user = createUser('owner-user');
    const created = await charactersPost(
      jsonRequest('/api/characters', 'POST', defaultsFor(FIRST_MODULE), user),
    );
    expect(created.status).toBe(201);

    setModuleStatus(FIRST_MODULE.id, 'hidden');
    const list = await charactersGet(
      request('/api/characters', { headers: sessionHeaders(user) }),
    );
    expect(list.status).toBe(200);
    expect((await list.json()).map((c: { id: string }) => c.id)).toContain(
      (await created.json()).id,
    );
  });
});
