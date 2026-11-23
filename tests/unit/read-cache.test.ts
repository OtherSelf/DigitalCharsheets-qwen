import type { Stats } from 'node:fs';
import fs from 'node:fs/promises';
import path from 'node:path';

import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

import { listGameModules } from '@/games/registry';
import { getSessionsFile } from '@/lib/data-dir';
import { writeJsonAtomic } from '@/lib/fs-atomic';
import { newUid } from '@/lib/ids';
import { clearReadCache, readJsonThroughCache } from '@/lib/read-cache';
import {
  createSessionRecord,
  isSessionActive,
  revokeSession,
} from '@/lib/security/sessions';
import {
  getCharacterFromServer,
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
 * Кэш чтения: подпись файла, инвалидация записью и fail-closed. Отдельно —
 * немедленный отзыв сессии после logout: кэш не должен переживать запись.
 */

let dataDir = '';

beforeEach(async () => {
  dataDir = useTempDataDir();
  clearReadCache();
});

afterEach(async () => {
  clearReadCache();
  delete process.env.DCS_DATA_DIR;
  removeDir(dataDir);
});

describe('readThroughCache', () => {
  it('видит запись через writeJsonAtomic', async () => {
    const file = path.join(dataDir, 'cache.json');
    await writeJsonAtomic(file, { value: 1 });
    expect(await readJsonThroughCache<{ value: number }>(file)).toEqual({
      value: 1,
    });

    await writeJsonAtomic(file, { value: 2 });
    expect(await readJsonThroughCache<{ value: number }>(file)).toEqual({
      value: 2,
    });
  });

  it('подхватывает внешнюю правку и битый файл не кэширует как валидный', async () => {
    const file = path.join(dataDir, 'external.json');
    await writeJsonAtomic(file, { value: 'first' });
    await readJsonThroughCache(file);

    await fs.writeFile(file, JSON.stringify({ value: 'second' }), 'utf8');
    expect(await readJsonThroughCache(file)).toEqual({ value: 'second' });

    await fs.writeFile(file, '{ broken', 'utf8');
    expect(await readJsonThroughCache(file)).toBeNull();

    await fs.writeFile(file, JSON.stringify({ value: 'third' }), 'utf8');
    expect(await readJsonThroughCache(file)).toEqual({ value: 'third' });
  });

  it('гонка чтения не кэширует устаревшее значение с новой подписью', async () => {
    const file = path.join(dataDir, 'race.json');
    await fs.writeFile(file, JSON.stringify({ value: 'old' }), 'utf8');

    const statA = { ino: 1, mtimeMs: 1_000, size: 10 } as unknown as Stats;
    const statB = { ino: 2, mtimeMs: 2_000, size: 20 } as unknown as Stats;
    const readSpy = vi
      .spyOn(fs, 'readFile')
      .mockResolvedValueOnce(JSON.stringify({ value: 'old' }));
    const statSpy = vi
      .spyOn(fs, 'stat')
      .mockResolvedValueOnce(statA)
      .mockResolvedValueOnce(statB);

    // Файл изменился между readFile и вторым stat: значение «old» относится
    // к старой подписи и не должно осесть в кэше под подписью statB.
    expect(await readJsonThroughCache(file)).toEqual({ value: 'old' });

    readSpy.mockRestore();
    await fs.writeFile(file, JSON.stringify({ value: 'new' }), 'utf8');
    statSpy.mockResolvedValue(statB);

    expect(await readJsonThroughCache(file)).toEqual({ value: 'new' });
    statSpy.mockRestore();
  });

  it('лист обновляется после сохранения', async () => {
    const uid = newUid();
    const systemId = listGameModules()[0].id;
    const character = makeCharacter(systemId, {
      id: 'cache-sheet',
      userId: uid,
    });
    await saveCharacterToServer(uid, character);

    const first = await getCharacterFromServer(uid, 'cache-sheet');
    expect(first?.id).toBe('cache-sheet');

    await updateCharacterOnServer(uid, 'cache-sheet', { notes: 'после кэша' });
    const second = await getCharacterFromServer(uid, 'cache-sheet');
    expect(second?.notes).toBe('после кэша');
  });
});

describe('сессии и кэш', () => {
  it('logout виден сразу: запись удалена, кэш не отдаёт старую', async () => {
    const uid = newUid();
    const { jti } = await createSessionRecord(uid, { ttlMs: 60_000 });
    expect(await isSessionActive(jti, uid)).toBe(true);

    expect(await revokeSession(jti)).toBe(true);
    expect(await isSessionActive(jti, uid)).toBe(false);
  });

  it('битый sessions.json — fail-closed', async () => {
    const uid = newUid();
    const { jti } = await createSessionRecord(uid, { ttlMs: 60_000 });
    await fs.writeFile(getSessionsFile(), '{ broken', 'utf8');
    expect(await isSessionActive(jti, uid)).toBe(false);
  });

  it('внешняя правка user.json подхватывается', async () => {
    const uid = newUid();
    await fs.mkdir(userPaths(dataDir, uid).userDir, { recursive: true });
    await writeJsonAtomic(userPaths(dataDir, uid).userFile, {
      schemaVersion: 4,
      uid,
      username: 'cache-user',
      displayName: 'Cache',
      passwordHash: '',
      role: 'user',
      isBlocked: false,
    });
    const { readStoredUser } = await import('@/lib/user-schema');
    expect((await readStoredUser(uid))?.displayName).toBe('Cache');

    await fs.writeFile(
      userPaths(dataDir, uid).userFile,
      JSON.stringify({
        schemaVersion: 4,
        uid,
        username: 'cache-user',
        displayName: 'Changed',
        passwordHash: '',
        role: 'user',
        isBlocked: false,
      }),
      'utf8',
    );
    expect((await readStoredUser(uid))?.displayName).toBe('Changed');
  });
});
