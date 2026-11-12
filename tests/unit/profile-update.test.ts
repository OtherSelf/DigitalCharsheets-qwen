import crypto from 'node:crypto';
import fs from 'node:fs';

import { afterEach, beforeEach, describe, expect, it } from 'vitest';

import { newUid } from '@/lib/ids';
import { verifyPassword } from '@/lib/security/password';
import {
  isRecoveryPhraseHash,
  recoveryPhraseMatches,
} from '@/lib/security/phrase';
import { isScryptHash } from '@/lib/security/scrypt';
import {
  authenticateUser,
  getStoredUser,
  updateUserProfile,
} from '@/lib/server-auth';
import { saveCharacterToServer } from '@/lib/server-storage';
import { resolveLogin } from '@/lib/user-index';

import {
  makeDndCharacter,
  readJson,
  removeDir,
  userPaths,
  useTempDataDir,
} from './helpers';

/**
 * Обновление профиля (src/lib/server-auth.ts::updateUserProfile).
 *
 * Главное отличие схемы v2: смена логина НЕ переносит каталог. uid и каталог
 * с листами остаются прежними, меняются только `username` в user.json и
 * запись в индексе «логин → uid».
 *
 * Покрыто: смена displayName без потери пароля; смена логина без переноса
 * данных; освобождение старого логина; отказ при занятом логине; смена
 * пароля; установка/сброс recovery-фразы; ошибка для несуществующего uid.
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
  it('меняет displayName, сохраняя uid, пароль и персонажей', () => {
    const uid = authenticateUser('hero', 'pass-1234-secure', 'Old Name').user!
      .uid;
    saveCharacterToServer(uid, makeDndCharacter({ userId: uid }));

    const result = updateUserProfile(uid, 'hero', '  New Name  ');

    expect(result.success).toBe(true);
    expect(result.user?.uid).toBe(uid);
    expect(result.user?.displayName).toBe('New Name');

    const paths = userPaths(dataDir, uid);
    const stored = readJson(paths.userFile);
    expect(stored.displayName).toBe('New Name');
    // Хэш не перегенерируется и не подменяется: пароль тот же.
    expect(verifyPassword(stored.passwordHash, 'pass-1234-secure').valid).toBe(
      true,
    );
    expect(fs.existsSync(paths.charactersDir)).toBe(true);
  });

  it('при смене логина uid и каталог НЕ меняются, листы остаются на месте', () => {
    const uid = authenticateUser('oldlogin', 'pass-1234-secure', 'Hero').user!
      .uid;
    saveCharacterToServer(uid, makeDndCharacter({ userId: uid }));

    const result = updateUserProfile(uid, 'newlogin', 'Hero');

    expect(result.success).toBe(true);
    expect(result.user?.uid).toBe(uid);

    // Каталог тот же: ни переноса, ни копирования.
    const paths = userPaths(dataDir, uid);
    expect(fs.existsSync(paths.userFile)).toBe(true);
    expect(readJson(paths.userFile).username).toBe('newlogin');
    expect(fs.existsSync(paths.charactersDir)).toBe(true);
    expect(fs.readdirSync(paths.charactersDir)).toHaveLength(1);

    // Индекс обновился: старый логин свободен, новый указывает на тот же uid.
    expect(resolveLogin('newlogin')).toBe(uid);
    expect(resolveLogin('oldlogin')).toBeNull();

    // Старый логин освобождается: вход под ним создаёт НОВЫЙ пустой аккаунт,
    // а не открывает существующий.
    const oldLogin = authenticateUser('oldlogin', 'pass-1234-secure');
    expect(oldLogin.isNewUser).toBe(true);
    expect(oldLogin.user?.uid).not.toBe(uid);

    // Вход под новым логином ведёт в тот же аккаунт.
    const relogin = authenticateUser('newlogin', 'pass-1234-secure');
    expect(relogin.success).toBe(true);
    expect(relogin.isNewUser).toBe(false);
    expect(relogin.user?.uid).toBe(uid);
  });

  it('при смене только регистра логина каталог и индекс не переписываются зря', () => {
    const uid = authenticateUser('hero', 'pass-1234-secure').user!.uid;
    const result = updateUserProfile(uid, '  HERO ', 'hero');

    expect(result.success).toBe(true);
    expect(result.user?.uid).toBe(uid);
    expect(readJson(userPaths(dataDir, uid).userFile).username).toBe('hero');
    expect(resolveLogin('hero')).toBe(uid);
  });

  it('отказывает, если новый логин уже занят, и не трогает данные', () => {
    const first = authenticateUser('first', 'pass-one-1234').user!.uid;
    const second = authenticateUser('second', 'pass-two-1234').user!.uid;
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
    expect(resolveLogin('second')).toBe(second);
  });

  it('меняет пароль: старый перестаёт работать, новый — работает', () => {
    const uid = authenticateUser('pwuser', 'old-pass-1234').user!.uid;

    // Смена пароля требует текущий пароль (повторная аутентификация).
    const withoutCurrent = updateUserProfile(
      uid,
      'pwuser',
      'pwuser',
      'new-pass-1234',
    );
    expect(withoutCurrent.success).toBe(false);
    expect(withoutCurrent.reason).toBe('invalid_password');
    expect(authenticateUser('pwuser', 'old-pass-1234').success).toBe(true);

    const wrongCurrent = updateUserProfile(
      uid,
      'pwuser',
      'pwuser',
      'new-pass-1234',
      undefined,
      { currentPassword: 'not-my-pass-1234' },
    );
    expect(wrongCurrent.success).toBe(false);
    expect(wrongCurrent.reason).toBe('invalid_password');

    const result = updateUserProfile(
      uid,
      'pwuser',
      'pwuser',
      'new-pass-1234',
      undefined,
      { currentPassword: 'old-pass-1234' },
    );

    expect(result.success).toBe(true);
    expect(authenticateUser('pwuser', 'old-pass-1234').success).toBe(false);
    expect(authenticateUser('pwuser', 'new-pass-1234').success).toBe(true);
    const rotated = readJson(userPaths(dataDir, uid).userFile).passwordHash;
    expect(isScryptHash(rotated)).toBe(true);
    expect(verifyPassword(rotated, 'new-pass-1234').valid).toBe(true);
  });

  it('пустой пароль не меняет хеш', () => {
    const uid = authenticateUser('keep', 'pass-one-1234').user!.uid;

    const before = readJson(userPaths(dataDir, uid).userFile).passwordHash;
    updateUserProfile(uid, 'keep', 'keep', '   ');

    // Пустой пароль не трогает хэш: значение и проверка те же.
    const stored = readJson(userPaths(dataDir, uid).userFile);
    expect(stored.passwordHash).toBe(before);
    expect(verifyPassword(stored.passwordHash, 'pass-one-1234').valid).toBe(
      true,
    );
  });

  it('устанавливает recovery-фразу', () => {
    const uid = authenticateUser('recovery', 'pass-one-1234').user!.uid;

    const result = updateUserProfile(
      uid,
      'recovery',
      'recovery',
      undefined,
      '  Альфа Бета Гамма  ',
    );

    expect(result.success).toBe(true);
    expect(result.user?.hasRecoveryPhrase).toBe(true);
    // Фраза нормализуется (регистр/пробелы), но на диск уходит только хэш.
    const stored = readJson(userPaths(dataDir, uid).userFile).recoveryPhrase;
    expect(isRecoveryPhraseHash(stored)).toBe(true);
    expect(stored).not.toContain('альфа');
    expect(recoveryPhraseMatches(stored, 'альфа бета гамма')).toBe(true);
  });

  it('undefined сохраняет recovery-фразу, пустая строка — сбрасывает', () => {
    const uid = authenticateUser('phrase', 'pass-one-1234').user!.uid;
    updateUserProfile(uid, 'phrase', 'phrase', undefined, 'one two three');

    const keptBefore = readJson(
      userPaths(dataDir, uid).userFile,
    ).recoveryPhrase;
    updateUserProfile(uid, 'phrase', 'phrase');
    // Значение не перегенерируется: хэш тот же, фраза та же.
    expect(readJson(userPaths(dataDir, uid).userFile).recoveryPhrase).toBe(
      keptBefore,
    );
    expect(recoveryPhraseMatches(keptBefore, 'one two three')).toBe(true);

    const cleared = updateUserProfile(uid, 'phrase', 'phrase', undefined, '  ');
    expect(cleared.user?.hasRecoveryPhrase).toBe(false);
    expect(
      readJson(userPaths(dataDir, uid).userFile).recoveryPhrase,
    ).toBeUndefined();
  });

  it('возвращает ошибку для несуществующего пользователя', () => {
    const result = updateUserProfile(newUid(), 'x', 'X');

    expect(result.success).toBe(false);
    expect(result.error).toMatch(/not found/i);
  });
});
