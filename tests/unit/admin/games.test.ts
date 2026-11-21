/**
 * /api/admin/games: статусы, заголовок сайта, enabled=false, метаданные
 * из манифестов; id берутся из реестра.
 */

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
import {
  gamePlugins,
  listGameModules,
  type AnyGameModule,
} from '@/games/registry';
import {
  isModuleHostTheme,
  setModuleEnabled,
  setModuleStatus,
} from '@/lib/game-catalog';
import { authenticateUser } from '@/lib/server-auth';
import type { UserRole } from '@/lib/user-role';
import { readStoredUser, writeStoredUser } from '@/lib/user-schema';

import {
  readJson,
  removeDir,
  sessionHeaders,
  useTempDataDir,
} from '@tests/support';

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

describe('/api/admin/games', () => {
  it('доступен только admin', async () => {
    for (const role of ['user', 'tester'] as const) {
      const uid = await createUser(`not-admin-${role}`, role);
      const res = await adminGamesGet(
        request('/api/admin/games', { headers: await sessionHeaders(uid) }),
      );
      expect(res.status).toBe(403);
    }
    const guest = await adminGamesGet(request('/api/admin/games'));
    expect(guest.status).toBe(401);

    const admin = await createUser('real-admin', 'admin');
    const ok = await adminGamesGet(
      request('/api/admin/games', { headers: await sessionHeaders(admin) }),
    );
    expect(ok.status).toBe(200);
    const body = await ok.json();
    const ids = body.games.map((game: { id: string }) => game.id);
    expect(ids).toHaveLength(MODULES.length);
    for (const gameModule of MODULES) expect(ids).toContain(gameModule.id);
  });

  it('admin меняет статус и заголовок; сохраняется на диск', async () => {
    const admin = await createUser('games-admin', 'admin');

    const putStatus = await adminGamesPut(
      await jsonRequest(
        '/api/admin/games',
        'PUT',
        { systemId: FIRST_MODULE.id, status: 'test' },
        admin,
      ),
    );
    expect(putStatus.status).toBe(200);
    expect(
      (await putStatus.json()).games.find(
        (game: { id: string }) => game.id === FIRST_MODULE.id,
      ).status,
    ).toBe('test');

    const putTitle = await adminGamesPut(
      await jsonRequest(
        '/api/admin/games',
        'PUT',
        { siteTitle: 'Новый стол' },
        admin,
      ),
    );
    expect(putTitle.status).toBe(200);
    expect((await putTitle.json()).siteTitle).toBe('Новый стол');

    const stored = readJson(`${dataDir}/settings/game-catalog.json`);
    expect(stored.version).toBe(2);
    expect(stored.plugins[FIRST_MODULE.id]).toEqual({
      enabled: true,
      visibility: 'test',
      useHostTheme: false,
    });
    expect(stored.siteTitle).toBe('Новый стол');
    expect(fs.existsSync(`${dataDir}/settings/game-catalog.json`)).toBe(true);
  });

  it('валидирует статус и систему', async () => {
    const admin = await createUser('validate-admin', 'admin');

    const badStatus = await adminGamesPut(
      await jsonRequest(
        '/api/admin/games',
        'PUT',
        { systemId: FIRST_MODULE.id, status: 'nonsense' },
        admin,
      ),
    );
    expect(badStatus.status).toBe(400);

    const badSystem = await adminGamesPut(
      await jsonRequest(
        '/api/admin/games',
        'PUT',
        { systemId: MISSING_SYSTEM, status: 'test' },
        admin,
      ),
    );
    expect(badSystem.status).toBe(400);
  });
});

describe('отключённый плагин (enabled=false)', () => {
  it('/api/games скрывает его из создания и отдаёт список disabled', async () => {
    await publishAllModules();
    await setModuleEnabled(FIRST_MODULE.id, false);
    const guest = await listGames();
    const guestIds = editionIds(guest);
    expect(guestIds).not.toContain(FIRST_MODULE.id);
    for (const gameModule of MODULES) {
      if (gameModule.id === FIRST_MODULE.id) continue;
      expect(guestIds).toContain(gameModule.id);
    }
    expect(guest.disabled).toContain(FIRST_MODULE.id);
  });

  it('создание листа отключённой игры запрещено даже админу', async () => {
    await publishAllModules();
    await setModuleEnabled(SECOND_MODULE.id, false);
    const admin = await createUser('disabled-admin', 'admin');
    const payload = defaultsFor(SECOND_MODULE);

    const denied = await charactersPost(
      await jsonRequest('/api/characters', 'POST', payload, admin),
    );
    expect(denied.status).toBe(403);
    expect((await denied.json()).reason).toBe('module_disabled');
  });

  it('существующие листы не пропадают из списка', async () => {
    await publishAllModules();
    const uid = await createUser('owner-user');
    const created = await charactersPost(
      await jsonRequest(
        '/api/characters',
        'POST',
        defaultsFor(FIRST_MODULE),
        uid,
      ),
    );
    expect(created.status).toBe(201);

    await setModuleEnabled(FIRST_MODULE.id, false);
    const list = await charactersGet(
      request('/api/characters', { headers: await sessionHeaders(uid) }),
    );
    expect(list.status).toBe(200);
    const body = await list.json();
    expect(body.characters ?? body).toHaveLength(1);
  });
});

describe('админский API: метаданные плагинов и enabled', () => {
  it('GET отдаёт версию, схему, conformance и зависимости из манифеста', async () => {
    const admin = await createUser('meta-admin', 'admin');
    const res = await adminGamesGet(
      request('/api/admin/games', { headers: await sessionHeaders(admin) }),
    );
    expect(res.status).toBe(200);
    const body = await res.json();
    for (const entry of gamePlugins) {
      const game = body.games.find(
        (item: { id: string }) => item.id === entry.manifest.id,
      );
      expect(game, entry.manifest.id).toBeDefined();
      expect(game).toMatchObject({
        enabled: true,
        // Версия — из манифеста, а не константа хоста.
        version: entry.manifest.version,
        schemaVersion: entry.manifest.schemaVersion,
        conformance: entry.manifest.tests?.conformance,
        tags: entry.manifest.tags,
        dependencies: entry.manifest.dependencies,
        demo: Boolean(entry.manifest.demo),
      });
    }
  });

  it('GET отдаёт семейство игры и useHostTheme по умолчанию false', async () => {
    const admin = await createUser('theme-admin', 'admin');
    const res = await adminGamesGet(
      request('/api/admin/games', { headers: await sessionHeaders(admin) }),
    );
    expect(res.status).toBe(200);
    const body = (await res.json()) as {
      games: { id: string; gameNameKey: string; useHostTheme: boolean }[];
    };
    const game = body.games.find((item) => item.id === FIRST_MODULE.id)!;
    expect(game.gameNameKey).toBeTruthy();
    expect(game.useHostTheme).toBe(false);
  });

  it('PUT useHostTheme переключает стили и виден в /api/games', async () => {
    await publishAllModules();
    const admin = await createUser('theme-admin-2', 'admin');

    const res = await adminGamesPut(
      await jsonRequest(
        '/api/admin/games',
        'PUT',
        { systemId: FIRST_MODULE.id, useHostTheme: true },
        admin,
      ),
    );
    expect(res.status).toBe(200);
    const body = (await res.json()) as {
      games: { id: string; useHostTheme: boolean }[];
    };
    expect(
      body.games.find((item) => item.id === FIRST_MODULE.id)?.useHostTheme,
    ).toBe(true);
    expect(await isModuleHostTheme(FIRST_MODULE.id)).toBe(true);

    const publicBody = (await listGames(admin)) as {
      games: {
        id: string;
        editions: { id: string; useHostTheme?: boolean }[];
      }[];
    };
    const edition = publicBody.games
      .flatMap((game) => game.editions)
      .find((item) => item.id === FIRST_MODULE.id);
    expect(edition?.useHostTheme).toBe(true);
  });

  it('PUT enabled переключает плагин, не меняя visibility', async () => {
    const admin = await createUser('toggle-admin', 'admin');
    await setModuleStatus(FIRST_MODULE.id, 'test');

    const off = await adminGamesPut(
      await jsonRequest(
        '/api/admin/games',
        'PUT',
        { systemId: FIRST_MODULE.id, enabled: false },
        admin,
      ),
    );
    expect(off.status).toBe(200);
    const offBody = await off.json();
    expect(
      offBody.games.find((game: { id: string }) => game.id === FIRST_MODULE.id),
    ).toMatchObject({ enabled: false, status: 'test' });

    const stored = readJson(`${dataDir}/settings/game-catalog.json`);
    expect(stored.plugins[FIRST_MODULE.id]).toEqual({
      enabled: false,
      visibility: 'test',
      useHostTheme: false,
    });

    const on = await adminGamesPut(
      await jsonRequest(
        '/api/admin/games',
        'PUT',
        { systemId: FIRST_MODULE.id, enabled: true },
        admin,
      ),
    );
    expect(on.status).toBe(200);
    const onBody = await on.json();
    expect(
      onBody.games.find((game: { id: string }) => game.id === FIRST_MODULE.id),
    ).toMatchObject({ enabled: true, status: 'test' });
  });

  it('PUT enabled валидирует boolean и систему', async () => {
    const admin = await createUser('toggle-validate', 'admin');
    const badEnabled = await adminGamesPut(
      await jsonRequest(
        '/api/admin/games',
        'PUT',
        { systemId: FIRST_MODULE.id, enabled: 'yes' },
        admin,
      ),
    );
    expect(badEnabled.status).toBe(400);

    const badSystem = await adminGamesPut(
      await jsonRequest(
        '/api/admin/games',
        'PUT',
        { systemId: MISSING_SYSTEM, enabled: false },
        admin,
      ),
    );
    expect(badSystem.status).toBe(400);
  });
});
