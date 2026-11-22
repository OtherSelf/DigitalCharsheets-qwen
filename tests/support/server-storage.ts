/**
 * Фабрики файлового хранилища для тестов: каталог пользователя и пачка листов.
 *
 * Продакшн-код эти функции не вызывает — листы пишутся роутами через
 * `saveCharacterToServer`. Тестам же нужен файловый макет без HTTP, поэтому
 * хелперы живут здесь: прод-модуль `src/lib/server-storage.ts` не должен
 * держать экспорты «только для тестов».
 */

import fs from 'node:fs/promises';

import { getUserDir, getUserFile } from '@/lib/data-dir';
import { writeJsonAtomic } from '@/lib/fs-atomic';
import { saveCharacterToServer } from '@/lib/server-storage';
import type { Character } from '@/lib/types';
import { USER_SCHEMA_VERSION } from '@/lib/user-schema';

/**
 * Создать каталог и минимальный `user.json`, если профиля ещё нет.
 *
 * Версия схемы берётся из `USER_SCHEMA_VERSION`: фикстура не должна
 * изображать устаревший профиль, иначе тест проверяет не тот формат.
 */
export async function createUserFolder(
  userId: string,
  username: string,
  displayName: string,
): Promise<void> {
  await fs.mkdir(getUserDir(userId), { recursive: true });
  const userFile = getUserFile(userId);

  try {
    await fs.stat(userFile);
    return;
  } catch {
    /* профиля ещё нет — создаём */
  }

  const userData = {
    schemaVersion: USER_SCHEMA_VERSION,
    uid: userId,
    username,
    displayName,
    passwordHash: '',
    role: 'user',
    isBlocked: false,
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString(),
  };
  await writeJsonAtomic(userFile, userData);
}

/** Есть ли у пользователя каталог (профиль или хотя бы черновик). */
export async function userFolderExists(userId: string): Promise<boolean> {
  try {
    const stat = await fs.stat(getUserDir(userId));
    return stat.isDirectory();
  } catch {
    return false;
  }
}

/** Записать пачку листов: по файлу на лист, как это делает импорт. */
export async function saveCharactersToServer(
  userId: string,
  characters: Character[],
): Promise<void> {
  for (const character of characters) {
    await saveCharacterToServer(userId, character);
  }
}
