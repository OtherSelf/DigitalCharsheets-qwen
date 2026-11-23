import fs from 'node:fs';
import path from 'node:path';

import { afterEach, beforeEach, describe, expect, it } from 'vitest';

import { listGameModules } from '@/games/registry';
import { appendHistory, readHistory } from '@/lib/character-history';
import { newUid } from '@/lib/ids';
import { registerUser } from '@/lib/server-auth';
import {
  getCharacterFromServer,
  getCharactersFromServer,
  saveCharacterToServer,
  updateCharacterOnServer,
} from '@/lib/server-storage';

import {
  makeCharacter,
  removeDir,
  userPaths,
  useTempDataDir,
} from '@tests/support';

/**
 * Гонки в одном процессе. До перевода storage на async импорт и вызовы
 * выполнялись одним синхронным блоком, поэтому `Promise.all` ничего не
 * перемежал; теперь эти тесты действительно ловят потерянные обновления и
 * неатомарный guard.
 */

let dataDir = '';
/** Первая редакция из реестра: тест про storage, а не про конкретную игру. */
const systemId = listGameModules()[0].id;

function makeSheet(id: string, userId: string, name: string) {
  return makeCharacter(systemId, { id, userId, name });
}

beforeEach(() => {
  dataDir = useTempDataDir();
});

afterEach(() => {
  delete process.env.DCS_DATA_DIR;
  removeDir(dataDir);
});

describe('параллельные записи', () => {
  it('разные листы пишутся независимо', async () => {
    const uid = newUid();
    const first = makeSheet('first', uid, 'Первый');
    const second = makeSheet('second', uid, 'Второй');

    await saveCharacterToServer(uid, first);
    await saveCharacterToServer(uid, second);

    await Promise.all([
      updateCharacterOnServer(uid, first.id, { notes: 'a' }),
      updateCharacterOnServer(uid, second.id, { notes: 'b' }),
    ]);

    const stored = await getCharactersFromServer(uid);
    expect(stored.map((character) => character.id).sort()).toEqual([
      first.id,
      second.id,
    ]);
    expect((await getCharacterFromServer(uid, first.id))?.notes).toBe('a');
    expect((await getCharacterFromServer(uid, second.id))?.notes).toBe('b');
  });

  it('20 параллельных PUT одного листа оставляют последний seq', async () => {
    const uid = newUid();
    await saveCharacterToServer(uid, makeSheet('race-sheet', uid, 'Race'));

    await Promise.all(
      Array.from({ length: 20 }, (_, index) =>
        updateCharacterOnServer(
          uid,
          'race-sheet',
          { name: `seq-${index + 1}` },
          { writeToken: { page: 'race', seq: index + 1 } },
        ),
      ),
    );

    const stored = await getCharacterFromServer(uid, 'race-sheet');
    expect(stored?.name).toBe('seq-20');

    const historyFile = path.join(
      userPaths(dataDir, uid).userDir,
      'history',
      'race-sheet.jsonl',
    );
    const lines = fs
      .readFileSync(historyFile, 'utf8')
      .split('\n')
      .filter(Boolean);
    expect(lines.length).toBeGreaterThan(0);
    for (const line of lines) expect(() => JSON.parse(line)).not.toThrow();
  });
});

describe('параллельные аккаунты', () => {
  it('одна регистрация одного логина', async () => {
    const results = await Promise.all(
      Array.from({ length: 8 }, () =>
        registerUser(
          'race-register@example.test',
          'pass-one-1234',
          'Race',
          'alpha beta gamma delta epsilon zeta',
        ),
      ),
    );

    expect(results.filter((result) => result.success)).toHaveLength(1);
    expect(results.filter((result) => result.reason === 'exists')).toHaveLength(
      7,
    );

    const index = JSON.parse(
      fs.readFileSync(path.join(dataDir, 'index', 'logins.json'), 'utf8'),
    );
    expect(Object.keys(index.logins)).toHaveLength(1);
  });
});

describe('журнал под параллельной записью', () => {
  it('все ревизии остаются валидным JSONL', async () => {
    const uid = newUid();
    await Promise.all(
      Array.from({ length: 10 }, (_, index) =>
        appendHistory(uid, 'history-sheet', {
          changes: [
            { kind: 'changed', path: 'notes', before: '', after: `${index}` },
          ],
          summary: { changed: 1, added: 0, removed: 0, bulk: 0 },
        }),
      ),
    );

    const stored = await readHistory(uid, 'history-sheet');
    expect(stored.revisions).toHaveLength(10);
    expect(stored.parseErrors).toBe(0);
  });
});
