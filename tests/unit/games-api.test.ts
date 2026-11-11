import fs from 'node:fs';

import { afterEach, beforeEach, describe, expect, it } from 'vitest';

import {
  GET as adminGamesGet,
  PUT as adminGamesPut,
} from '@/app/api/admin/games/route';
import {
  GET as charactersGet,
  POST as charactersPost,
} from '@/app/api/characters/route';
import { GET as gamesGet } from '@/app/api/games/route';
import { setModuleStatus, setSiteTitle } from '@/lib/game-catalog';
import { authenticateUser } from '@/lib/server-auth';
import type { UserRole } from '@/lib/user-role';
import { readStoredUser, writeStoredUser } from '@/lib/user-schema';

import {
  makeDhCharacter,
  makeDndCharacter,
  readJson,
  removeDir,
  sessionHeaders,
  useTempDataDir,
} from './helpers';

/**
 * ─── LANDMARK: GAMES API TESTS ─────────────────────────────────────────────
 * Серверная сторона видимости: /api/games фильтрует по роли, POST
 * /api/characters отвергает недоступную редакцию (403), админский API
 * управляет статусами и заголовком. Скрытие не прячет существующие листы.
 */
let dataDir: string;

beforeEach(() => {
  dataDir = useTempDataDir();
});

afterEach(() => {
  delete process.env.DCS_DATA_DIR;
  removeDir(dataDir);
});

function createUser(username: string, role: UserRole = 'user'): string {
  const result = authenticateUser(username, 'pass1');
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

async function listGames(uid?: string) {
  const res = await gamesGet(
    request('/api/games', { headers: uid ? sessionHeaders(uid) : {} }),
  );
  expect(res.status).toBe(200);
  return (await res.json()) as {
    games: { id: string; editions: { id: string; status: string }[] }[];
    siteTitle: string | null;
  };
}

describe('/api/games: видимость по ролям', () => {
  it('гость и user видят только published', async () => {
    setModuleStatus('dh2', 'test');
    setModuleStatus('dh1', 'hidden');

    const guest = await listGames();
    expect(guest.games.map((game) => game.id)).toEqual(['dnd']);

    const user = await listGames(createUser('plain-user'));
    expect(user.games.map((game) => game.id)).toEqual(['dnd']);
  });

  it('tester и admin видят test, admin — hidden', async () => {
    setModuleStatus('dh2', 'test');
    setModuleStatus('dh1', 'hidden');

    const tester = await listGames(createUser('tester-one', 'tester'));
    expect(tester.games.map((game) => game.id)).toEqual(['dnd', 'darkHeresy']);
    expect(
      tester.games
        .find((game) => game.id === 'darkHeresy')!
        .editions.map((edition) => edition.id),
    ).toEqual(['dh2']);

    const admin = await listGames(createUser('admin-one', 'admin'));
    expect(
      admin.games
        .find((game) => game.id === 'darkHeresy')!
        .editions.map((edition) => edition.id),
    ).toEqual(['dh1', 'dh2']);
  });

  it('отдаёт переопределённый заголовок сайта', async () => {
    setSiteTitle('Наш стол');
    expect((await listGames()).siteTitle).toBe('Наш стол');
  });
});

describe('POST /api/characters: проверка доступа к редакции', () => {
  it('user не может создать test-редакцию (403), tester может', async () => {
    setModuleStatus('dh2', 'test');
    const user = createUser('blocked-user');
    const tester = createUser('allowed-tester', 'tester');
    const payload = makeDhCharacter({ edition: '2nd' });

    const denied = await charactersPost(
      jsonRequest('/api/characters', 'POST', payload, user),
    );
    expect(denied.status).toBe(403);
    expect((await denied.json()).reason).toBe('module_forbidden');

    const allowed = await charactersPost(
      jsonRequest('/api/characters', 'POST', payload, tester),
    );
    expect(allowed.status).toBe(201);
    expect((await allowed.json()).systemId).toBe('dh2');
  });

  it('published-редакцию user создаёт нормально', async () => {
    const user = createUser('normal-user');
    const res = await charactersPost(
      jsonRequest('/api/characters', 'POST', makeDndCharacter(), user),
    );
    expect(res.status).toBe(201);
    expect((await res.json()).systemId).toBe('dnd5e');
  });

  it('без сессии — 401, без системы — 400', async () => {
    const noSession = await charactersPost(
      jsonRequest('/api/characters', 'POST', makeDndCharacter()),
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
      jsonRequest('/api/characters', 'POST', makeDndCharacter(), user),
    );
    expect(created.status).toBe(201);

    setModuleStatus('dnd5e', 'hidden');
    const list = await charactersGet(
      request('/api/characters', { headers: sessionHeaders(user) }),
    );
    expect(list.status).toBe(200);
    expect((await list.json()).map((c: { id: string }) => c.id)).toContain(
      (await created.json()).id,
    );
  });
});

describe('/api/admin/games', () => {
  it('доступен только admin', async () => {
    for (const role of ['user', 'tester'] as const) {
      const uid = createUser(`not-admin-${role}`, role);
      const res = await adminGamesGet(
        request('/api/admin/games', { headers: sessionHeaders(uid) }),
      );
      expect(res.status).toBe(403);
    }
    const guest = await adminGamesGet(request('/api/admin/games'));
    expect(guest.status).toBe(401);

    const admin = createUser('real-admin', 'admin');
    const ok = await adminGamesGet(
      request('/api/admin/games', { headers: sessionHeaders(admin) }),
    );
    expect(ok.status).toBe(200);
    const body = await ok.json();
    expect(body.games.map((game: { id: string }) => game.id).sort()).toEqual([
      'dh1',
      'dh2',
      'dnd5e',
    ]);
  });

  it('admin меняет статус и заголовок; сохраняется на диск', async () => {
    const admin = createUser('games-admin', 'admin');

    const putStatus = await adminGamesPut(
      jsonRequest(
        '/api/admin/games',
        'PUT',
        { systemId: 'dh2', status: 'test' },
        admin,
      ),
    );
    expect(putStatus.status).toBe(200);
    expect(
      (await putStatus.json()).games.find(
        (game: { id: string }) => game.id === 'dh2',
      ).status,
    ).toBe('test');

    const putTitle = await adminGamesPut(
      jsonRequest(
        '/api/admin/games',
        'PUT',
        { siteTitle: 'Новый стол' },
        admin,
      ),
    );
    expect(putTitle.status).toBe(200);
    expect((await putTitle.json()).siteTitle).toBe('Новый стол');

    const stored = readJson(`${dataDir}/settings/game-catalog.json`);
    expect(stored.statuses.dh2).toBe('test');
    expect(stored.siteTitle).toBe('Новый стол');
    expect(fs.existsSync(`${dataDir}/settings/game-catalog.json`)).toBe(true);
  });

  it('валидирует статус и систему', async () => {
    const admin = createUser('validate-admin', 'admin');

    const badStatus = await adminGamesPut(
      jsonRequest(
        '/api/admin/games',
        'PUT',
        { systemId: 'dh1', status: 'nonsense' },
        admin,
      ),
    );
    expect(badStatus.status).toBe(400);

    const badSystem = await adminGamesPut(
      jsonRequest(
        '/api/admin/games',
        'PUT',
        { systemId: 'dh9', status: 'test' },
        admin,
      ),
    );
    expect(badSystem.status).toBe(400);
  });
});
