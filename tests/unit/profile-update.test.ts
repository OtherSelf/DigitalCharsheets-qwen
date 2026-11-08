import crypto from 'node:crypto';
import fs from 'node:fs';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';

import {
  authenticateUser,
  generateUserId,
  getStoredUser,
  updateUserProfile,
} from '@/lib/server-auth';
import { saveCharacterToServer } from '@/lib/server-storage';
import {
  makeDndCharacter,
  readJson,
  removeDir,
  useTempDataDir,
  userPaths,
} from './helpers';

/**
 * Обновление профиля (src/lib/server-auth.ts::updateUserProfile).
 *
 * Покрыто: смена displayName без потери пароля; смена логина с переносом
 * каталога персонажей; отказ при занятом логине; смена пароля;
 * установка/сброс recovery-фразы; ошибка для несуществующего пользователя.
 */

let dataDir: string;

beforeEach(() => {
  dataDir = useTempDataDir();
});

afterEach(() => {
  removeDir(dataDir);
});

const sha256 = (value: string) =>
  crypto.createHash('sha256').update(value).digest('hex');

describe('updateUserProfile', () => {
  it('меняет displayName, сохраняя пароль и персонажей', () => {
    const uid = generateUserId('hero');
    authenticateUser('hero', 'pass1234', 'Old Name');
    saveCharacterToServer(uid, makeDndCharacter({ userId: uid }));

    const result = updateUserProfile(uid, 'hero', '  New Name  ');

    expect(result.success).toBe(true);
    expect(result.user?.uid).toBe(uid);
    expect(result.user?.displayName).toBe('New Name');

    const paths = userPaths(dataDir, uid);
    const stored = readJson(paths.userFile);
    expect(stored.displayName).toBe('New Name');
    expect(stored.passwordHash).toBe(sha256('pass1234'));
    expect(fs.existsSync(paths.charactersDir)).toBe(true);
  });

  it('при смене логина переносит каталог вместе с персонажами', () => {
    const oldUid = generateUserId('oldlogin');
    authenticateUser('oldlogin', 'pass1234', 'Hero');
    saveCharacterToServer(oldUid, makeDndCharacter({ userId: oldUid }));

    const newUid = generateUserId('newlogin');
    const result = updateUserProfile(oldUid, 'newlogin', 'Hero');

    expect(result.success).toBe(true);
    expect(result.user?.uid).toBe(newUid);

    const oldPaths = userPaths(dataDir, oldUid);
    const newPaths = userPaths(dataDir, newUid);

    expect(fs.existsSync(oldPaths.userDir)).toBe(false);
    expect(readJson(newPaths.userFile).username).toBe('newlogin');
    expect(fs.existsSync(newPaths.charactersDir)).toBe(true);

    // Старый логин освобождается: вход под ним создаёт НОВЫЙ пустой аккаунт,
    // а не открывает перенесённый.
    const oldLogin = authenticateUser('oldlogin', 'pass1234');
    expect(oldLogin.isNewUser).toBe(true);
    expect(oldLogin.user?.uid).not.toBe(newUid);

    const relogin = authenticateUser('newlogin', 'pass1234');
    expect(relogin.success).toBe(true);
    expect(relogin.isNewUser).toBe(false);
    expect(relogin.user?.uid).toBe(newUid);
  });

  it('отказывает, если новый логин уже занят, и не трогает данные', () => {
    const first = generateUserId('first');
    const second = generateUserId('second');
    authenticateUser('first', 'pass1');
    authenticateUser('second', 'pass2');
    saveCharacterToServer(first, makeDndCharacter({ userId: first }));

    const result = updateUserProfile(first, 'second', 'First');

    expect(result.success).toBe(false);
    expect(result.error).toMatch(/already taken/i);

    // Исходный аккаунт цел, персонажи на месте.
    const paths = userPaths(dataDir, first);
    expect(readJson(paths.userFile).username).toBe('first');
    expect(fs.existsSync(paths.charactersDir)).toBe(true);
    // Второй аккаунт не перезаписан.
    expect(getStoredUser(second)?.username).toBe('second');
  });

  it('меняет пароль: старый перестаёт работать, новый — работает', () => {
    const uid = generateUserId('pwuser');
    authenticateUser('pwuser', 'oldpass');

    const result = updateUserProfile(uid, 'pwuser', 'pwuser', 'newpass');

    expect(result.success).toBe(true);
    expect(authenticateUser('pwuser', 'oldpass').success).toBe(false);
    expect(authenticateUser('pwuser', 'newpass').success).toBe(true);
    expect(readJson(userPaths(dataDir, uid).userFile).passwordHash).toBe(
      sha256('newpass'),
    );
  });

  it('пустой пароль не меняет хеш', () => {
    const uid = generateUserId('keep');
    authenticateUser('keep', 'pass1');

    updateUserProfile(uid, 'keep', 'keep', '   ');

    expect(readJson(userPaths(dataDir, uid).userFile).passwordHash).toBe(
      sha256('pass1'),
    );
  });

  it('устанавливает recovery-фразу', () => {
    const uid = generateUserId('recovery');
    authenticateUser('recovery', 'pass1');

    const result = updateUserProfile(
      uid,
      'recovery',
      'recovery',
      undefined,
      '  Альфа Бета Гамма  ',
    );

    expect(result.success).toBe(true);
    expect(result.user?.hasRecoveryPhrase).toBe(true);
    // Фраза нормализуется: нижний регистр и обрезка пробелов.
    expect(readJson(userPaths(dataDir, uid).userFile).recoveryPhrase).toBe(
      'альфа бета гамма',
    );
  });

  it('undefined сохраняет recovery-фразу, пустая строка — сбрасывает', () => {
    const uid = generateUserId('phrase');
    authenticateUser('phrase', 'pass1');
    updateUserProfile(uid, 'phrase', 'phrase', undefined, 'one two three');

    updateUserProfile(uid, 'phrase', 'phrase');
    expect(readJson(userPaths(dataDir, uid).userFile).recoveryPhrase).toBe(
      'one two three',
    );

    const cleared = updateUserProfile(uid, 'phrase', 'phrase', undefined, '  ');
    expect(cleared.user?.hasRecoveryPhrase).toBe(false);
    expect(
      readJson(userPaths(dataDir, uid).userFile).recoveryPhrase,
    ).toBeUndefined();
  });

  it('возвращает ошибку для несуществующего пользователя', () => {
    const result = updateUserProfile('user-doesnotexist', 'x', 'X');

    expect(result.success).toBe(false);
    expect(result.error).toMatch(/not found/i);
  });
});
