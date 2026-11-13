import crypto from 'node:crypto';
import fs from 'node:fs';
import path from 'node:path';

import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

import { isUid, newUid, normalizeLogin } from '@/lib/ids';
import { verifyPassword } from '@/lib/security/password';
import {
  isRecoveryPhraseHash,
  recoveryPhraseMatches,
} from '@/lib/security/phrase';
import { isScryptHash } from '@/lib/security/scrypt';
import { issueRecoveryToken } from '@/lib/security/tokens';
import {
  accountExists,
  authenticateUser,
  getStoredUser,
  hashLegacyRecoveryPhrases,
  registerUser,
  resetCredentialsWithToken,
  setRecoveryPhrase,
  updateUserProfile,
  userExists,
  verifyRecovery,
} from '@/lib/server-auth';
import { resetLoginIndexRebuildCooldown, resolveLogin } from '@/lib/user-index';
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
    });
    expect(isScryptHash(stored.passwordHash)).toBe(true);
    expect(verifyPassword(stored.passwordHash, 'secret1').valid).toBe(true);
    expect(stored.createdAt).toBeTruthy();
    // Пароль не хранится как есть, только sha256-хеш.
    expect(JSON.stringify(stored)).not.toContain('secret1');

    // Индекс: логин указывает на этот uid.
    const index = readJson(loginIndexPath(dataDir));
    expect(index.logins.newbie).toBe(uid);
    expect(resolveLogin('newbie')).toBe(uid);
  });

  it('не перезаписывает существующий аккаунт и сохраняет uid', () => {
    const first = authenticateUser('repeat', 'pass-one-1234');
    const second = authenticateUser('repeat', 'pass-one-1234');

    expect(first.isNewUser).toBe(true);
    expect(second.isNewUser).toBe(false);
    expect(second.user?.uid).toBe(first.user?.uid);
    expect(second.user?.displayName).toBe('repeat');
  });

  it('не пускает с неверным паролем', () => {
    authenticateUser('repeat', 'pass-one-1234');
    const result = authenticateUser('repeat', 'wrong');

    expect(result.success).toBe(false);
    expect(result.error).toBe('Incorrect password.');
  });

  it('логин регистронезависим', () => {
    const created = authenticateUser('CaseUser', 'pass-one-1234');
    const login = authenticateUser('caseuser', 'pass-one-1234');

    expect(login.success).toBe(true);
    expect(login.isNewUser).toBe(false);
    expect(login.user?.uid).toBe(created.user?.uid);
    // username в профиле нормализуется в нижний регистр
    expect(login.user?.username).toBe('caseuser');
  });

  it('displayName по умолчанию берётся из логина до @', () => {
    const result = authenticateUser('player@table.ru', 'pass-one-1234');
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
        passwordHash: sha256('pass-one-1234'),
      }),
    );

    // uid берётся из каталога, логин — из email.
    expect(getStoredUser(uid)?.username).toBe('legacy');
    expect(getStoredUser(uid)?.uid).toBe(uid);

    // Индекс пересобирается сканом и видит такой профиль.
    expect(resolveLogin('legacy')).toBe(uid);

    const result = authenticateUser('legacy', 'pass-one-1234');
    expect(result.success).toBe(true);
    expect(result.user?.uid).toBe(uid);
  });

  it('allowRegistration: false не создаёт аккаунт для свободного логина', () => {
    const result = authenticateUser('ghost', 'pass-one-1234', undefined, {
      allowRegistration: false,
    });

    expect(result.success).toBe(false);
    expect(result.reason).toBe('no_account');
    expect(result.error).toContain('No account found');
    expect(accountExists('ghost')).toBe(false);
    expect(fs.existsSync(path.join(dataDir, 'users'))).toBe(false);
  });

  it('allowRegistration: false пускает существующий аккаунт и различает пароль', () => {
    const created = authenticateUser('known', 'pass-one-1234');
    const ok = authenticateUser('known', 'pass-one-1234', undefined, {
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
    const created = authenticateUser('Existing.User', 'pass-one-1234');

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
      'pass-one-1234',
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
    });
    expect(isScryptHash(stored.passwordHash)).toBe(true);
    expect(verifyPassword(stored.passwordHash, 'pass-one-1234').valid).toBe(
      true,
    );
    // Фраза хранится хэшем, а не открытым текстом.
    expect(isRecoveryPhraseHash(stored.recoveryPhrase)).toBe(true);
    expect(recoveryPhraseMatches(stored.recoveryPhrase, 'amber cobalt')).toBe(
      true,
    );
    expect(resolveLogin('new.user')).toBe(uid);

    // Пароль из регистрации работает при входе.
    expect(authenticateUser('new.user', 'pass-one-1234').user?.uid).toBe(uid);
    expect(authenticateUser('new.user', 'pass-two-1234').success).toBe(false);
  });

  it('registerUser отклоняет занятый логин и ничего не перезаписывает', () => {
    const first = registerUser(
      'taken',
      'pass-one-1234',
      'First',
      'amber cobalt',
    );
    const second = registerUser(
      'taken',
      'pass-two-1234',
      'Second',
      'zulu yankee',
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

    const shortPhrase = registerUser(
      'short-phrase',
      'pass-one-1234',
      'Short',
      'ab',
    );
    expect(shortPhrase.success).toBe(false);
    expect(shortPhrase.reason).toBe('invalid_input');

    const noLogin = registerUser(
      '   ',
      'pass-one-1234',
      'Nobody',
      'amber cobalt',
    );
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
    password = 'pass-one-1234',
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
    expect(
      authenticateUser('recoverer', 'pass-one-1234').user?.hasRecoveryPhrase,
    ).toBe(true);
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
    const uid = setupAccount(
      'cyrillic',
      'pass-one-1234',
      '  Синий Кит Фонарь ',
    );
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
    authenticateUser('nophrase-level', 'pass-one-1234');
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
    const uid = setupAccount('resetme', 'old-pass-1234');
    const { token } = issueRecoveryToken(uid);

    const reset = resetCredentialsWithToken(
      token,
      'fresh-pass-1234',
      '  New Phrase Here ',
    );
    expect(reset.success).toBe(true);
    expect(reset.uid).toBe(uid);

    expect(authenticateUser('resetme', 'fresh-pass-1234').success).toBe(true);
    expect(authenticateUser('resetme', 'old-pass-1234').success).toBe(false);
    // Новая фраза сравнивается целиком и хранится хэшем.
    expect(verifyRecovery('resetme', 'new phrase here').success).toBe(true);
    expect(isRecoveryPhraseHash(storedPhrase(uid))).toBe(true);
  });

  it('сброс по логину без токена невозможен', () => {
    setupAccount('victim', 'old-pass-1234');

    expect(
      resetCredentialsWithToken('', 'pwned-pass-1234', 'x y z').success,
    ).toBe(false);
    expect(
      resetCredentialsWithToken('not-a-token', 'pwned-pass-1234', 'x y z')
        .reason,
    ).toBe('invalid_token');
    // Пароль не изменился.
    expect(authenticateUser('victim', 'old-pass-1234').success).toBe(true);
    expect(authenticateUser('victim', 'pwned-pass-1234').success).toBe(false);
  });

  it('токен одноразовый и не переживает лимит времени', () => {
    const uid = setupAccount('once', 'old-pass-1234');
    const { token } = issueRecoveryToken(uid);

    expect(resetCredentialsWithToken(token, 'first-pass-1234').success).toBe(
      true,
    );
    expect(resetCredentialsWithToken(token, 'second-pass-1234').reason).toBe(
      'invalid_token',
    );

    const expired = issueRecoveryToken(uid, {
      ttlMs: 1000,
      nowMs: Date.now() - 5000,
    });
    expect(
      resetCredentialsWithToken(expired.token, 'third-pass-1234').success,
    ).toBe(false);
  });

  it('чужой токен не даёт сменить пароль другому аккаунту', () => {
    setupAccount('attacker', 'pass-one-1234');
    const victimUid = setupAccount('victim2', 'old-pass-1234');
    const { token } = issueRecoveryToken(victimUid);

    // Токен принадлежит жертве; логин атакующего не участвует вовсе.
    expect(resetCredentialsWithToken(token, 'hijacked-pass-1234').success).toBe(
      true,
    );
    expect(authenticateUser('victim2', 'hijacked-pass-1234').success).toBe(
      true,
    );
    // Пароль второго (атакующего) аккаунта не изменился.
    expect(authenticateUser('attacker', 'pass-one-1234').success).toBe(true);
    expect(authenticateUser('attacker', 'hijacked-pass-1234').success).toBe(
      false,
    );
  });

  it('успешный сброс гасит остальные выданные токены', () => {
    const uid = setupAccount('multi-token', 'old-pass-1234');
    const first = issueRecoveryToken(uid);
    const second = issueRecoveryToken(uid);

    expect(
      resetCredentialsWithToken(first.token, 'new-pass-one-1234').success,
    ).toBe(true);
    expect(
      resetCredentialsWithToken(second.token, 'new-pass-two-1234').success,
    ).toBe(false);
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
    expect(resetCredentialsWithToken(token, 'fresh-pass-1234').success).toBe(
      true,
    );

    const stored = readJson(paths.userFile);
    expect(stored.email).toBeUndefined();
    expect(stored.mustChangePassword).toBeUndefined();
    expect(stored.username).toBe('legacy-mail');
    expect(isScryptHash(stored.passwordHash)).toBe(true);
    expect(verifyPassword(stored.passwordHash, 'fresh-pass-1234').valid).toBe(
      true,
    );
    expect(userExists(uid)).toBe(true);
  });

  it('hashLegacyRecoveryPhrases переводит открытые фразы в хэши идемпотентно', () => {
    const plainUid = setupAccount('migrate-me', 'pass-one-1234');
    // Имитируем старые данные: записываем фразу открытым текстом.
    const paths = userPaths(dataDir, plainUid);
    const raw = readJson(paths.userFile);
    raw.recoveryPhrase = 'plain amber cobalt';
    fs.writeFileSync(paths.userFile, JSON.stringify(raw, null, 2));

    const hashedUid = setupAccount(
      'already-hashed',
      'pass-one-1234',
      'kept phrase',
    );
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

describe('пароли: миграция хэшей и политика (SEC-7)', () => {
  it('старый sha256-аккаунт входит и получает scrypt-хэш', () => {
    const uid = newUid();
    const paths = userPaths(dataDir, uid);
    fs.mkdirSync(paths.userDir, { recursive: true });
    fs.writeFileSync(
      paths.userFile,
      JSON.stringify({
        uid,
        username: 'legacy-hash',
        displayName: 'Legacy',
        passwordHash: sha256('legacy-pass-1234'),
      }),
    );

    const result = authenticateUser('legacy-hash', 'legacy-pass-1234');
    expect(result.success).toBe(true);
    expect(result.user?.uid).toBe(uid);

    // Хэш на диске переписан прозрачно для пользователя.
    const stored = readJson(paths.userFile);
    expect(isScryptHash(stored.passwordHash)).toBe(true);
    expect(stored.passwordHash).not.toBe(sha256('legacy-pass-1234'));
    expect(verifyPassword(stored.passwordHash, 'legacy-pass-1234').valid).toBe(
      true,
    );

    // Повторный вход работает уже по новому хэшу.
    expect(authenticateUser('legacy-hash', 'legacy-pass-1234').success).toBe(
      true,
    );
    expect(authenticateUser('legacy-hash', 'wrong-pass-1234').success).toBe(
      false,
    );
  });

  it('неверный пароль не переписывает устаревший хэш', () => {
    const uid = newUid();
    const paths = userPaths(dataDir, uid);
    fs.mkdirSync(paths.userDir, { recursive: true });
    const legacyHash = sha256('legacy-pass-1234');
    fs.writeFileSync(
      paths.userFile,
      JSON.stringify({
        uid,
        username: 'legacy-stays',
        displayName: 'Legacy',
        passwordHash: legacyHash,
      }),
    );

    expect(authenticateUser('legacy-stays', 'other-pass-1234').success).toBe(
      false,
    );
    expect(readJson(paths.userFile).passwordHash).toBe(legacyHash);
  });

  it('registerUser и updateUserProfile требуют минимум 12 символов', () => {
    const tooShort = registerUser(
      'short-pw',
      'short123',
      'Short',
      'amber cobalt',
    );
    expect(tooShort.success).toBe(false);
    expect(tooShort.reason).toBe('invalid_input');
    expect(tooShort.error).toContain('at least 12');

    const created = authenticateUser('policy-user', 'valid-pass-1234');
    const uid = created.user!.uid;
    const before = readJson(userPaths(dataDir, uid).userFile).passwordHash;

    const update = updateUserProfile(uid, 'policy-user', 'Policy', 'short123');
    expect(update.success).toBe(false);
    expect(update.error).toContain('at least 12');
    // Неудачная валидация не трогает профиль.
    expect(readJson(userPaths(dataDir, uid).userFile).passwordHash).toBe(
      before,
    );

    // Пустая строка — это «не менять пароль», а не «установить пустой».
    expect(updateUserProfile(uid, 'policy-user', 'Policy', '   ').success).toBe(
      true,
    );
  });

  it('resetCredentialsWithToken требует минимум 12 символов', () => {
    const uid = authenticateUser('reset-policy', 'valid-pass-1234').user!.uid;
    const { token } = issueRecoveryToken(uid);

    const tooShort = resetCredentialsWithToken(token, 'short123');
    expect(tooShort.success).toBe(false);
    expect(tooShort.reason).toBe('invalid_input');
    // Пароль не сменился, а токен не сгорел на валидации.
    expect(authenticateUser('reset-policy', 'valid-pass-1234').success).toBe(
      true,
    );
    expect(resetCredentialsWithToken(token, 'fresh-valid-1234').success).toBe(
      true,
    );
  });

  it('resolveLogin пересобирает индекс не чаще раза в минуту', () => {
    authenticateUser('index-known', 'valid-pass-1234');
    resetLoginIndexRebuildCooldown();

    // Первый промах — пересборка разрешена (индекс перечитывается с диска).
    expect(resolveLogin('ghost-one')).toBeNull();

    // Новый профиль, о котором индекс ещё не знает.
    const lateUid = newUid();
    const latePaths = userPaths(dataDir, lateUid);
    fs.mkdirSync(latePaths.userDir, { recursive: true });
    fs.writeFileSync(
      latePaths.userFile,
      JSON.stringify({
        uid: lateUid,
        username: 'late-user',
        displayName: 'Late',
        passwordHash: sha256('valid-pass-1234'),
      }),
    );

    // В пределах cooldown пересборки нет, поэтому промах остаётся промахом.
    expect(resolveLogin('late-user')).toBeNull();

    // После сброса троттлинга тот же логин находится: значит, дело было
    // именно в пропущенном скане, а не в отсутствии данных.
    resetLoginIndexRebuildCooldown();
    expect(resolveLogin('late-user')).toBe(lateUid);
  });
});
