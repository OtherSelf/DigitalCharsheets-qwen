import { afterEach, beforeEach, describe, expect, it } from 'vitest';

import { appendHistory } from '@/lib/character-history';
import type { HistorySession } from '@/lib/history-types';
import { newUid } from '@/lib/ids';
import { createUserFolder, saveCharacterToServer } from '@/lib/server-storage';
import {
  resolveSharedCharacter,
  resolveSharedSheet,
  sanitizeCharacterForShare,
  sanitizeHistoryForShare,
} from '@/lib/shared-character';
import { issueShareToken } from '@/lib/shares';
import type { Character } from '@/lib/types';

import { makeDndCharacter, removeDir, useTempDataDir } from './helpers';

let dataDir: string;

beforeEach(() => {
  dataDir = useTempDataDir();
});

afterEach(() => {
  removeDir(dataDir);
});

describe('sanitizeCharacterForShare', () => {
  it('рекурсивно убирает userId и служебные поля, не мутируя лист', () => {
    const source = makeDndCharacter({
      id: 'char-1',
      userId: 'owner-1',
      __page: 'page-1',
      inventory: [{ id: 'i1', name: 'Sword', userId: 'owner-1', __seq: 2 }],
    }) as Character;

    const sanitized = sanitizeCharacterForShare(source);

    expect(sanitized.userId).toBeUndefined();
    expect((sanitized as Record<string, unknown>).__page).toBeUndefined();
    const inventory = sanitized.inventory as Record<string, unknown>[];
    expect(inventory[0].userId).toBeUndefined();
    expect(inventory[0].__seq).toBeUndefined();
    expect(inventory[0].name).toBe('Sword');

    // Исходный объект не тронут.
    expect(source.userId).toBe('owner-1');
    expect((source.inventory as Record<string, unknown>[])[0].userId).toBe(
      'owner-1',
    );
  });
});

describe('resolveSharedCharacter', () => {
  it('возвращает лист по токену и не отдаёт uid владельца', () => {
    const uid = newUid();
    createUserFolder(uid, 'shared-user', 'Shared');
    saveCharacterToServer(uid, makeDndCharacter({ id: 'char-1' }));
    const { token } = issueShareToken(uid, 'char-1');

    const character = resolveSharedCharacter(token);

    expect(character).not.toBeNull();
    expect(character?.name).toBe('Ragnar Testborn');
    expect(character?.userId).toBeUndefined();
    expect(character?.id).toBe('char-1');
  });

  it('возвращает null для неизвестного или неверного токена', () => {
    expect(resolveSharedCharacter('')).toBeNull();
    expect(resolveSharedCharacter('a'.repeat(43))).toBeNull();
  });
});

describe('shared history', () => {
  it('рекурсивно вычищает uid и __* из значений до/после', () => {
    const sessions = [
      {
        id: 's1',
        startedAt: '2026-05-12T18:00:00.000Z',
        endedAt: '2026-05-12T18:00:00.000Z',
        revisionCount: 1,
        truncated: false,
        markers: [],
        changes: [
          {
            kind: 'changed',
            path: 'inventory',
            key: 'i1',
            label: 'Sword',
            field: 'notes',
            before: {
              value: { name: 'Sword', userId: 'owner-1', __page: 1 },
            },
            after: {
              value: { name: 'Sword', userId: 'owner-1', __page: 2 },
            },
            values: [{ value: { userId: 'owner-1', __seq: 3 } }],
          },
        ],
      },
    ] as unknown as HistorySession[];

    const sanitized = sanitizeHistoryForShare(sessions);
    const value = sanitized[0].changes[0].after?.value as Record<
      string,
      unknown
    >;
    expect(value.userId).toBeUndefined();
    expect(value.__page).toBeUndefined();
    expect(value.name).toBe('Sword');
    expect(
      (sanitized[0].changes[0].values?.[0].value as Record<string, unknown>)
        .userId,
    ).toBeUndefined();
  });

  it('вырезает uid и __* из обрезанного preview', () => {
    const sessions = [
      {
        id: 's1',
        startedAt: '2026-05-12T18:00:00.000Z',
        endedAt: '2026-05-12T18:00:00.000Z',
        revisionCount: 1,
        truncated: false,
        markers: [],
        changes: [
          {
            kind: 'changed',
            path: 'notes',
            before: {
              truncated: true,
              preview:
                '{"userId":"owner-1","__page":2,"name":"Sword","notes":"long',
              length: 1000,
            },
          },
        ],
      },
    ] as unknown as HistorySession[];

    const preview =
      sanitizeHistoryForShare(sessions)[0].changes[0].before?.preview;
    expect(preview).not.toContain('owner-1');
    expect(preview).not.toContain('"__page":2');
    expect(preview).toContain('"name":"Sword"');
  });

  it('показывает историю только при includeHistory и без uid', () => {
    const uid = newUid();
    createUserFolder(uid, 'shared-history', 'Shared History');
    saveCharacterToServer(uid, makeDndCharacter({ id: 'char-1' }));
    appendHistory(
      uid,
      'char-1',
      {
        changes: [
          {
            kind: 'changed',
            path: 'notes',
            before: { value: { text: 'old', userId: uid } },
            after: { value: { text: 'new', userId: uid } },
          },
        ],
        summary: { changed: 1, added: 0, removed: 0, bulk: 0 },
      },
      { nowMs: Date.parse('2026-05-12T18:00:00.000Z') },
    );

    const without = issueShareToken(uid, 'char-1');
    expect(resolveSharedSheet(without.token)?.history).toBeNull();

    const withHistory = issueShareToken(uid, 'char-1', {
      includeHistory: true,
    });
    const shared = resolveSharedSheet(withHistory.token);
    const changes = shared?.history?.sessions.flatMap(
      (session) => session.changes,
    );
    expect(changes).toHaveLength(1);
    expect(changes?.[0].after?.value).toEqual({ text: 'new' });
    expect(JSON.stringify(shared?.history)).not.toContain(uid);
  });
});
