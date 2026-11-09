import fs from 'node:fs';
import path from 'node:path';

import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

import {
  resetWriteSeqGuard,
  saveCharacterToServer,
  updateCharacterOnServer,
} from '@/lib/server-storage';

import {
  makeDndCharacter,
  readJson,
  removeDir,
  userPaths,
  useTempDataDir,
} from './helpers';

/**
 * Фолбэк на EXDEV в writeJsonAtomic (src/lib/server-storage.ts).
 *
 * Ветка почти недостижима естественным путём: tmp лежит рядом с целевым файлом,
 * а такой rename EXDEV не даёт. Она нужна для FUSE/сетевых ФС, поэтому ошибка
 * инжектится в fs.renameSync — иначе ветка не выполнялась бы ни на одной машине.
 */

const uid = 'user-exdev';
let dataDir: string;

const exdev = () =>
  Object.assign(new Error('EXDEV: cross-device link not permitted'), {
    code: 'EXDEV',
  });

beforeEach(() => {
  dataDir = useTempDataDir();
  resetWriteSeqGuard();
});

afterEach(() => {
  vi.restoreAllMocks();
  removeDir(dataDir);
  resetWriteSeqGuard();
});

describe('writeJsonAtomic: фолбэк при EXDEV', () => {
  it('правка не теряется: данные записаны валидным JSON, .tmp удалён', () => {
    saveCharacterToServer(
      uid,
      makeDndCharacter({ id: 'exdev-ok', userId: uid, name: 'Before' }),
    );
    const charsDir = userPaths(dataDir, uid).charactersDir;

    const renameSpy = vi.spyOn(fs, 'renameSync').mockImplementation(() => {
      throw exdev();
    });

    let updated: { name?: string } | null = null;
    try {
      // Ошибка EXDEV не должна доходить до клиента: она штатно обрабатывается.
      updated = updateCharacterOnServer(uid, 'exdev-ok', { name: 'After' });
    } finally {
      renameSpy.mockRestore();
    }

    expect(updated?.name).toBe('After');
    // Главное: на диске именно новое значение, а не «Before» (тихая потеря).
    expect(readJson(path.join(charsDir, 'exdev-ok.json')).name).toBe('After');
    // И никаких .tmp-огрызков рядом.
    expect(fs.readdirSync(charsDir)).toEqual(['exdev-ok.json']);
  });

  it('EXDEV + отказ прямой записи: ошибка наружу, оригинал цел, .tmp убран', () => {
    saveCharacterToServer(
      uid,
      makeDndCharacter({ id: 'exdev-fail', userId: uid, name: 'Before' }),
    );
    const charsDir = userPaths(dataDir, uid).charactersDir;
    const filePath = path.join(charsDir, 'exdev-fail.json');

    const renameSpy = vi.spyOn(fs, 'renameSync').mockImplementation(() => {
      throw exdev();
    });
    // Временный файл пишется через дескриптор, а прямая запись — по пути:
    // роняем только её, иначе до EXDEV-ветки дело не дойдёт.
    const originalWrite = fs.writeFileSync.bind(fs);
    const writeSpy = vi.spyOn(fs, 'writeFileSync').mockImplementation(((
      target: unknown,
      ...rest: unknown[]
    ) => {
      if (typeof target === 'string' && !target.endsWith('.tmp')) {
        throw Object.assign(new Error('ENOSPC: no space left on device'), {
          code: 'ENOSPC',
        });
      }
      return (originalWrite as (...args: unknown[]) => unknown)(
        target,
        ...rest,
      );
    }) as typeof fs.writeFileSync);

    try {
      expect(() =>
        updateCharacterOnServer(uid, 'exdev-fail', { name: 'After' }),
      ).toThrow(/ENOSPC/);
    } finally {
      writeSpy.mockRestore();
      renameSpy.mockRestore();
    }

    // Оригинал не тронут и не обрезан, временный файл убран.
    expect(readJson(filePath).name).toBe('Before');
    expect(fs.readdirSync(charsDir)).toEqual(['exdev-fail.json']);
  });
});
