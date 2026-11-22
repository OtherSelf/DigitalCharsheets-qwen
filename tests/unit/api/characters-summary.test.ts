import { afterEach, beforeEach, describe, expect, it } from 'vitest';

import {
  GET as charactersGet,
  POST as charactersPost,
} from '@/app/api/characters/route';
import { listGameModules } from '@/games/registry';
import { resetAuthRateLimits } from '@/lib/security/rate-limit';

import {
  makeCharacter,
  removeDir,
  sessionHeaders,
  useTempDataDir,
} from '@tests/support';
import { loginAs } from '@tests/support/api-auth';
import { json, req } from '@tests/support/http';

/**
 * `?view=summary` и ETag/304: аддитивный контракт, старый GET не меняется.
 */

const URL = 'http://localhost/api/characters';

let dataDir = '';

beforeEach(() => {
  dataDir = useTempDataDir();
  resetAuthRateLimits();
});

afterEach(() => {
  removeDir(dataDir);
  delete process.env.DCS_DATA_DIR;
});

async function createSheet(uid: string, name: string) {
  const payload = makeCharacter(listGameModules()[0].id, { name });
  const response = await charactersPost(
    json(payload, await sessionHeaders(uid)),
  );
  expect(response.status).toBe(201);
  return (await response.json()) as { id: string; name: string };
}

describe('GET /api/characters', () => {
  it('summary возвращает только карточки, полный GET — листы', async () => {
    const { uid } = await loginAs('summary-user');
    const first = await createSheet(uid, 'Первый');
    const second = await createSheet(uid, 'Второй');

    const full = await charactersGet(
      req(URL, 'GET', await sessionHeaders(uid)),
    );
    expect(full.status).toBe(200);
    const sheets = (await full.json()) as Array<Record<string, unknown>>;
    expect(sheets).toHaveLength(2);
    expect(sheets[0]).toHaveProperty('stats');

    const summary = await charactersGet(
      req(`${URL}?view=summary`, 'GET', await sessionHeaders(uid)),
    );
    expect(summary.status).toBe(200);
    expect(summary.headers.get('cache-control')).toBe('private, no-cache');
    const cards = (await summary.json()) as Array<Record<string, unknown>>;
    expect(cards).toHaveLength(2);
    expect(cards.map((card) => card.name).sort()).toEqual(
      [first.name, second.name].sort(),
    );
    expect(cards[0]).toEqual({
      id: expect.any(String),
      name: expect.any(String),
      systemId: expect.any(String),
      updatedAt: expect.any(String),
    });
    expect(cards[0]).not.toHaveProperty('stats');
  });

  it('ETag: повторный GET с If-None-Match — 304 без тела', async () => {
    const { uid } = await loginAs('etag-user');
    await createSheet(uid, 'ETag');

    const headers = await sessionHeaders(uid);
    const first = await charactersGet(req(URL, 'GET', headers));
    expect(first.status).toBe(200);
    const etag = first.headers.get('etag');
    expect(etag).toMatch(/^"[A-Za-z0-9_-]{27}"$/);

    const second = await charactersGet(
      req(URL, 'GET', { ...headers, 'if-none-match': etag! }),
    );
    expect(second.status).toBe(304);
    expect(second.headers.get('etag')).toBe(etag);
    expect(await second.text()).toBe('');

    // Другой ответ — другой валидатор.
    const updated = await createSheet(uid, 'Второй ETag');
    expect(updated.id).toBeTruthy();
    const third = await charactersGet(req(URL, 'GET', headers));
    expect(third.headers.get('etag')).not.toBe(etag);
  });
});
