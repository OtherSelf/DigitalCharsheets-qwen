import fs from 'node:fs';
import path from 'node:path';

import { afterEach, beforeEach, describe, expect, it } from 'vitest';

import { getAccountTrashDir } from '@/lib/data-dir';
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
  makeCharacter,
  readJson,
  removeDir,
  userPaths,
  useTempDataDir,
} from '@tests/support';

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

async function createUser(login: string, password = 'pass-1234-secure') {
  const result = await registerUser(
    login,
    password,
    login,
    'alpha beta gamma delta epsilon zeta',
  );
  expect(result.success).toBe(true);
  return result.user!.uid;
}

describe('deleteUserAccount', () => {
  it('удаляет профиль, все листы и запись в индексе', async () => {
    const uid = await createUser('deleteme');
    await saveCharacterToServer(uid, makeCharacter('dnd5e', { userId: uid }));

    const paths = userPaths(dataDir, uid);
    expect(fs.existsSync(paths.userFile)).toBe(true);
    expect(fs.readdirSync(paths.charactersDir)).toHaveLength(1);
    expect(await resolveLogin('deleteme')).toBe(uid);

    const result = await deleteUserAccount(uid, 'pass-1234-secure');

    expect(result.success).toBe(true);
    expect(fs.existsSync(paths.userDir)).toBe(false);
    // Каталог не потерян: он перемещён в теневую копию и будет очищен
    // стартовым обслуживанием после срока.
    expect(fs.readdirSync(getAccountTrashDir())).toHaveLength(1);
    expect(await getStoredUser(uid)).toBeNull();
    expect(await resolveLogin('deleteme')).toBeNull();
    expect(readJson(loginIndexPath(dataDir)).logins.deleteme).toBeUndefined();
  });

  it('удаляет аккаунт без персонажей', async () => {
    const uid = await createUser('empty-account');

    expect((await deleteUserAccount(uid, 'pass-1234-secure')).success).toBe(
      true,
    );
    expect(fs.existsSync(userPaths(dataDir, uid).userDir)).toBe(false);
  });

  it('не удаляет ничего при неверном пароле', async () => {
    const uid = await createUser('protected');
    await saveCharacterToServer(uid, makeCharacter('dnd5e', { userId: uid }));

    const result = await deleteUserAccount(uid, 'wrong-password');

    expect(result.success).toBe(false);
    expect(result.reason).toBe('invalid_password');
    expect(fs.existsSync(userPaths(dataDir, uid).userFile)).toBe(true);
    expect(await getCharactersFromServer(uid)).toHaveLength(1);
    expect(await resolveLogin('protected')).toBe(uid);
    // Вход по-прежнему работает: аккаунт не тронут.
    expect(
      (await authenticateUser('protected', 'pass-1234-secure')).success,
    ).toBe(true);
  });

  it('отклоняет пустой пароль, не трогая данные', async () => {
    const uid = await createUser('empty-pass');

    for (const password of ['', '   ']) {
      const result = await deleteUserAccount(uid, password);
      expect(result.success).toBe(false);
      expect(result.reason).toBe('invalid_input');
    }

    expect(fs.existsSync(userPaths(dataDir, uid).userFile)).toBe(true);
    expect(await resolveLogin('empty-pass')).toBe(uid);
  });

  it('возвращает not_found для неизвестного и невалидного uid', async () => {
    const unknown = newUid();
    const missing = await deleteUserAccount(unknown, 'pass-1234-secure');
    expect(missing.success).toBe(false);
    expect(missing.reason).toBe('not_found');

    // uid попадает в путь, поэтому не-UUID отвергается до любых rm.
    const traversal = await deleteUserAccount('../users', 'pass-1234-secure');
    expect(traversal.success).toBe(false);
    expect(traversal.reason).toBe('not_found');
    expect(fs.existsSync(path.join(dataDir, 'users'))).toBe(false);
  });

  it('не задевает другие аккаунты', async () => {
    const victim = await createUser('shared-device');
    const other = await createUser('other-player');
    await saveCharacterToServer(
      victim,
      makeCharacter('dnd5e', { userId: victim }),
    );
    await saveCharacterToServer(
      other,
      makeCharacter('dnd5e', { userId: other }),
    );

    expect((await deleteUserAccount(victim, 'pass-1234-secure')).success).toBe(
      true,
    );

    expect(fs.existsSync(userPaths(dataDir, victim).userDir)).toBe(false);
    expect(fs.existsSync(userPaths(dataDir, other).userFile)).toBe(true);
    expect(await getCharactersFromServer(other)).toHaveLength(1);
    expect(await resolveLogin('other-player')).toBe(other);
    expect(
      (await authenticateUser('other-player', 'pass-1234-secure')).success,
    ).toBe(true);
  });

  it('после удаления повторная регистрация даёт новый uid и пустой список', async () => {
    const oldUid = await createUser('reborn');
    await saveCharacterToServer(
      oldUid,
      makeCharacter('dnd5e', { userId: oldUid }),
    );

    expect((await deleteUserAccount(oldUid, 'pass-1234-secure')).success).toBe(
      true,
    );

    const reborn = await registerUser(
      'reborn',
      'new-pass-1234',
      'Reborn',
      'delta epsilon zeta eta theta iota',
    );

    expect(reborn.success).toBe(true);
    expect(reborn.user!.uid).not.toBe(oldUid);
    expect(await getCharactersFromServer(reborn.user!.uid)).toHaveLength(0);
    expect(fs.existsSync(userPaths(dataDir, oldUid).userDir)).toBe(false);
  });
});
