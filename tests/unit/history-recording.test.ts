import fs from 'fs';

import { afterEach, beforeEach, describe, expect, it } from 'vitest';

import { readHistory } from '@/lib/character-history';
import { getHistoryFile } from '@/lib/data-dir';
import { newUid } from '@/lib/ids';
import {
  deleteCharacterFromServer,
  saveCharacterToServer,
  updateCharacterOnServer,
} from '@/lib/server-storage';
import type { Character } from '@/lib/types';

import {
  createUserFolder,
  makeDndCharacter,
  removeDir,
  useTempDataDir,
} from '@tests/support';

const CHARACTER_ID = 'char-1';

let dataDir: string;
let uid: string;

function character(): Character {
  return makeDndCharacter({ id: CHARACTER_ID }) as Character;
}

beforeEach(async () => {
  dataDir = useTempDataDir();
  uid = newUid();
  await createUserFolder(uid, 'history-user', 'History');
  await saveCharacterToServer(uid, character());
});

afterEach(() => {
  removeDir(dataDir);
});

describe('history recording', () => {
  it('создаёт маркер при создании листа', async () => {
    const read = await readHistory(uid, CHARACTER_ID);

    expect(read.revisions).toHaveLength(1);
    expect(read.revisions[0].source).toBe('create');
    expect(read.revisions[0].changes).toEqual([]);
  });

  it('записывает diff успешного PUT', async () => {
    const current = character();
    const stats = current.stats as Record<string, number>;
    await updateCharacterOnServer(uid, CHARACTER_ID, {
      stats: { ...stats, strength: 18 },
    });

    const read = await readHistory(uid, CHARACTER_ID);
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

  it('не пишет ревизию для пустого патча и stale-записи', async () => {
    await updateCharacterOnServer(uid, CHARACTER_ID, {
      name: 'Ragnar Testborn',
    });
    expect((await readHistory(uid, CHARACTER_ID)).revisions).toHaveLength(1);

    await updateCharacterOnServer(
      uid,
      CHARACTER_ID,
      { name: 'Fresh' },
      { writeToken: { page: 'page-1', seq: 2 } },
    );
    const afterFresh = await readHistory(uid, CHARACTER_ID);
    expect(afterFresh.revisions).toHaveLength(2);

    await updateCharacterOnServer(
      uid,
      CHARACTER_ID,
      { name: 'Stale' },
      { writeToken: { page: 'page-1', seq: 1 } },
    );
    const afterStale = await readHistory(uid, CHARACTER_ID);
    expect(afterStale.revisions).toHaveLength(2);
  });

  it('удаляет историю вместе с листом', async () => {
    const file = getHistoryFile(uid, CHARACTER_ID);
    expect(file).not.toBeNull();
    expect(fs.existsSync(file!)).toBe(true);

    expect(await deleteCharacterFromServer(uid, CHARACTER_ID)).toBe(true);
    expect(fs.existsSync(file!)).toBe(false);
    expect((await readHistory(uid, CHARACTER_ID)).revisions).toHaveLength(0);
  });
});
