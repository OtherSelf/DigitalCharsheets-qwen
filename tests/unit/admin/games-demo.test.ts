/**
 * Демо-лендинг: флаг «на демо», лимит `DEMO_MAX` и независимость от роли.
 * Отдельный файл, чтобы `games.test.ts` не перерос лимит раскладки тестов.
 */

import { afterEach, beforeEach, describe, expect, it } from 'vitest';

import {
  GET as adminGamesGet,
  PUT as adminGamesPut,
} from '@/app/api/admin/games/route';
import {
  setModuleDemo,
  setModuleEnabled,
  setModuleStatus,
} from '@/lib/game-catalog';

import { removeDir, sessionHeaders, useTempDataDir } from '@tests/support';
import {
  createUser,
  FIRST_MODULE,
  jsonRequest,
  listGames,
  MODULES,
  publishAllModules,
  request,
  SECOND_MODULE,
} from '@tests/support/games-api';

let dataDir: string;

beforeEach(() => {
  dataDir = useTempDataDir();
});

afterEach(() => {
  delete process.env.DCS_DATA_DIR;
  removeDir(dataDir);
});

describe('демо-лендинг: флаг «на демо» и лимит', () => {
  it('по умолчанию на демо только опубликованные редакции', async () => {
    await publishAllModules();
    const body = await listGames();
    // sandbox опубликован, но его флаг по умолчанию выключен (манифест test).
    expect(body.demo.map((edition) => edition.id)).toEqual([
      FIRST_MODULE.id,
      SECOND_MODULE.id,
      MODULES[2].id,
    ]);
  });

  it('список демо не зависит от роли', async () => {
    await publishAllModules();
    const adminUid = await createUser('demo-admin', 'admin');
    const guest = await listGames();
    const admin = await listGames(adminUid);
    expect(admin.demo.map((edition) => edition.id)).toEqual(
      guest.demo.map((edition) => edition.id),
    );
  });

  it('флаг включает редакцию, лимит отсекает четвёртую по порядку', async () => {
    await publishAllModules();
    await setModuleDemo(MODULES[3].id, true);

    const limited = await listGames();
    expect(limited.demo).toHaveLength(3);
    expect(limited.demo.map((edition) => edition.id)).not.toContain(
      MODULES[3].id,
    );

    // Освободили место в первой тройке — четвёртая по порядку попала на демо.
    await setModuleDemo(FIRST_MODULE.id, false);
    const shifted = await listGames();
    expect(shifted.demo.map((edition) => edition.id)).toEqual([
      SECOND_MODULE.id,
      MODULES[2].id,
      MODULES[3].id,
    ]);
  });

  it('тестовая редакция не попадает на демо даже с включённым флагом', async () => {
    await setModuleEnabled(FIRST_MODULE.id, true);
    await setModuleDemo(FIRST_MODULE.id, true);
    await setModuleStatus(FIRST_MODULE.id, 'test');

    const body = await listGames();
    expect(body.demo.map((edition) => edition.id)).not.toContain(
      FIRST_MODULE.id,
    );
  });

  it('админский API отдаёт и переключает showOnDemo', async () => {
    const uid = await createUser('demo-flag-admin', 'admin');

    const before = await adminGamesGet(
      request('/api/admin/games', { headers: await sessionHeaders(uid) }),
    );
    const beforeBody = (await before.json()) as {
      games: { id: string; showOnDemo: boolean }[];
    };
    const entry = beforeBody.games.find((game) => game.id === SECOND_MODULE.id);
    expect(entry?.showOnDemo).toBe(true);

    const updated = await adminGamesPut(
      await jsonRequest(
        '/api/admin/games',
        'PUT',
        { systemId: SECOND_MODULE.id, showOnDemo: false },
        uid,
      ),
    );
    expect(updated.status).toBe(200);
    const body = (await updated.json()) as {
      games: { id: string; showOnDemo: boolean }[];
    };
    expect(
      body.games.find((game) => game.id === SECOND_MODULE.id)?.showOnDemo,
    ).toBe(false);
  });
});
