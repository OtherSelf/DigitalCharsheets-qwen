import fs from 'fs';

import { afterEach, beforeEach, describe, expect, it } from 'vitest';

import { readHistory } from '@/lib/character-history';
import { getHistoryFile } from '@/lib/data-dir';
import { newUid } from '@/lib/ids';
import {
  createUserFolder,
  deleteCharacterFromServer,
  saveCharacterToServer,
  updateCharacterOnServer,
} from '@/lib/server-storage';
import type { Character } from '@/lib/types';

import { makeDndCharacter, removeDir, useTempDataDir } from './helpers';

const CHARACTER_ID = 'char-1';

let dataDir: string;
let uid: string;

function character(): Character {
  return makeDndCharacter({ id: CHARACTER_ID }) as Character;
}

beforeEach(() => {
  dataDir = useTempDataDir();
  uid = newUid();
  createUserFolder(uid, 'history-user', 'History');
  saveCharacterToServer(uid, character());
});

afterEach(() => {
  removeDir(dataDir);
});

describe('history recording', () => {
  it('создаёт маркер при создании листа', () => {
    const read = readHistory(uid, CHARACTER_ID);

    expect(read.revisions).toHaveLength(1);
    expect(read.revisions[0].source).toBe('create');
    expect(read.revisions[0].changes).toEqual([]);
  });

  it('записывает diff успешного PUT', () => {
    const current = character();
    const stats = current.stats as Record<string, number>;
    updateCharacterOnServer(uid, CHARACTER_ID, {
      stats: { ...stats, strength: 18 },
    });

    const read = readHistory(uid, CHARACTER_ID);
    expect(read.revisions).toHaveLength(2);
    const last = read.revisions[1];
    expect(last.source).toBe('save');
    expect(last.changes).toContainEqual({
      kind: 'changed',
      path: 'stats.strength',
      before: { value: 16 },
      after: { value: 18 },
    });
  });

  it('не пишет ревизию для пустого патча и stale-записи', () => {
    updateCharacterOnServer(uid, CHARACTER_ID, {
      name: 'Ragnar Testborn',
    });
    expect(readHistory(uid, CHARACTER_ID).revisions).toHaveLength(1);

    updateCharacterOnServer(
      uid,
      CHARACTER_ID,
      { name: 'Fresh' },
      { writeToken: { page: 'page-1', seq: 2 } },
    );
    const afterFresh = readHistory(uid, CHARACTER_ID);
    expect(afterFresh.revisions).toHaveLength(2);

    updateCharacterOnServer(
      uid,
      CHARACTER_ID,
      { name: 'Stale' },
      { writeToken: { page: 'page-1', seq: 1 } },
    );
    const afterStale = readHistory(uid, CHARACTER_ID);
    expect(afterStale.revisions).toHaveLength(2);
  });

  it('удаляет историю вместе с листом', () => {
    const file = getHistoryFile(uid, CHARACTER_ID);
    expect(file).not.toBeNull();
    expect(fs.existsSync(file!)).toBe(true);

    expect(deleteCharacterFromServer(uid, CHARACTER_ID)).toBe(true);
    expect(fs.existsSync(file!)).toBe(false);
    expect(readHistory(uid, CHARACTER_ID).revisions).toHaveLength(0);
  });
});
