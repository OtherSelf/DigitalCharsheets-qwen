import fs from 'node:fs/promises';
import path from 'node:path';

import { afterEach, beforeEach, describe, expect, it } from 'vitest';

import { PUT as orderPut } from '@/app/api/characters/order/route';
import {
  GET as charactersGet,
  POST as charactersPost,
} from '@/app/api/characters/route';
import { listGameModules } from '@/games/registry';
import {
  applyCharacterOrder,
  normalizeCharacterOrder,
} from '@/lib/character-order';
import { getCharactersDir } from '@/lib/data-dir';
import { resetAuthRateLimits } from '@/lib/security/rate-limit';
import { getStoredUser } from '@/lib/server-auth';

import {
  makeCharacter,
  removeDir,
  sessionHeaders,
  useTempDataDir,
} from '@tests/support';
import { loginAs } from '@tests/support/api-auth';
import { json, req } from '@tests/support/http';

/**
 * Порядок карточек: профиль `characterOrder`, `PUT /api/characters/order` и
 * серверная сортировка «свежие сверху» как значение по умолчанию.
 */

const URL = 'http://localhost/api/characters';
const ORDER_URL = 'http://localhost/api/characters/order';

let dataDir = '';

beforeEach(() => {
  dataDir = useTempDataDir();
  resetAuthRateLimits();
});

afterEach(() => {
  removeDir(dataDir);
  delete process.env.DCS_DATA_DIR;
});

/** PUT с JSON-телом: `req` из support тела не умеет (он для GET/POST-роутов). */
async function putOrder(uid: string | null, body: unknown) {
  return orderPut(
    new Request(ORDER_URL, {
      method: 'PUT',
      headers: {
        'content-type': 'application/json',
        ...(uid ? await sessionHeaders(uid) : {}),
      },
      body: JSON.stringify(body),
    }),
  );
}

async function createSheet(uid: string, name: string) {
  const payload = makeCharacter(listGameModules()[0].id, { name });
  const response = await charactersPost(
    json(payload, await sessionHeaders(uid)),
  );
  expect(response.status).toBe(201);
  return (await response.json()) as { id: string; name: string };
}

async function listIds(uid: string) {
  const response = await charactersGet(
    req(URL, 'GET', await sessionHeaders(uid)),
  );
  expect(response.status).toBe(200);
  const list = (await response.json()) as Array<{ id: string; name: string }>;
  return list.map((item) => item.id);
}

async function setMtime(uid: string, id: string, secondsAgo: number) {
  const file = path.join(getCharactersDir(uid), `${id}.json`);
  const time = new Date(Date.now() - secondsAgo * 1000);
  await fs.utimes(file, time, time);
}

describe('normalizeCharacterOrder', () => {
  it('фильтрует мусор, дубли и соблюдает лимит', () => {
    expect(normalizeCharacterOrder('nope')).toBeUndefined();
    expect(normalizeCharacterOrder([1, {}, '../etc'])).toEqual([]);
    expect(normalizeCharacterOrder(['a', 'a', 'b', ' c'])).toEqual(['a', 'b']);
    const many = Array.from({ length: 600 }, (_, index) => `id${index}`);
    expect(normalizeCharacterOrder(many)).toHaveLength(500);
  });
});

describe('applyCharacterOrder', () => {
  it('ставит известные id по порядку, остальные — в конце', () => {
    const list = [{ id: 'a' }, { id: 'b' }, { id: 'c' }];
    expect(applyCharacterOrder(list, ['c', 'a']).map((x) => x.id)).toEqual([
      'c',
      'a',
      'b',
    ]);
    expect(applyCharacterOrder(list, []).map((x) => x.id)).toEqual([
      'a',
      'b',
      'c',
    ]);
  });
});

describe('PUT /api/characters/order', () => {
  it('без сессии — 401', async () => {
    const response = await putOrder(null, { order: [] });
    expect(response.status).toBe(401);
  });

  it('не массив — 400', async () => {
    const { uid } = await loginAs('order-bad');
    const response = await putOrder(uid, { order: 'nope' });
    expect(response.status).toBe(400);
  });

  it('сохраняет порядок в профиле и отдаёт его в GET', async () => {
    const { uid } = await loginAs('order-save');
    const first = await createSheet(uid, 'Первый');
    const second = await createSheet(uid, 'Второй');

    const response = await putOrder(uid, { order: [second.id, first.id] });
    expect(response.status).toBe(200);
    expect(await response.json()).toEqual({
      success: true,
      order: [second.id, first.id],
    });

    expect(await listIds(uid)).toEqual([second.id, first.id]);
    const profile = await getStoredUser(uid);
    expect(profile?.characterOrder).toEqual([second.id, first.id]);
  });

  it('игнорирует неизвестные id и дописывает новый лист в конец', async () => {
    const { uid } = await loginAs('order-unknown');
    const first = await createSheet(uid, 'Первый');

    await putOrder(uid, { order: ['deleted-sheet', first.id] });
    const second = await createSheet(uid, 'Новый');

    expect(await listIds(uid)).toEqual([first.id, second.id]);
  });
});

describe('порядок по умолчанию', () => {
  it('свежие листы идут первыми (mtime)', async () => {
    const { uid } = await loginAs('order-default');
    const older = await createSheet(uid, 'Старый');
    const newer = await createSheet(uid, 'Новый');
    await setMtime(uid, older.id, 120);
    await setMtime(uid, newer.id, 10);

    expect(await listIds(uid)).toEqual([newer.id, older.id]);
  });
});
