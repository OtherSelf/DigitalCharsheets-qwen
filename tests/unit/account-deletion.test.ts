import fs from 'node:fs';
import path from 'node:path';

import { afterEach, beforeEach, describe, expect, it } from 'vitest';

import { newUid } from '@/lib/ids';
import {
  authenticateUser,
  deleteUserAccount,
  getStoredUser,
  registerUser,
} from '@/lib/server-auth';
import {
  getCharactersFromServer,
  saveCharacterToServer,
} from '@/lib/server-storage';
import { resolveLogin } from '@/lib/user-index';

import {
  loginIndexPath,
  makeDndCharacter,
  readJson,
  removeDir,
  userPaths,
  useTempDataDir,
} from './helpers';

/**
 * Удаление своего аккаунта (src/lib/server-auth.ts::deleteUserAccount).
 *
 * Главное, что проверяем:
 *   • каталог `users/<uid>` удаляется целиком (профиль + все листы);
 *   • запись в индексе «логин → uid» освобождается;
 *   • без верного пароля не удаляется ничего (повторная аутентификация);
 *   • чужой аккаунт не задет;
 *   • после удаления повторная регистрация под тем же логином даёт новый uid
 *     и пустой список листов — старые данные не «воскресают».
 */

let dataDir: string;

beforeEach(() => {
  dataDir = useTempDataDir();
});

afterEach(() => {
  removeDir(dataDir);
});

function createUser(login: string, password = 'pass1234') {
  const result = registerUser(login, password, login, 'alpha beta gamma');
  expect(result.success).toBe(true);
  return result.user!.uid;
}

describe('deleteUserAccount', () => {
  it('удаляет профиль, все листы и запись в индексе', () => {
    const uid = createUser('deleteme');
    saveCharacterToServer(uid, makeDndCharacter({ userId: uid }));

    const paths = userPaths(dataDir, uid);
    expect(fs.existsSync(paths.userFile)).toBe(true);
    expect(fs.readdirSync(paths.charactersDir)).toHaveLength(1);
    expect(resolveLogin('deleteme')).toBe(uid);

    const result = deleteUserAccount(uid, 'pass1234');

    expect(result.success).toBe(true);
    expect(fs.existsSync(paths.userDir)).toBe(false);
    expect(getStoredUser(uid)).toBeNull();
    expect(resolveLogin('deleteme')).toBeNull();
    expect(readJson(loginIndexPath(dataDir)).logins.deleteme).toBeUndefined();
  });

  it('удаляет аккаунт без персонажей', () => {
    const uid = createUser('empty-account');

    expect(deleteUserAccount(uid, 'pass1234').success).toBe(true);
    expect(fs.existsSync(userPaths(dataDir, uid).userDir)).toBe(false);
  });

  it('не удаляет ничего при неверном пароле', () => {
    const uid = createUser('protected');
    saveCharacterToServer(uid, makeDndCharacter({ userId: uid }));

    const result = deleteUserAccount(uid, 'wrong-password');

    expect(result.success).toBe(false);
    expect(result.reason).toBe('invalid_password');
    expect(fs.existsSync(userPaths(dataDir, uid).userFile)).toBe(true);
    expect(getCharactersFromServer(uid)).toHaveLength(1);
    expect(resolveLogin('protected')).toBe(uid);
    // Вход по-прежнему работает: аккаунт не тронут.
    expect(authenticateUser('protected', 'pass1234').success).toBe(true);
  });

  it('отклоняет пустой пароль, не трогая данные', () => {
    const uid = createUser('empty-pass');

    for (const password of ['', '   ']) {
      const result = deleteUserAccount(uid, password);
      expect(result.success).toBe(false);
      expect(result.reason).toBe('invalid_input');
    }

    expect(fs.existsSync(userPaths(dataDir, uid).userFile)).toBe(true);
    expect(resolveLogin('empty-pass')).toBe(uid);
  });

  it('возвращает not_found для неизвестного и невалидного uid', () => {
    const unknown = newUid();
    const missing = deleteUserAccount(unknown, 'pass1234');
    expect(missing.success).toBe(false);
    expect(missing.reason).toBe('not_found');

    // uid попадает в путь, поэтому не-UUID отвергается до любых rm.
    const traversal = deleteUserAccount('../users', 'pass1234');
    expect(traversal.success).toBe(false);
    expect(traversal.reason).toBe('not_found');
    expect(fs.existsSync(path.join(dataDir, 'users'))).toBe(false);
  });

  it('не задевает другие аккаунты', () => {
    const victim = createUser('shared-device');
    const other = createUser('other-player');
    saveCharacterToServer(victim, makeDndCharacter({ userId: victim }));
    saveCharacterToServer(other, makeDndCharacter({ userId: other }));

    expect(deleteUserAccount(victim, 'pass1234').success).toBe(true);

    expect(fs.existsSync(userPaths(dataDir, victim).userDir)).toBe(false);
    expect(fs.existsSync(userPaths(dataDir, other).userFile)).toBe(true);
    expect(getCharactersFromServer(other)).toHaveLength(1);
    expect(resolveLogin('other-player')).toBe(other);
    expect(authenticateUser('other-player', 'pass1234').success).toBe(true);
  });

  it('после удаления повторная регистрация даёт новый uid и пустой список', () => {
    const oldUid = createUser('reborn');
    saveCharacterToServer(oldUid, makeDndCharacter({ userId: oldUid }));

    expect(deleteUserAccount(oldUid, 'pass1234').success).toBe(true);

    const reborn = registerUser(
      'reborn',
      'new-pass',
      'Reborn',
      'delta epsilon zeta',
    );

    expect(reborn.success).toBe(true);
    expect(reborn.user!.uid).not.toBe(oldUid);
    expect(getCharactersFromServer(reborn.user!.uid)).toHaveLength(0);
    expect(fs.existsSync(userPaths(dataDir, oldUid).userDir)).toBe(false);
  });
});
