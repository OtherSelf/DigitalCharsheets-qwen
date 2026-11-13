import { afterEach, beforeEach, describe, expect, it } from 'vitest';

import {
  DELETE as shareDelete,
  GET as shareGet,
  POST as sharePost,
} from '@/app/api/characters/[id]/share/route';
import { newUid } from '@/lib/ids';
import { createUserFolder, saveCharacterToServer } from '@/lib/server-storage';
import { getShareForCharacter, resolveShareToken } from '@/lib/shares';

import {
  makeDndCharacter,
  removeDir,
  sessionHeaders,
  useTempDataDir,
} from './helpers';

const CHARACTER_ID = 'char-1';
const FOREIGN_CHARACTER_ID = 'foreign-1';

let dataDir: string;
let uid: string;
let headers: Record<string, string>;

const params = (id = CHARACTER_ID) => ({
  params: Promise.resolve({ id }),
});

function request(
  method: 'GET' | 'POST' | 'DELETE',
  body?: unknown,
  requestHeaders: Record<string, string> = headers,
): Request {
  return new Request(`http://localhost/api/characters/${CHARACTER_ID}/share`, {
    method,
    headers: {
      ...(body === undefined ? {} : { 'content-type': 'application/json' }),
      ...requestHeaders,
    },
    body: body === undefined ? undefined : JSON.stringify(body),
  });
}

beforeEach(() => {
  dataDir = useTempDataDir();
  uid = newUid();
  createUserFolder(uid, 'share-api-user', 'Share API');
  saveCharacterToServer(uid, makeDndCharacter({ id: CHARACTER_ID }));
  headers = sessionHeaders(uid);

  const foreignUid = newUid();
  createUserFolder(foreignUid, 'share-foreign-user', 'Foreign');
  saveCharacterToServer(
    foreignUid,
    makeDndCharacter({ id: FOREIGN_CHARACTER_ID }),
  );
});

afterEach(() => {
  removeDir(dataDir);
});

describe('GET/POST/DELETE /api/characters/[id]/share', () => {
  it('без сессии — 401 на всех методах', async () => {
    expect(
      (await shareGet(request('GET', undefined, {}), params())).status,
    ).toBe(401);
    expect((await sharePost(request('POST', {}, {}), params())).status).toBe(
      401,
    );
    expect(
      (await shareDelete(request('DELETE', undefined, {}), params())).status,
    ).toBe(401);
  });

  it('без ссылки возвращает active:false и no-store', async () => {
    const res = await shareGet(request('GET'), params());

    expect(res.status).toBe(200);
    expect(await res.json()).toEqual({ success: true, active: false });
    expect(res.headers.get('cache-control')).toBe('no-store');
  });

  it('400 на небезопасный id и 404 на чужой лист', async () => {
    const invalid = await shareGet(
      request('GET', undefined, headers),
      params('../user'),
    );
    expect(invalid.status).toBe(400);
    expect(await invalid.json()).toMatchObject({
      success: false,
      reason: 'invalid_id',
    });

    const foreign = await shareGet(
      request('GET', undefined, headers),
      params(FOREIGN_CHARACTER_ID),
    );
    expect(foreign.status).toBe(404);
    expect(await foreign.json()).toMatchObject({
      success: false,
      reason: 'not_found',
    });
  });

  it('400 на недопустимый срок и битое тело', async () => {
    const invalidExpiry = await sharePost(
      request('POST', { expiresInDays: 14 }),
      params(),
    );
    expect(invalidExpiry.status).toBe(400);
    expect(await invalidExpiry.json()).toMatchObject({
      success: false,
      reason: 'invalid_expiry',
    });

    const broken = await sharePost(
      new Request(`http://localhost/api/characters/${CHARACTER_ID}/share`, {
        method: 'POST',
        headers: { 'content-type': 'application/json', ...headers },
        body: '{ broken',
      }),
      params(),
    );
    expect(broken.status).toBe(400);
  });

  it('создаёт ссылку, отдаёт токен один раз и не светит его в GET', async () => {
    const created = await sharePost(
      request('POST', { expiresInDays: 30 }),
      params(),
    );
    expect(created.status).toBe(201);

    const body = (await created.json()) as {
      success: boolean;
      token: string;
      path: string;
      createdAt: string;
      expiresAt: string;
    };
    expect(body.success).toBe(true);
    expect(body.path).toBe(`/share/${body.token}`);
    expect(await resolveShareToken(body.token)).toMatchObject({
      uid,
      characterId: CHARACTER_ID,
    });

    const status = await shareGet(request('GET'), params());
    expect(status.status).toBe(200);
    const statusBody = (await status.json()) as {
      active: boolean;
      token?: string;
      includeHistory: boolean;
    };
    expect(statusBody.active).toBe(true);
    expect(statusBody.includeHistory).toBe(false);
    expect(statusBody.token).toBeUndefined();
    expect(JSON.stringify(statusBody)).not.toContain(body.token);
  });

  it('включает историю по флагу и отвергает не-boolean', async () => {
    const invalid = await sharePost(
      request('POST', { includeHistory: 'yes' }),
      params(),
    );
    expect(invalid.status).toBe(400);
    expect(await invalid.json()).toMatchObject({
      reason: 'invalid_include_history',
    });

    const created = await sharePost(
      request('POST', { includeHistory: true }),
      params(),
    );
    expect(created.status).toBe(201);
    const body = (await created.json()) as {
      token: string;
      includeHistory: boolean;
    };
    expect(body.includeHistory).toBe(true);
    expect(await resolveShareToken(body.token)).toMatchObject({
      includeHistory: true,
    });

    const status = await shareGet(request('GET'), params());
    expect(await status.json()).toMatchObject({
      active: true,
      includeHistory: true,
    });
  });

  it('перевыпуск убивает старую ссылку и оставляет одну запись', async () => {
    const first = (await (
      await sharePost(request('POST', {}), params())
    ).json()) as { token: string };

    const second = (await (
      await sharePost(request('POST', { expiresInDays: 90 }), params())
    ).json()) as { token: string };

    expect(second.token).not.toBe(first.token);
    expect(await resolveShareToken(first.token)).toBeNull();
    expect(await resolveShareToken(second.token)).not.toBeNull();
  });

  it('DELETE отзывает ссылку идемпотентно', async () => {
    const created = (await (
      await sharePost(request('POST', {}), params())
    ).json()) as { token: string };

    const revoked = await shareDelete(request('DELETE'), params());
    expect(revoked.status).toBe(200);
    expect(revoked.headers.get('cache-control')).toBe('no-store');
    expect(await resolveShareToken(created.token)).toBeNull();
    expect(getShareForCharacter(uid, CHARACTER_ID)).toBeNull();

    const again = await shareDelete(request('DELETE'), params());
    expect(again.status).toBe(200);
  });
});
