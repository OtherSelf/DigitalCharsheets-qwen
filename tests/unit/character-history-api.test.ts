import { afterEach, beforeEach, describe, expect, it } from 'vitest';

import {
  DELETE as historyDelete,
  GET as historyGet,
} from '@/app/api/characters/[id]/history/route';
import { appendHistory, deleteCharacterHistory } from '@/lib/character-history';
import type { HistoryChange } from '@/lib/history-types';
import { newUid } from '@/lib/ids';
import { createUserFolder, saveCharacterToServer } from '@/lib/server-storage';

import {
  makeDndCharacter,
  removeDir,
  sessionHeaders,
  useTempDataDir,
} from './helpers';

const CHARACTER_ID = 'char-1';
const FOREIGN_ID = 'foreign-1';
const NOW = Date.parse('2026-05-12T10:00:00.000Z');
const SESSION_GAP = 60 * 60 * 1000;

let dataDir: string;
let uid: string;
let headers: Record<string, string>;

const params = (id = CHARACTER_ID) => ({
  params: Promise.resolve({ id }),
});

function request(
  query = '',
  requestHeaders: Record<string, string> = headers,
  id = CHARACTER_ID,
): Request {
  return new Request(`http://localhost/api/characters/${id}/history${query}`, {
    headers: requestHeaders,
  });
}

function changed(strength: number): HistoryChange {
  return {
    kind: 'changed',
    path: 'stats.strength',
    before: { value: strength - 1 },
    after: { value: strength },
  };
}

beforeEach(() => {
  dataDir = useTempDataDir();
  uid = newUid();
  createUserFolder(uid, 'history-api-user', 'History API');
  saveCharacterToServer(uid, makeDndCharacter({ id: CHARACTER_ID }));
  headers = sessionHeaders(uid);

  const foreignUid = newUid();
  createUserFolder(foreignUid, 'history-foreign', 'Foreign');
  saveCharacterToServer(foreignUid, makeDndCharacter({ id: FOREIGN_ID }));

  // Оставляем только контролируемые ревизии, без create-маркера.
  deleteCharacterHistory(uid, CHARACTER_ID);
  for (let index = 0; index < 3; index += 1) {
    appendHistory(
      uid,
      CHARACTER_ID,
      {
        changes: [changed(11 + index)],
        summary: { changed: 1, added: 0, removed: 0, bulk: 0 },
      },
      { nowMs: NOW + index * SESSION_GAP },
    );
  }
});

afterEach(() => {
  removeDir(dataDir);
});

describe('GET /api/characters/[id]/history', () => {
  it('без сессии — 401', async () => {
    const res = await historyGet(request('', {}), params());
    expect(res.status).toBe(401);
  });

  it('400 на небезопасный id и 404 на чужой лист', async () => {
    const invalid = await historyGet(
      request('', headers, '../user'),
      params('../user'),
    );
    expect(invalid.status).toBe(400);
    expect(await invalid.json()).toMatchObject({ reason: 'invalid_id' });

    const foreign = await historyGet(
      request('', headers, FOREIGN_ID),
      params(FOREIGN_ID),
    );
    expect(foreign.status).toBe(404);
    expect(await foreign.json()).toMatchObject({ reason: 'not_found' });
  });

  it('400 на неверные limit/before', async () => {
    for (const query of [
      '?limit=0',
      '?limit=101',
      '?limit=abc',
      '?before=not-a-date',
    ]) {
      const res = await historyGet(request(query), params());
      expect(res.status, query).toBe(400);
    }
  });

  it('отдаёт сессии, счётчики и no-store', async () => {
    const res = await historyGet(request(), params());

    expect(res.status).toBe(200);
    expect(res.headers.get('cache-control')).toBe('no-store');
    const body = (await res.json()) as {
      sessions: { changes: HistoryChange[]; revisionCount: number }[];
      totalSessions: number;
      totalRevisions: number;
      storage: { bytes: number; truncated: boolean };
      nextCursor: string | null;
    };
    expect(body.totalSessions).toBe(3);
    expect(body.totalRevisions).toBe(3);
    expect(body.sessions).toHaveLength(3);
    expect(body.sessions[0].changes[0]).toEqual(changed(13));
    expect(body.storage.bytes).toBeGreaterThan(0);
    expect(body.storage.truncated).toBe(false);
    expect(body.nextCursor).toBeNull();
  });

  it('пагинирует по before без дублей', async () => {
    const first = (await (
      await historyGet(request('?limit=1'), params())
    ).json()) as { sessions: { id: string }[]; nextCursor: string };
    expect(first.sessions).toHaveLength(1);
    expect(first.nextCursor).toBeTruthy();

    const second = (await (
      await historyGet(
        request(`?limit=1&before=${encodeURIComponent(first.nextCursor)}`),
        params(),
      )
    ).json()) as { sessions: { id: string }[] };
    expect(second.sessions).toHaveLength(1);
    expect(second.sessions[0].id).not.toBe(first.sessions[0].id);
  });
});

describe('DELETE /api/characters/[id]/history', () => {
  it('очищает историю и не трогает лист', async () => {
    const res = await historyDelete(request(), params());
    expect(res.status).toBe(200);
    expect(await res.json()).toMatchObject({ success: true, deleted: true });
    expect(res.headers.get('cache-control')).toBe('no-store');

    const empty = (await (await historyGet(request(), params())).json()) as {
      sessions: unknown[];
      totalRevisions: number;
    };
    expect(empty.sessions).toEqual([]);
    expect(empty.totalRevisions).toBe(0);

    // Лист на месте: GET снова видит его (и создаёт новый create-маркер? нет,
    // история просто пустая).
    const again = await historyGet(request(), params());
    expect(again.status).toBe(200);
  });

  it('идемпотентен и требует владельца', async () => {
    expect((await historyDelete(request(), params())).status).toBe(200);
    expect((await historyDelete(request(), params())).status).toBe(200);
    expect(
      (
        await historyDelete(
          request('', headers, FOREIGN_ID),
          params(FOREIGN_ID),
        )
      ).status,
    ).toBe(404);
  });
});
