import crypto from 'node:crypto';
import fs from 'node:fs';
import path from 'node:path';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

import {
  authenticateUser,
  generateUserId,
  getStoredUser,
  recoverPasswordWithUsernameAndWords,
  setRecoveryPhrase,
  updateRecoveryCredentials,
  userExists,
  verifyRecovery,
} from '@/lib/server-auth';
import { saveCharacterToServer } from '@/lib/server-storage';
import { makeDndCharacter, readJson, removeDir, useTempDataDir, userPaths } from '../helpers';

let dataDir: string;

beforeEach(() => {
  dataDir = useTempDataDir();
});

afterEach(() => {
  removeDir(dataDir);
});

const sha256 = (value: string) => crypto.createHash('sha256').update(value).digest('hex');

describe('generateUserId', () => {
  it('детерминирован и не зависит от регистра/пробелов', () => {
    const a = generateUserId('Hero@Example.com');
    expect(generateUserId('  hero@example.com ')).toBe(a);
    expect(generateUserId('HERO@EXAMPLE.COM')).toBe(a);
  });

  it('даёт разные id разным логинам', () => {
    expect(generateUserId('alice')).not.toBe(generateUserId('bob'));
  });

  it('имеет безопасный для каталога формат user-<base36>', () => {
    expect(generateUserId('Тест')).toMatch(/^user-[a-z0-9]+$/);
    expect(generateUserId('a')).toMatch(/^user-[a-z0-9]+$/);
  });
});

describe('authenticateUser', () => {
  it('создаёт аккаунт при первом входе и пишет user.json', () => {
    const uid = generateUserId('newbie');
    const paths = userPaths(dataDir, uid);

    const result = authenticateUser('newbie', 'secret1', 'Newbie');

    expect(result.success).toBe(true);
    expect(result.isNewUser).toBe(true);
    expect(result.user?.uid).toBe(uid);
    expect(result.user?.hasRecoveryPhrase).toBe(false);

    expect(fs.existsSync(paths.userFile)).toBe(true);
    const stored = readJson(paths.userFile);
    expect(stored.username).toBe('newbie');
    expect(stored.displayName).toBe('Newbie');
    // Пароль не хранится как есть, только sha256-хеш.
    expect(stored.passwordHash).toBe(sha256('secret1'));
    expect(JSON.stringify(stored)).not.toContain('secret1');
  });

  it('не перезаписывает существующий аккаунт и узнаёт владельца', () => {
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
    const uid = generateUserId('legacy');
    const paths = userPaths(dataDir, uid);
    fs.mkdirSync(paths.userDir, { recursive: true });
    fs.writeFileSync(
      paths.userFile,
      JSON.stringify({ email: 'legacy', displayName: 'Old', passwordHash: sha256('pass1') }),
    );

    const stored = getStoredUser(uid);
    expect(stored?.username).toBe('legacy');

    const result = authenticateUser('legacy', 'pass1');
    expect(result.success).toBe(true);
    expect(result.user?.username).toBe('legacy');
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
    expect(setRecoveryPhrase(generateUserId('ghost'), 'alpha')).toBe(false);
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
    const uid = generateUserId('updateme');
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
