import crypto from 'node:crypto';
import fs from 'node:fs';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

import {
  authenticateUser,
  getStoredUser,
  recoverPasswordWithUsernameAndWords,
  setRecoveryPhrase,
  updateRecoveryCredentials,
  userExists,
  verifyRecovery,
} from '@/lib/server-auth';
import { isUid, newUid, normalizeLogin } from '@/lib/ids';
import { resolveLogin } from '@/lib/user-index';
import { saveCharacterToServer } from '@/lib/server-storage';
import {
  loginIndexPath,
  makeDndCharacter,
  readJson,
  removeDir,
  useTempDataDir,
  userPaths,
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

const sha256 = (value: string) => crypto.createHash('sha256').update(value).digest('hex');

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
      schemaVersion: 2,
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
      JSON.stringify({ email: 'legacy', displayName: 'Old', passwordHash: sha256('pass1') }),
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
});

describe('recovery / смена пароля', () => {
  function setupAccountWithCharacter(username = 'recoverer', password = 'pass1') {
    const result = authenticateUser(username, password);
    const uid = result.user!.uid;
    saveCharacterToServer(uid, makeDndCharacter({ userId: uid, name: 'Ragnar Testborn' }) as any);
    return uid;
  }

  it('setRecoveryPhrase сохраняет фразу в нижнем регистре', () => {
    const uid = setupAccountWithCharacter();
    expect(setRecoveryPhrase(uid, '  Alpha Beta Gamma  ')).toBe(true);

    const stored = readJson(userPaths(dataDir, uid).userFile);
    expect(stored.recoveryPhrase).toBe('alpha beta gamma');
    expect(authenticateUser('recoverer', 'pass1').user?.hasRecoveryPhrase).toBe(true);
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

    const reset = recoverPasswordWithUsernameAndWords('resetme', ['ragnar'], 'newpass');
    expect(reset.success).toBe(true);

    expect(authenticateUser('resetme', 'newpass').success).toBe(true);
    expect(authenticateUser('resetme', 'oldpass').success).toBe(false);
  });

  it('reset по словам не срабатывает на неверное слово', () => {
    const uid = setupAccountWithCharacter('resetme', 'oldpass');
    setRecoveryPhrase(uid, 'alpha beta');

    const reset = recoverPasswordWithUsernameAndWords('resetme', ['gnome'], 'newpass');
    expect(reset.success).toBe(false);
  });

  it('updateRecoveryCredentials меняет пароль и фразу и убирает legacy email', () => {
    const uid = newUid();
    const paths = userPaths(dataDir, uid);
    fs.mkdirSync(paths.userDir, { recursive: true });
    fs.writeFileSync(
      paths.userFile,
      JSON.stringify({ email: 'updateme', displayName: 'U', passwordHash: sha256('old') }),
    );

    const update = updateRecoveryCredentials('updateme', 'fresh1', 'New Phrase');
    expect(update.success).toBe(true);

    const stored = readJson(paths.userFile);
    expect(stored.email).toBeUndefined();
    expect(stored.username).toBe('updateme');
    expect(stored.passwordHash).toBe(sha256('fresh1'));
    expect(stored.recoveryPhrase).toBe('new phrase');
    expect(userExists(uid)).toBe(true);
  });
});
