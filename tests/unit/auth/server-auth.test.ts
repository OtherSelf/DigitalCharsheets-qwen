/**
 * normalizeLogin и uid, вход по паролю, accountExists/registerUser: uid не
 * меняется при повторном входе, формат user.json и индекс логинов.
 */

import fs from 'node:fs';
import path from 'node:path';

import { afterEach, beforeEach, describe, expect, it } from 'vitest';

import { isUid, newUid, normalizeLogin } from '@/lib/ids';
import { verifyPassword } from '@/lib/security/password';
import {
  isRecoveryPhraseHash,
  recoveryPhraseMatches,
} from '@/lib/security/phrase';
import { isScryptHash } from '@/lib/security/scrypt';
import {
  accountExists,
  authenticateUser,
  getStoredUser,
  registerUser,
} from '@/lib/server-auth';
import { resolveLogin } from '@/lib/user-index';
import { USER_SCHEMA_VERSION } from '@/lib/user-schema';

import {
  loginIndexPath,
  readJson,
  removeDir,
  userPaths,
  useTempDataDir,
} from '@tests/support';
import { sha256 } from '@tests/support/hash';

let dataDir: string;

beforeEach(() => {
  dataDir = useTempDataDir();
});

afterEach(() => {
  removeDir(dataDir);
});

describe('normalizeLogin / uid', () => {
  it('нормализует регистр и внешние пробелы', () => {
    expect(normalizeLogin('  Hero@Example.com ')).toBe('hero@example.com');
    expect(normalizeLogin('HERO@EXAMPLE.COM')).toBe('hero@example.com');
  });

  it('uid — UUID, а не производная от логина', () => {
    const a = newUid();
    const b = newUid();
    expect(isUid(a)).toBe(true);
    expect(a).not.toBe(b);
    expect(isUid('user-abc123')).toBe(false);
    expect(isUid('../escape')).toBe(false);
  });
});

describe('authenticateUser', () => {
  it('создаёт аккаунт при первом входе и пишет user.json + индекс', async () => {
    const result = await authenticateUser('newbie', 'secret1', 'Newbie');

    expect(result.success).toBe(true);
    expect(result.isNewUser).toBe(true);
    expect(isUid(result.user?.uid)).toBe(true);
    expect(result.user?.hasRecoveryPhrase).toBe(false);

    const uid = result.user!.uid;
    const paths = userPaths(dataDir, uid);
    expect(fs.existsSync(paths.userFile)).toBe(true);

    const stored = readJson(paths.userFile);
    expect(stored).toMatchObject({
      schemaVersion: USER_SCHEMA_VERSION,
      uid,
      username: 'newbie',
      displayName: 'Newbie',
    });
    expect(isScryptHash(stored.passwordHash)).toBe(true);
    expect(verifyPassword(stored.passwordHash, 'secret1').valid).toBe(true);
    expect(stored.createdAt).toBeTruthy();
    // Пароль не хранится как есть, только sha256-хеш.
    expect(JSON.stringify(stored)).not.toContain('secret1');

    // Индекс: логин указывает на этот uid.
    const index = readJson(loginIndexPath(dataDir));
    expect(index.logins.newbie).toBe(uid);
    expect(await resolveLogin('newbie')).toBe(uid);
  });

  it('не перезаписывает существующий аккаунт и сохраняет uid', async () => {
    const first = await authenticateUser('repeat', 'pass-one-1234');
    const second = await authenticateUser('repeat', 'pass-one-1234');

    expect(first.isNewUser).toBe(true);
    expect(second.isNewUser).toBe(false);
    expect(second.user?.uid).toBe(first.user?.uid);
    expect(second.user?.displayName).toBe('repeat');
  });

  it('не пускает с неверным паролем', async () => {
    await authenticateUser('repeat', 'pass-one-1234');
    const result = await authenticateUser('repeat', 'wrong');

    expect(result.success).toBe(false);
    expect(result.error).toBe('Incorrect password.');
  });

  it('логин регистронезависим', async () => {
    const created = await authenticateUser('CaseUser', 'pass-one-1234');
    const login = await authenticateUser('caseuser', 'pass-one-1234');

    expect(login.success).toBe(true);
    expect(login.isNewUser).toBe(false);
    expect(login.user?.uid).toBe(created.user?.uid);
    // username в профиле нормализуется в нижний регистр
    expect(login.user?.username).toBe('caseuser');
  });

  it('displayName по умолчанию берётся из логина до @', async () => {
    const result = await authenticateUser('player@table.ru', 'pass-one-1234');
    expect(result.user?.displayName).toBe('player');
  });

  it('читает legacy-поле email вместо username', async () => {
    const uid = newUid();
    const paths = userPaths(dataDir, uid);
    fs.mkdirSync(paths.userDir, { recursive: true });
    fs.writeFileSync(
      paths.userFile,
      JSON.stringify({
        email: 'legacy',
        displayName: 'Old',
        passwordHash: sha256('pass-one-1234'),
      }),
    );

    // uid берётся из каталога, логин — из email.
    expect((await getStoredUser(uid))?.username).toBe('legacy');
    expect((await getStoredUser(uid))?.uid).toBe(uid);

    // Индекс пересобирается сканом и видит такой профиль.
    expect(await resolveLogin('legacy')).toBe(uid);

    const result = await authenticateUser('legacy', 'pass-one-1234');
    expect(result.success).toBe(true);
    expect(result.user?.uid).toBe(uid);
  });

  it('allowRegistration: false не создаёт аккаунт для свободного логина', async () => {
    const result = await authenticateUser('ghost', 'pass-one-1234', undefined, {
      allowRegistration: false,
    });

    expect(result.success).toBe(false);
    expect(result.reason).toBe('no_account');
    expect(result.error).toContain('No account found');
    expect(await accountExists('ghost')).toBe(false);
    expect(fs.existsSync(path.join(dataDir, 'users'))).toBe(false);
  });

  it('allowRegistration: false пускает существующий аккаунт и различает пароль', async () => {
    const created = await authenticateUser('known', 'pass-one-1234');
    const ok = await authenticateUser('known', 'pass-one-1234', undefined, {
      allowRegistration: false,
    });
    const bad = await authenticateUser('known', 'wrong', undefined, {
      allowRegistration: false,
    });

    expect(ok.success).toBe(true);
    expect(ok.user?.uid).toBe(created.user?.uid);
    expect(bad.success).toBe(false);
    expect(bad.reason).toBe('invalid_password');
  });
});

describe('accountExists / registerUser', () => {
  it('accountExists нормализует логин и не создаёт аккаунт', async () => {
    const created = await authenticateUser('Existing.User', 'pass-one-1234');

    expect(await accountExists('existing.user')).toBe(true);
    expect(await accountExists('  EXISTING.USER  ')).toBe(true);
    expect(await accountExists('missing')).toBe(false);
    expect(await accountExists('')).toBe(false);

    // Проверка существования — только чтение.
    expect(await resolveLogin('existing.user')).toBe(created.user?.uid);
  });

  it('registerUser создаёт аккаунт с паролем и recovery-фразой', async () => {
    const result = await registerUser(
      '  New.User  ',
      'pass-one-1234',
      'New User',
      '  Amber Cobalt Silver Ember Frost  ',
    );

    expect(result.success).toBe(true);
    expect(result.isNewUser).toBe(true);
    expect(result.user?.username).toBe('new.user');
    expect(result.user?.displayName).toBe('New User');
    expect(result.user?.hasRecoveryPhrase).toBe(true);

    const uid = result.user!.uid;
    const stored = readJson(userPaths(dataDir, uid).userFile);
    expect(stored).toMatchObject({
      schemaVersion: USER_SCHEMA_VERSION,
      uid,
      username: 'new.user',
      displayName: 'New User',
    });
    expect(isScryptHash(stored.passwordHash)).toBe(true);
    expect(verifyPassword(stored.passwordHash, 'pass-one-1234').valid).toBe(
      true,
    );
    // Фраза хранится хэшем, а не открытым текстом.
    expect(isRecoveryPhraseHash(stored.recoveryPhrase)).toBe(true);
    expect(
      recoveryPhraseMatches(
        stored.recoveryPhrase,
        'amber cobalt silver ember frost',
      ),
    ).toBe(true);
    expect(await resolveLogin('new.user')).toBe(uid);

    // Пароль из регистрации работает при входе.
    expect(
      (await authenticateUser('new.user', 'pass-one-1234')).user?.uid,
    ).toBe(uid);
    expect((await authenticateUser('new.user', 'pass-two-1234')).success).toBe(
      false,
    );
  });

  it('registerUser отклоняет занятый логин и ничего не перезаписывает', async () => {
    const first = await registerUser(
      'taken',
      'pass-one-1234',
      'First',
      'amber cobalt silver ember frost',
    );
    const second = await registerUser(
      'taken',
      'pass-two-1234',
      'Second',
      'zulu yankee xray whiskey victor uniform',
    );

    expect(second.success).toBe(false);
    expect(second.reason).toBe('exists');
    expect(second.error).toContain('already registered');

    const stored = readJson(userPaths(dataDir, first.user!.uid).userFile);
    expect(stored.displayName).toBe('First');
    expect(isScryptHash(stored.passwordHash)).toBe(true);
    expect(verifyPassword(stored.passwordHash, 'pass-one-1234').valid).toBe(
      true,
    );
    expect(isRecoveryPhraseHash(stored.recoveryPhrase)).toBe(true);
    expect(
      recoveryPhraseMatches(
        stored.recoveryPhrase,
        'zulu yankee xray whiskey victor uniform',
      ),
    ).toBe(false);
  });

  it('registerUser валидирует пароль и фразу', async () => {
    const shortPassword = await registerUser(
      'short-pass',
      '123',
      'Short',
      'amber cobalt silver ember frost',
    );
    expect(shortPassword.success).toBe(false);
    expect(shortPassword.reason).toBe('invalid_input');

    const shortPhrase = await registerUser(
      'short-phrase',
      'pass-one-1234',
      'Short',
      'ab',
    );
    expect(shortPhrase.success).toBe(false);
    expect(shortPhrase.reason).toBe('invalid_phrase');

    const noLogin = await registerUser(
      '   ',
      'pass-one-1234',
      'Nobody',
      'amber cobalt silver ember frost',
    );
    expect(noLogin.success).toBe(false);

    expect(await accountExists('short-pass')).toBe(false);
    expect(await accountExists('short-phrase')).toBe(false);
  });
});
