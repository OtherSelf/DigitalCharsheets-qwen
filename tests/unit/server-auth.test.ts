import crypto from 'node:crypto';
import fs from 'node:fs';
import path from 'node:path';

import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

import { isUid, newUid, normalizeLogin } from '@/lib/ids';
import {
  accountExists,
  authenticateUser,
  getStoredUser,
  recoverPasswordWithUsernameAndWords,
  registerUser,
  setRecoveryPhrase,
  updateRecoveryCredentials,
  userExists,
  verifyRecovery,
} from '@/lib/server-auth';
import { saveCharacterToServer } from '@/lib/server-storage';
import { resolveLogin } from '@/lib/user-index';
import { USER_SCHEMA_VERSION } from '@/lib/user-schema';

import {
  loginIndexPath,
  makeDndCharacter,
  readJson,
  removeDir,
  userPaths,
  useTempDataDir,
} from './helpers';

/**
 * Авторизация и восстановление доступа (src/lib/server-auth.ts).
 *
 * Покрыто: normalizeLogin (регистр/пробелы); uid — случайный UUID, который
 * не меняется при повторном входе; формат user.json (schemaVersion/uid);
 * индекс «логин → uid»; вход по паролю; legacy-поле email; recovery-фраза и
 * сброс пароля по словам из листов.
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
  it('создаёт аккаунт при первом входе и пишет user.json + индекс', () => {
    const result = authenticateUser('newbie', 'secret1', 'Newbie');

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
      passwordHash: sha256('secret1'),
    });
    expect(stored.createdAt).toBeTruthy();
    // Пароль не хранится как есть, только sha256-хеш.
    expect(JSON.stringify(stored)).not.toContain('secret1');

    // Индекс: логин указывает на этот uid.
    const index = readJson(loginIndexPath(dataDir));
    expect(index.logins.newbie).toBe(uid);
    expect(resolveLogin('newbie')).toBe(uid);
  });

  it('не перезаписывает существующий аккаунт и сохраняет uid', () => {
    const first = authenticateUser('repeat', 'pass1');
    const second = authenticateUser('repeat', 'pass1');

    expect(first.isNewUser).toBe(true);
    expect(second.isNewUser).toBe(false);
    expect(second.user?.uid).toBe(first.user?.uid);
    expect(second.user?.displayName).toBe('repeat');
  });

  it('не пускает с неверным паролем', () => {
    authenticateUser('repeat', 'pass1');
    const result = authenticateUser('repeat', 'wrong');

    expect(result.success).toBe(false);
    expect(result.error).toBe('Incorrect password.');
  });

  it('логин регистронезависим', () => {
    const created = authenticateUser('CaseUser', 'pass1');
    const login = authenticateUser('caseuser', 'pass1');

    expect(login.success).toBe(true);
    expect(login.isNewUser).toBe(false);
    expect(login.user?.uid).toBe(created.user?.uid);
    // username в профиле нормализуется в нижний регистр
    expect(login.user?.username).toBe('caseuser');
  });

  it('displayName по умолчанию берётся из логина до @', () => {
    const result = authenticateUser('player@table.ru', 'pass1');
    expect(result.user?.displayName).toBe('player');
  });

  it('читает legacy-поле email вместо username', () => {
    const uid = newUid();
    const paths = userPaths(dataDir, uid);
    fs.mkdirSync(paths.userDir, { recursive: true });
    fs.writeFileSync(
      paths.userFile,
      JSON.stringify({
        email: 'legacy',
        displayName: 'Old',
        passwordHash: sha256('pass1'),
      }),
    );

    // uid берётся из каталога, логин — из email.
    expect(getStoredUser(uid)?.username).toBe('legacy');
    expect(getStoredUser(uid)?.uid).toBe(uid);

    // Индекс пересобирается сканом и видит такой профиль.
    expect(resolveLogin('legacy')).toBe(uid);

    const result = authenticateUser('legacy', 'pass1');
    expect(result.success).toBe(true);
    expect(result.user?.uid).toBe(uid);
  });

  it('allowRegistration: false не создаёт аккаунт для свободного логина', () => {
    const result = authenticateUser('ghost', 'pass1', undefined, {
      allowRegistration: false,
    });

    expect(result.success).toBe(false);
    expect(result.reason).toBe('no_account');
    expect(result.error).toContain('No account found');
    expect(accountExists('ghost')).toBe(false);
    expect(fs.existsSync(path.join(dataDir, 'users'))).toBe(false);
  });

  it('allowRegistration: false пускает существующий аккаунт и различает пароль', () => {
    const created = authenticateUser('known', 'pass1');
    const ok = authenticateUser('known', 'pass1', undefined, {
      allowRegistration: false,
    });
    const bad = authenticateUser('known', 'wrong', undefined, {
      allowRegistration: false,
    });

    expect(ok.success).toBe(true);
    expect(ok.user?.uid).toBe(created.user?.uid);
    expect(bad.success).toBe(false);
    expect(bad.reason).toBe('invalid_password');
  });
});

describe('accountExists / registerUser', () => {
  it('accountExists нормализует логин и не создаёт аккаунт', () => {
    const created = authenticateUser('Existing.User', 'pass1');

    expect(accountExists('existing.user')).toBe(true);
    expect(accountExists('  EXISTING.USER  ')).toBe(true);
    expect(accountExists('missing')).toBe(false);
    expect(accountExists('')).toBe(false);

    // Проверка существования — только чтение.
    expect(resolveLogin('existing.user')).toBe(created.user?.uid);
  });

  it('registerUser создаёт аккаунт с паролем и recovery-фразой', () => {
    const result = registerUser(
      '  New.User  ',
      'pass1',
      'New User',
      '  Amber Cobalt  ',
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
      passwordHash: sha256('pass1'),
      recoveryPhrase: 'amber cobalt',
    });
    expect(resolveLogin('new.user')).toBe(uid);

    // Пароль из регистрации работает при входе.
    expect(authenticateUser('new.user', 'pass1').user?.uid).toBe(uid);
    expect(authenticateUser('new.user', 'pass2').success).toBe(false);
  });

  it('registerUser отклоняет занятый логин и ничего не перезаписывает', () => {
    const first = registerUser('taken', 'pass1', 'First', 'amber cobalt');
    const second = registerUser('taken', 'pass2', 'Second', 'zulu yankee');

    expect(second.success).toBe(false);
    expect(second.reason).toBe('exists');
    expect(second.error).toContain('already registered');

    const stored = readJson(userPaths(dataDir, first.user!.uid).userFile);
    expect(stored.displayName).toBe('First');
    expect(stored.passwordHash).toBe(sha256('pass1'));
    expect(stored.recoveryPhrase).toBe('amber cobalt');
  });

  it('registerUser валидирует пароль и фразу', () => {
    const shortPassword = registerUser(
      'short-pass',
      '123',
      'Short',
      'amber cobalt',
    );
    expect(shortPassword.success).toBe(false);
    expect(shortPassword.reason).toBe('invalid_input');

    const shortPhrase = registerUser('short-phrase', 'pass1', 'Short', 'ab');
    expect(shortPhrase.success).toBe(false);
    expect(shortPhrase.reason).toBe('invalid_input');

    const noLogin = registerUser('   ', 'pass1', 'Nobody', 'amber cobalt');
    expect(noLogin.success).toBe(false);

    expect(accountExists('short-pass')).toBe(false);
    expect(accountExists('short-phrase')).toBe(false);
  });
});

/**
 * CURRENT (insecure): эти сценарии описывают поведение, которое даёт захват
 * аккаунта (SEC-1: сброс без доказательства владения; SEC-4: достаточно одного
 * слова фразы). Они намеренно оставлены зелёными до фикса и будут заменены
 * target-тестами из блока `TARGET (SEC-1, SEC-4)` внизу файла — не удалять
 * молча и не «подгонять» под новое поведение без переписывания сценария.
 */
describe('CURRENT (insecure): recovery / смена пароля', () => {
  function setupAccountWithCharacter(
    username = 'recoverer',
    password = 'pass1',
  ) {
    const result = authenticateUser(username, password);
    const uid = result.user!.uid;
    saveCharacterToServer(
      uid,
      makeDndCharacter({ userId: uid, name: 'Ragnar Testborn' }) as any,
    );
    return uid;
  }

  it('setRecoveryPhrase сохраняет фразу в нижнем регистре', () => {
    const uid = setupAccountWithCharacter();
    expect(setRecoveryPhrase(uid, '  Alpha Beta Gamma  ')).toBe(true);

    const stored = readJson(userPaths(dataDir, uid).userFile);
    expect(stored.recoveryPhrase).toBe('alpha beta gamma');
    expect(authenticateUser('recoverer', 'pass1').user?.hasRecoveryPhrase).toBe(
      true,
    );
  });

  it('setRecoveryPhrase возвращает false для несуществующего аккаунта', () => {
    const errorSpy = vi.spyOn(console, 'error').mockImplementation(() => {});
    expect(setRecoveryPhrase(newUid(), 'alpha')).toBe(false);
    errorSpy.mockRestore();
  });

  it('verifyRecovery отклоняет несуществующий аккаунт', () => {
    const result = verifyRecovery('nobody', ['alpha'], 'alpha beta');
    expect(result.success).toBe(false);
    expect(result.error).toContain('No account found');
  });

  it('verifyRecovery требует установленную фразу', () => {
    authenticateUser('nophrase', 'pass1');
    const result = verifyRecovery('nophrase', ['word'], 'word');
    expect(result.success).toBe(false);
    expect(result.error).toContain('No recovery phrase');
  });

  it('verifyRecovery требует наличие листов персонажей', () => {
    const result = authenticateUser('nosheets', 'pass1');
    setRecoveryPhrase(result.user!.uid, 'alpha beta gamma');

    const verified = verifyRecovery('nosheets', ['alpha'], 'alpha');
    expect(verified.success).toBe(false);
    expect(verified.error).toContain('No character sheets');
  });

  it('verifyRecovery: слово из листа + совпавшее слово фразы = успех', () => {
    const uid = setupAccountWithCharacter();
    setRecoveryPhrase(uid, 'alpha beta gamma');

    // "ragnar" есть в имени персонажа, "alpha" есть в recovery-фразе.
    const result = verifyRecovery('recoverer', ['ragnar'], 'gamma');

    expect(result.success).toBe(true);
    expect(result.user?.uid).toBe(uid);
    expect(result.user?.hasRecoveryPhrase).toBe(true);
  });

  it('verifyRecovery ищет слова как целые слова, а не подстроки', () => {
    const uid = setupAccountWithCharacter();
    setRecoveryPhrase(uid, 'alpha beta');

    // "rag" — подстрока "Ragnar", но не отдельное слово
    const result = verifyRecovery('recoverer', ['rag'], 'alpha');
    expect(result.success).toBe(false);
    expect(result.error).toContain('rag');
  });

  it('verifyRecovery отклоняет фразу без общих слов', () => {
    const uid = setupAccountWithCharacter();
    setRecoveryPhrase(uid, 'alpha beta');

    const result = verifyRecovery('recoverer', ['ragnar'], 'zulu yankee');
    expect(result.success).toBe(false);
    expect(result.error).toContain('Recovery phrase does not match');
  });

  it('reset по словам меняет пароль, старый перестаёт работать', () => {
    const uid = setupAccountWithCharacter('resetme', 'oldpass');
    setRecoveryPhrase(uid, 'alpha beta');

    const reset = recoverPasswordWithUsernameAndWords(
      'resetme',
      ['ragnar'],
      'newpass',
    );
    expect(reset.success).toBe(true);

    expect(authenticateUser('resetme', 'newpass').success).toBe(true);
    expect(authenticateUser('resetme', 'oldpass').success).toBe(false);
  });

  it('reset по словам не срабатывает на неверное слово', () => {
    const uid = setupAccountWithCharacter('resetme', 'oldpass');
    setRecoveryPhrase(uid, 'alpha beta');

    const reset = recoverPasswordWithUsernameAndWords(
      'resetme',
      ['gnome'],
      'newpass',
    );
    expect(reset.success).toBe(false);
  });

  it('updateRecoveryCredentials меняет пароль и фразу и убирает legacy email', () => {
    const uid = newUid();
    const paths = userPaths(dataDir, uid);
    fs.mkdirSync(paths.userDir, { recursive: true });
    fs.writeFileSync(
      paths.userFile,
      JSON.stringify({
        email: 'updateme',
        displayName: 'U',
        passwordHash: sha256('old'),
      }),
    );

    const update = updateRecoveryCredentials(
      'updateme',
      'fresh1',
      'New Phrase',
    );
    expect(update.success).toBe(true);

    const stored = readJson(paths.userFile);
    expect(stored.email).toBeUndefined();
    expect(stored.username).toBe('updateme');
    expect(stored.passwordHash).toBe(sha256('fresh1'));
    expect(stored.recoveryPhrase).toBe('new phrase');
    expect(userExists(uid)).toBe(true);
  });
});

/**
 * TARGET (SEC-1, SEC-4): принимаемые критерии восстановления доступа.
 * Заготовки фиксируют, что именно должно измениться; по мере реализации
 * этапов 1 они превращаются в обычные тесты, а «CURRENT (insecure)» выше
 * удаляется.
 */
describe('TARGET (SEC-1, SEC-4): восстановление доступа', () => {
  it.todo(
    'сброс пароля возможен только по одноразовому токену, но не по логину',
  );
  it.todo('verifyRecovery сравнивает фразу целиком, а не по одному слову');
  it.todo('verifyRecovery отвечает 400 на частичную фразу и на "." / "("');
  it.todo('фраза на кириллице проходит нормализацию и сравнение');
  it.todo('просроченный и повторно использованный токен отклоняются');
  it.todo('падающий до этого regex не даёт 500');
});
