import fs from 'node:fs';
import path from 'node:path';

import { afterEach, beforeEach, describe, expect, it } from 'vitest';

import { listGameModules } from '@/games/registry';
import { appendHistory, readHistory } from '@/lib/character-history';
import { writeJsonAtomic } from '@/lib/fs-atomic';
import { newUid } from '@/lib/ids';
import {
  getCharacterFromServer,
  saveCharacterToServer,
} from '@/lib/server-storage';

import {
  makeCharacter,
  removeDir,
  userPaths,
  useTempDataDir,
} from '@tests/support';

/**
 * Компактный JSON на диске и кэш истории: схема не меняется, старые
 * pretty-файлы читаются, повторное чтение журнала видит новые ревизии.
 */

let dataDir = '';

beforeEach(() => {
  dataDir = useTempDataDir();
});

afterEach(() => {
  removeDir(dataDir);
  delete process.env.DCS_DATA_DIR;
});

describe('формат файлов', () => {
  it('writeJsonAtomic пишет компактный JSON без переводов строк', async () => {
    const file = path.join(dataDir, 'compact.json');
    await writeJsonAtomic(file, { a: 1, b: ['x', 'y'], nested: { ok: true } });

    const raw = fs.readFileSync(file, 'utf8');
    expect(raw).not.toContain('\n');
    expect(JSON.parse(raw)).toEqual({
      a: 1,
      b: ['x', 'y'],
      nested: { ok: true },
    });
  });

  it('старый pretty-файл листа читается', async () => {
    const uid = newUid();
    const dir = userPaths(dataDir, uid).charactersDir;
    fs.mkdirSync(dir, { recursive: true });
    const character = makeCharacter(listGameModules()[0].id, {
      id: 'pretty',
      userId: uid,
    });
    fs.writeFileSync(
      path.join(dir, 'pretty.json'),
      `${JSON.stringify(character, null, 2)}\n`,
      'utf8',
    );

    const loaded = await getCharacterFromServer(uid, 'pretty');
    expect(loaded?.id).toBe('pretty');
  });
});

describe('кэш истории', () => {
  it('после appendHistory чтение видит новую ревизию', async () => {
    const uid = newUid();
    await appendHistory(uid, 'history-cache', {
      changes: [{ kind: 'changed', path: 'notes', before: '', after: 'a' }],
      summary: { changed: 1, added: 0, removed: 0, bulk: 0 },
    });
    expect((await readHistory(uid, 'history-cache')).revisions).toHaveLength(1);

    await appendHistory(uid, 'history-cache', {
      changes: [{ kind: 'changed', path: 'notes', before: 'a', after: 'b' }],
      summary: { changed: 1, added: 0, removed: 0, bulk: 0 },
    });
    expect((await readHistory(uid, 'history-cache')).revisions).toHaveLength(2);
  });

  it('saveCharacterToServer и update не оставляют старый кэш', async () => {
    const uid = newUid();
    await saveCharacterToServer(
      uid,
      makeCharacter(listGameModules()[0].id, {
        id: 'cache-char',
        userId: uid,
        notes: 'before',
      }),
    );
    expect((await getCharacterFromServer(uid, 'cache-char'))?.notes).toBe(
      'before',
    );
  });
});
