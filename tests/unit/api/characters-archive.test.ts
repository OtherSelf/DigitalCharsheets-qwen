/**
 * Архив и корзина через API: DELETE → корзина, восстановление, очистка,
 * архивный список. Домен вынесен из `characters.test.ts`, чтобы не превышать
 * лимит раскладки и не смешивать CRUD с жизненным циклом хранения.
 */

import { afterEach, beforeEach, describe, expect, it } from 'vitest';

import {
  POST as archiveCharacter,
  DELETE as unarchiveCharacter,
} from '@/app/api/characters/[id]/archive/route';
import { POST as restoreCharacter } from '@/app/api/characters/[id]/restore/route';
import { DELETE as characterDelete } from '@/app/api/characters/[id]/route';
import {
  GET as archiveList,
  DELETE as clearArchiveRoute,
} from '@/app/api/characters/archive/route';
import {
  GET as charactersGet,
  POST as charactersPost,
} from '@/app/api/characters/route';
import {
  DELETE as purgeTrashRoute,
  GET as trashList,
} from '@/app/api/characters/trash/route';
import { resetAuthRateLimits } from '@/lib/security/rate-limit';
import { resetWriteSeqGuard } from '@/lib/server-storage';

import {
  makeCharacter,
  pluginIds,
  removeDir,
  sessionHeaders,
  useTempDataDir,
} from '@tests/support';
import { loginAs } from '@tests/support/api-auth';
import { json, params, req } from '@tests/support/http';

let dataDir: string;

beforeEach(() => {
  dataDir = useTempDataDir();
  resetWriteSeqGuard();
  resetAuthRateLimits();
});

afterEach(() => {
  removeDir(dataDir);
  resetWriteSeqGuard();
});

describe('архив и корзина через API', () => {
  it('DELETE переносит персонажа в корзину; повторный вызов идемпотентен', async () => {
    const { uid } = await loginAs('user-api');
    const created = await (
      await charactersPost(
        json({ ...makeCharacter(pluginIds()[0]) }, await sessionHeaders(uid)),
      )
    ).json();
    const url = `http://localhost/api/characters/${created.id}`;

    const first = await characterDelete(
      req(url, 'DELETE', await sessionHeaders(uid)),
      params(created.id),
    );
    expect(first.status).toBe(200);
    const firstBody = await first.json();
    expect(firstBody.trashed).toBe(true);
    expect(firstBody.expiresAt).toBeTruthy();

    const second = await characterDelete(
      req(url, 'DELETE', await sessionHeaders(uid)),
      params(created.id),
    );
    expect(second.status).toBe(200);
    expect((await second.json()).trashed).toBe(true);

    const trash = await trashList(
      req(
        'http://localhost/api/characters/trash',
        'GET',
        await sessionHeaders(uid),
      ),
    );
    expect(trash.status).toBe(200);
    expect((await trash.json()).trash).toHaveLength(1);

    const noSession = await characterDelete(
      req(url, 'DELETE'),
      params(created.id),
    );
    expect(noSession.status).toBe(401);
  });

  it('архивирует, возвращает и очищает архив', async () => {
    const { uid } = await loginAs('user-api');
    const created = await (
      await charactersPost(
        json({ ...makeCharacter(pluginIds()[0]) }, await sessionHeaders(uid)),
      )
    ).json();
    const headers = await sessionHeaders(uid);
    const url = `http://localhost/api/characters/${created.id}`;

    const archived = await archiveCharacter(
      req(`${url}/archive`, 'POST', headers),
      params(created.id),
    );
    expect(archived.status).toBe(200);
    expect((await archived.json()).character.name).toBeTruthy();

    const list = await charactersGet(
      req('http://localhost/api/characters', 'GET', headers),
    );
    expect((await list.json()).map((c: any) => c.id)).not.toContain(created.id);

    const archive = await archiveList(
      req('http://localhost/api/characters/archive', 'GET', headers),
    );
    const archiveBody = await archive.json();
    expect(archiveBody.archive).toHaveLength(1);
    expect(archiveBody.trash).toHaveLength(0);

    const restored = await unarchiveCharacter(
      req(`${url}/archive`, 'DELETE', headers),
      params(created.id),
    );
    expect(restored.status).toBe(200);

    const afterRestore = await charactersGet(
      req('http://localhost/api/characters', 'GET', headers),
    );
    expect((await afterRestore.json()).map((c: any) => c.id)).toContain(
      created.id,
    );

    await archiveCharacter(
      req(`${url}/archive`, 'POST', headers),
      params(created.id),
    );
    const cleared = await clearArchiveRoute(
      req('http://localhost/api/characters/archive', 'DELETE', headers),
    );
    expect(cleared.status).toBe(200);
    expect((await cleared.json()).removed).toBe(1);
  });

  it('возвращает из корзины и очищает её', async () => {
    const { uid } = await loginAs('user-api');
    const created = await (
      await charactersPost(
        json({ ...makeCharacter(pluginIds()[0]) }, await sessionHeaders(uid)),
      )
    ).json();
    const headers = await sessionHeaders(uid);
    const url = `http://localhost/api/characters/${created.id}`;

    await characterDelete(req(url, 'DELETE', headers), params(created.id));

    const restored = await restoreCharacter(
      req(`${url}/restore`, 'POST', headers),
      params(created.id),
    );
    expect(restored.status).toBe(200);

    await characterDelete(req(url, 'DELETE', headers), params(created.id));
    const purged = await purgeTrashRoute(
      req('http://localhost/api/characters/trash', 'DELETE', headers),
    );
    expect(purged.status).toBe(200);
    expect((await purged.json()).removed).toBe(1);
  });
});
