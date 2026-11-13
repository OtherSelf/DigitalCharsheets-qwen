import { afterEach, beforeEach, describe, expect, it } from 'vitest';

import { newUid } from '@/lib/ids';
import { createUserFolder, saveCharacterToServer } from '@/lib/server-storage';
import {
  resolveSharedCharacter,
  sanitizeCharacterForShare,
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
