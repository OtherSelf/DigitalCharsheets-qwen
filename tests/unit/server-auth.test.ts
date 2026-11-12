import crypto from 'node:crypto';
import fs from 'node:fs';
import path from 'node:path';

import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

import { isUid, newUid, normalizeLogin } from '@/lib/ids';
import {
  isRecoveryPhraseHash,
  recoveryPhraseMatches,
} from '@/lib/security/phrase';
import { issueRecoveryToken } from '@/lib/security/tokens';
import {
  accountExists,
  authenticateUser,
  getStoredUser,
  hashLegacyRecoveryPhrases,
  registerUser,
  resetCredentialsWithToken,
  setRecoveryPhrase,
  userExists,
  verifyRecovery,
} from '@/lib/server-auth';
import { resolveLogin } from '@/lib/user-index';
import { USER_SCHEMA_VERSION } from '@/lib/user-schema';

import {
  loginIndexPath,
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
 * индекс «логин → uid»; вход по паролю; legacy-поле email; recovery-фраза
 * (хэш, сравнение целиком) и сброс пароля по одноразовому токену.
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
    });
    // Фраза хранится хэшем, а не открытым текстом.
    expect(isRecoveryPhraseHash(stored.recoveryPhrase)).toBe(true);
    expect(recoveryPhraseMatches(stored.recoveryPhrase, 'amber cobalt')).toBe(
      true,
    );
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
    expect(isRecoveryPhraseHash(stored.recoveryPhrase)).toBe(true);
    expect(recoveryPhraseMatches(stored.recoveryPhrase, 'zulu yankee')).toBe(
      false,
    );
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
 * RECOVERY (SEC-1, SEC-4): восстановление доступа.
 *
 * Инварианты, которые здесь закреплены:
 *   • фраза хранится хэшем и сравнивается целиком (состав и порядок слов);
 *   • слова из листов персонажей — не фактор: лист видел кто угодно;
 *   • пароль и фразу меняет только одноразовый токен, а не логин;
 *   • фраза работает для аккаунта без листов и на кириллице.
 */
describe('recovery: проверка фразы и сброс по токену', () => {
  function setupAccount(
    username = 'recoverer',
    password = 'pass1',
    phrase = 'alpha beta gamma',
  ) {
    const result = authenticateUser(username, password);
    const uid = result.user!.uid;
    expect(setRecoveryPhrase(uid, phrase)).toBe(true);
    return uid;
  }

  const storedPhrase = (uid: string) =>
    readJson(userPaths(dataDir, uid).userFile).recoveryPhrase;

  it('setRecoveryPhrase хранит хэш, а не открытый текст', () => {
    const uid = setupAccount();
    const stored = storedPhrase(uid);

    expect(typeof stored).toBe('string');
    expect(stored).not.toContain('alpha');
    expect(isRecoveryPhraseHash(stored)).toBe(true);
    expect(recoveryPhraseMatches(stored, 'Alpha Beta Gamma')).toBe(true);
    expect(authenticateUser('recoverer', 'pass1').user?.hasRecoveryPhrase).toBe(
      true,
    );
  });

  it('setRecoveryPhrase возвращает false для пустой фразы и чужого uid', () => {
    const errorSpy = vi.spyOn(console, 'error').mockImplementation(() => {});
    expect(setRecoveryPhrase(newUid(), 'alpha beta')).toBe(false);
    const uid = setupAccount('empty-phrase');
    expect(setRecoveryPhrase(uid, '   ')).toBe(false);
    errorSpy.mockRestore();
  });

  it('verifyRecovery принимает полную фразу и не зависит от регистра', () => {
    const uid = setupAccount();
    const result = verifyRecovery('Recoverer', '  ALPHA   beta Gamma ');

    expect(result.success).toBe(true);
    expect(result.user?.uid).toBe(uid);
  });

  it('verifyRecovery отклоняет одно слово и частичную фразу', () => {
    setupAccount();

    // Раньше совпадало «хотя бы одно слово» — это и был захват.
    for (const partial of ['alpha', 'gamma', 'alpha beta', 'beta alpha']) {
      const result = verifyRecovery('recoverer', partial);
      expect({ partial, success: result.success }).toEqual({
        partial,
        success: false,
      });
      expect(result.reason).toBe('mismatch');
    }
  });

  it('verifyRecovery не падает на пунктуации и спецсимволах', () => {
    setupAccount();
    for (const input of ['.', '(', ')', '[', '$&', '*']) {
      const result = verifyRecovery('recoverer', input);
      expect({ input, success: result.success }).toEqual({
        input,
        success: false,
      });
    }
  });

  it('verifyRecovery работает на кириллице', () => {
    const uid = setupAccount('cyrillic', 'pass1', '  Синий Кит Фонарь ');
    const result = verifyRecovery('cyrillic', 'синий кит фонарь');

    expect(result.success).toBe(true);
    expect(result.user?.uid).toBe(uid);
  });

  it('verifyRecovery не требует листов персонажей', () => {
    // Автор персонажа — не обязательно владелец аккаунта, поэтому листы
    // фактором владения не считаются вовсе.
    setupAccount('nosheets');
    expect(verifyRecovery('nosheets', 'alpha beta gamma').success).toBe(true);
  });

  it('verifyRecovery сообщает причины отказа', () => {
    expect(verifyRecovery('nobody', 'alpha').reason).toBe('no_account');
    authenticateUser('nophrase-level', 'pass1');
    expect(verifyRecovery('nophrase-level', 'alpha').reason).toBe('no_phrase');
  });

  it('verifyRecovery переводит старую открытую фразу в хэш', () => {
    const uid = newUid();
    const paths = userPaths(dataDir, uid);
    fs.mkdirSync(paths.userDir, { recursive: true });
    fs.writeFileSync(
      paths.userFile,
      JSON.stringify({
        uid,
        username: 'legacy-phrase',
        displayName: 'Legacy',
        passwordHash: sha256('old'),
        recoveryPhrase: 'old amber cobalt',
      }),
    );

    expect(verifyRecovery('legacy-phrase', 'old amber cobalt').success).toBe(
      true,
    );
    const stored = readJson(paths.userFile).recoveryPhrase;
    expect(isRecoveryPhraseHash(stored)).toBe(true);
    expect(stored).not.toContain('amber');
    // Хэш сохранённой фразы по-прежнему принимает ту же фразу.
    expect(verifyRecovery('legacy-phrase', 'old amber cobalt').success).toBe(
      true,
    );
    expect(verifyRecovery('legacy-phrase', 'amber').success).toBe(false);
  });

  it('resetCredentialsWithToken меняет пароль и фразу, старый пароль не работает', () => {
    const uid = setupAccount('resetme', 'oldpass');
    const { token } = issueRecoveryToken(uid);

    const reset = resetCredentialsWithToken(
      token,
      'freshpass',
      '  New Phrase Here ',
    );
    expect(reset.success).toBe(true);
    expect(reset.uid).toBe(uid);

    expect(authenticateUser('resetme', 'freshpass').success).toBe(true);
    expect(authenticateUser('resetme', 'oldpass').success).toBe(false);
    // Новая фраза сравнивается целиком и хранится хэшем.
    expect(verifyRecovery('resetme', 'new phrase here').success).toBe(true);
    expect(isRecoveryPhraseHash(storedPhrase(uid))).toBe(true);
  });

  it('сброс по логину без токена невозможен', () => {
    setupAccount('victim', 'oldpass');

    expect(resetCredentialsWithToken('', 'pwned-pass', 'x y z').success).toBe(
      false,
    );
    expect(
      resetCredentialsWithToken('not-a-token', 'pwned-pass', 'x y z').reason,
    ).toBe('invalid_token');
    // Пароль не изменился.
    expect(authenticateUser('victim', 'oldpass').success).toBe(true);
    expect(authenticateUser('victim', 'pwned-pass').success).toBe(false);
  });

  it('токен одноразовый и не переживает лимит времени', () => {
    const uid = setupAccount('once', 'oldpass');
    const { token } = issueRecoveryToken(uid);

    expect(resetCredentialsWithToken(token, 'first-pass').success).toBe(true);
    expect(resetCredentialsWithToken(token, 'second-pass').reason).toBe(
      'invalid_token',
    );

    const expired = issueRecoveryToken(uid, {
      ttlMs: 1000,
      nowMs: Date.now() - 5000,
    });
    expect(resetCredentialsWithToken(expired.token, 'third-pass').success).toBe(
      false,
    );
  });

  it('чужой токен не даёт сменить пароль другому аккаунту', () => {
    setupAccount('attacker', 'pass1');
    const victimUid = setupAccount('victim2', 'oldpass');
    const { token } = issueRecoveryToken(victimUid);

    // Токен принадлежит жертве; логин атакующего не участвует вовсе.
    expect(resetCredentialsWithToken(token, 'hijacked').success).toBe(true);
    expect(authenticateUser('victim2', 'hijacked').success).toBe(true);
    // Пароль второго (атакующего) аккаунта не изменился.
    expect(authenticateUser('attacker', 'pass1').success).toBe(true);
    expect(authenticateUser('attacker', 'hijacked').success).toBe(false);
  });

  it('успешный сброс гасит остальные выданные токены', () => {
    const uid = setupAccount('multi-token', 'oldpass');
    const first = issueRecoveryToken(uid);
    const second = issueRecoveryToken(uid);

    expect(resetCredentialsWithToken(first.token, 'newpass1').success).toBe(
      true,
    );
    expect(resetCredentialsWithToken(second.token, 'newpass2').success).toBe(
      false,
    );
  });

  it('сброс убирает legacy email и флаг mustChangePassword', () => {
    const uid = newUid();
    const paths = userPaths(dataDir, uid);
    fs.mkdirSync(paths.userDir, { recursive: true });
    fs.writeFileSync(
      paths.userFile,
      JSON.stringify({
        uid,
        username: 'legacy-mail',
        displayName: 'Legacy',
        passwordHash: sha256('old'),
        recoveryPhrase: 'amber cobalt',
        mustChangePassword: true,
        email: 'legacy-mail@example.com',
      }),
    );

    // Фраза ещё открытым текстом: verify мигрирует её в хэш.
    expect(verifyRecovery('legacy-mail', 'amber cobalt').success).toBe(true);
    const { token } = issueRecoveryToken(uid);
    expect(resetCredentialsWithToken(token, 'freshpass').success).toBe(true);

    const stored = readJson(paths.userFile);
    expect(stored.email).toBeUndefined();
    expect(stored.mustChangePassword).toBeUndefined();
    expect(stored.username).toBe('legacy-mail');
    expect(stored.passwordHash).toBe(sha256('freshpass'));
    expect(userExists(uid)).toBe(true);
  });

  it('hashLegacyRecoveryPhrases переводит открытые фразы в хэши идемпотентно', () => {
    const plainUid = setupAccount('migrate-me', 'pass1');
    // Имитируем старые данные: записываем фразу открытым текстом.
    const paths = userPaths(dataDir, plainUid);
    const raw = readJson(paths.userFile);
    raw.recoveryPhrase = 'plain amber cobalt';
    fs.writeFileSync(paths.userFile, JSON.stringify(raw, null, 2));

    const hashedUid = setupAccount('already-hashed', 'pass1', 'kept phrase');
    const hashedBefore = storedPhrase(hashedUid);

    const report = hashLegacyRecoveryPhrases();
    expect(report.updated).toBeGreaterThanOrEqual(1);
    expect(isRecoveryPhraseHash(storedPhrase(plainUid))).toBe(true);
    expect(
      recoveryPhraseMatches(storedPhrase(plainUid), 'plain amber cobalt'),
    ).toBe(true);
    // Уже захешированная фраза не переписывается.
    expect(storedPhrase(hashedUid)).toBe(hashedBefore);

    expect(hashLegacyRecoveryPhrases().updated).toBe(0);
  });
});
