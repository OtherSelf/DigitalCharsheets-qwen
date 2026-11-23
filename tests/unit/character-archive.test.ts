import fs from 'node:fs';

import { afterEach, beforeEach, describe, expect, it } from 'vitest';

import {
  getAccountTrashDir,
  getArchiveDir,
  getTrashDir,
  getTrashFile,
  getTrashMetaFile,
} from '@/lib/data-dir';
import { newUid } from '@/lib/ids';
import {
  archiveCharacterFromServer,
  clearArchive,
  getCharacterFromServer,
  listArchivedCharacters,
  listTrashedCharacters,
  purgeTrash,
  purgeTrashEntry,
  restoreCharacterFromTrash,
  saveCharacterToServer,
  trashCharacterFromServer,
  unarchiveCharacterFromServer,
} from '@/lib/server-storage';
import {
  cleanupExpiredTrash,
  moveAccountToTrash,
  TRASH_RETENTION_DAYS,
} from '@/lib/trash';

import {
  makeCharacter,
  pluginIds,
  removeDir,
  userPaths,
  useTempDataDir,
} from '@tests/support';

/**
 * Архив и корзина листов: перемещение между каталогами, восстановление,
 * окончательная очистка и автоочистка по сроку. Тесты работают только во
 * временном data-dir и не трогают реальные данные.
 */
let dataDir: string;

const RETENTION_MS = TRASH_RETENTION_DAYS * 24 * 60 * 60 * 1000;

beforeEach(() => {
  dataDir = useTempDataDir();
});

afterEach(() => {
  removeDir(dataDir);
});

async function seedCharacter(name = 'Archivable') {
  const uid = newUid();
  const character = makeCharacter(pluginIds()[0], {
    id: 'archive-test-1',
    userId: uid,
    name,
  });
  await saveCharacterToServer(uid, character);
  return { uid, characterId: character.id as string };
}

describe('архив персонажа', () => {
  it('переносит лист в archive и возвращает обратно', async () => {
    const { uid, characterId } = await seedCharacter();

    const archived = await archiveCharacterFromServer(uid, characterId);

    expect(archived?.name).toBe('Archivable');
    expect(await getCharacterFromServer(uid, characterId)).toBeNull();
    expect(fs.existsSync(getArchiveDir(uid))).toBe(true);
    expect(await listArchivedCharacters(uid)).toHaveLength(1);

    const restored = await unarchiveCharacterFromServer(uid, characterId);

    expect(restored?.name).toBe('Archivable');
    expect(await getCharacterFromServer(uid, characterId)).not.toBeNull();
    expect(await listArchivedCharacters(uid)).toHaveLength(0);
  });

  it('повторное архивирование идемпотентно', async () => {
    const { uid, characterId } = await seedCharacter();

    await archiveCharacterFromServer(uid, characterId);
    const again = await archiveCharacterFromServer(uid, characterId);

    expect(again?.name).toBe('Archivable');
    expect(await listArchivedCharacters(uid)).toHaveLength(1);
  });

  it('очистка архива удаляет файл, историю и архивный каталог', async () => {
    const { uid, characterId } = await seedCharacter();
    await archiveCharacterFromServer(uid, characterId);

    expect(await clearArchive(uid)).toBe(1);
    expect(await listArchivedCharacters(uid)).toHaveLength(0);
    expect(fs.existsSync(getArchiveDir(uid))).toBe(true);
  });
});

describe('корзина персонажа', () => {
  it('переносит лист в trash, показывает срок и восстанавливает', async () => {
    const { uid, characterId } = await seedCharacter();

    const trashed = await trashCharacterFromServer(uid, characterId);

    expect(trashed?.name).toBe('Archivable');
    expect(trashed?.deletedAt).toBeTruthy();
    expect(trashed?.expiresAt).toBeTruthy();
    expect(await getCharacterFromServer(uid, characterId)).toBeNull();
    expect(fs.existsSync(getTrashFile(uid, characterId)!)).toBe(true);
    expect(fs.existsSync(getTrashMetaFile(uid, characterId)!)).toBe(true);
    expect(await listTrashedCharacters(uid)).toHaveLength(1);

    const restored = await restoreCharacterFromTrash(uid, characterId);

    expect(restored?.name).toBe('Archivable');
    expect(await getCharacterFromServer(uid, characterId)).not.toBeNull();
    expect(await listTrashedCharacters(uid)).toHaveLength(0);
    expect(fs.existsSync(getTrashMetaFile(uid, characterId)!)).toBe(false);
  });

  it('повторное удаление не создаёт вторую запись', async () => {
    const { uid, characterId } = await seedCharacter();
    await trashCharacterFromServer(uid, characterId);

    const again = await trashCharacterFromServer(uid, characterId);

    expect(again?.name).toBe('Archivable');
    expect(await listTrashedCharacters(uid)).toHaveLength(1);
  });

  it('просроченная запись не восстанавливается, окончательная очистка удаляет всё', async () => {
    const { uid, characterId } = await seedCharacter();
    await trashCharacterFromServer(
      uid,
      characterId,
      Date.now() - RETENTION_MS - 1000,
    );

    expect(await restoreCharacterFromTrash(uid, characterId)).toBeNull();
    expect(fs.existsSync(getTrashFile(uid, characterId)!)).toBe(false);
    expect(fs.existsSync(getTrashMetaFile(uid, characterId)!)).toBe(false);
  });

  it('очистка корзины удаляет файлы и возвращает счётчик', async () => {
    const { uid, characterId } = await seedCharacter();
    await trashCharacterFromServer(uid, characterId);

    expect(await purgeTrash(uid)).toBe(1);
    expect(await listTrashedCharacters(uid)).toHaveLength(0);
    expect(fs.existsSync(getTrashDir(uid))).toBe(true);
  });

  it('purgeTrashEntry удаляет один лист', async () => {
    const { uid, characterId } = await seedCharacter();
    await trashCharacterFromServer(uid, characterId);

    expect(await purgeTrashEntry(uid, characterId)).toBe(true);
    expect(await purgeTrashEntry(uid, characterId)).toBe(false);
  });
});

describe('автоочистка корзины', () => {
  it('удаляет лист после expiresAt и не трогает свежие записи', async () => {
    // id в разных каталогах может совпадать: у каждого свой uid.
    const first = await seedCharacter('Old');
    const second = await seedCharacter('Fresh');

    await trashCharacterFromServer(
      first.uid,
      first.characterId,
      Date.now() - RETENTION_MS - 1000,
    );
    await trashCharacterFromServer(second.uid, second.characterId);

    const report = await cleanupExpiredTrash({ force: true });

    expect(report.characters).toBe(1);
    expect(report.errors).toEqual([]);
    expect(await listTrashedCharacters(first.uid)).toHaveLength(0);
    expect(await listTrashedCharacters(second.uid)).toHaveLength(1);
  });

  it('удаляет теневую копию аккаунта после срока', async () => {
    const uid = newUid();
    await saveCharacterToServer(
      uid,
      makeCharacter(pluginIds()[0], { id: 'account-trash-1', userId: uid }),
    );

    const moved = await moveAccountToTrash(uid);
    expect(moved).not.toBeNull();
    expect(fs.existsSync(userPaths(dataDir, uid).userDir)).toBe(false);
    expect(fs.readdirSync(getAccountTrashDir())).toHaveLength(1);

    const report = await cleanupExpiredTrash({
      force: true,
      now: Date.now() + RETENTION_MS + 1000,
    });

    expect(report.accounts).toBe(1);
    expect(fs.readdirSync(getAccountTrashDir())).toHaveLength(0);
  });
});
