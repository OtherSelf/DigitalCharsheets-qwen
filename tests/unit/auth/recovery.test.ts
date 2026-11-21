/**
 * RECOVERY (SEC-1, SEC-4): фраза хранится хэшем и сравнивается целиком,
 * пароль меняет только одноразовый токен, слова из листов — не фактор.
 */

import fs from 'node:fs';

import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

import { newUid } from '@/lib/ids';
import { verifyPassword } from '@/lib/security/password';
import {
  isRecoveryPhraseHash,
  recoveryPhraseMatches,
} from '@/lib/security/phrase';
import { isScryptHash } from '@/lib/security/scrypt';
import { issueRecoveryToken } from '@/lib/security/tokens';
import {
  authenticateUser,
  hashLegacyRecoveryPhrases,
  resetCredentialsWithToken,
  setRecoveryPhrase,
  userExists,
  verifyRecovery,
} from '@/lib/server-auth';

import { readJson, removeDir, userPaths, useTempDataDir } from '@tests/support';
import { sha256 } from '@tests/support/hash';

let dataDir: string;

beforeEach(() => {
  dataDir = useTempDataDir();
});

afterEach(() => {
  removeDir(dataDir);
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
  async function setupAccount(
    username = 'recoverer',
    password = 'pass-one-1234',
    phrase = 'alpha beta gamma',
  ) {
    const result = await authenticateUser(username, password);
    const uid = result.user!.uid;
    expect(await setRecoveryPhrase(uid, phrase)).toBe(true);
    return uid;
  }

  const storedPhrase = (uid: string) =>
    readJson(userPaths(dataDir, uid).userFile).recoveryPhrase;

  it('setRecoveryPhrase хранит хэш, а не открытый текст', async () => {
    const uid = await setupAccount();
    const stored = storedPhrase(uid);

    expect(typeof stored).toBe('string');
    expect(stored).not.toContain('alpha');
    expect(isRecoveryPhraseHash(stored)).toBe(true);
    expect(recoveryPhraseMatches(stored, 'Alpha Beta Gamma')).toBe(true);
    expect(
      (await authenticateUser('recoverer', 'pass-one-1234')).user
        ?.hasRecoveryPhrase,
    ).toBe(true);
  });

  it('setRecoveryPhrase возвращает false для пустой фразы и чужого uid', async () => {
    const errorSpy = vi.spyOn(console, 'error').mockImplementation(() => {});
    expect(await setRecoveryPhrase(newUid(), 'alpha beta')).toBe(false);
    const uid = await setupAccount('empty-phrase');
    expect(await setRecoveryPhrase(uid, '   ')).toBe(false);
    errorSpy.mockRestore();
  });

  it('verifyRecovery принимает полную фразу и не зависит от регистра', async () => {
    const uid = await setupAccount();
    const result = await verifyRecovery('Recoverer', '  ALPHA   beta Gamma ');

    expect(result.success).toBe(true);
    expect(result.user?.uid).toBe(uid);
  });

  it('verifyRecovery отклоняет одно слово и частичную фразу', async () => {
    await setupAccount();

    // Раньше совпадало «хотя бы одно слово» — это и был захват.
    for (const partial of ['alpha', 'gamma', 'alpha beta', 'beta alpha']) {
      const result = await verifyRecovery('recoverer', partial);
      expect({ partial, success: result.success }).toEqual({
        partial,
        success: false,
      });
      expect(result.reason).toBe('mismatch');
    }
  });

  it('verifyRecovery не падает на пунктуации и спецсимволах', async () => {
    await setupAccount();
    for (const input of ['.', '(', ')', '[', '$&', '*']) {
      const result = await verifyRecovery('recoverer', input);
      expect({ input, success: result.success }).toEqual({
        input,
        success: false,
      });
    }
  });

  it('verifyRecovery работает на кириллице', async () => {
    const uid = await setupAccount(
      'cyrillic',
      'pass-one-1234',
      '  Синий Кит Фонарь ',
    );
    const result = await verifyRecovery('cyrillic', 'синий кит фонарь');

    expect(result.success).toBe(true);
    expect(result.user?.uid).toBe(uid);
  });

  it('verifyRecovery не требует листов персонажей', async () => {
    // Автор персонажа — не обязательно владелец аккаунта, поэтому листы
    // фактором владения не считаются вовсе.
    await setupAccount('nosheets');
    expect((await verifyRecovery('nosheets', 'alpha beta gamma')).success).toBe(
      true,
    );
  });

  it('verifyRecovery сообщает причины отказа', async () => {
    expect((await verifyRecovery('nobody', 'alpha')).reason).toBe('no_account');
    await authenticateUser('nophrase-level', 'pass-one-1234');
    expect((await verifyRecovery('nophrase-level', 'alpha')).reason).toBe(
      'no_phrase',
    );
  });

  it('verifyRecovery переводит старую открытую фразу в хэш', async () => {
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

    expect(
      (await verifyRecovery('legacy-phrase', 'old amber cobalt')).success,
    ).toBe(true);
    const stored = readJson(paths.userFile).recoveryPhrase;
    expect(isRecoveryPhraseHash(stored)).toBe(true);
    expect(stored).not.toContain('amber');
    // Хэш сохранённой фразы по-прежнему принимает ту же фразу.
    expect(
      (await verifyRecovery('legacy-phrase', 'old amber cobalt')).success,
    ).toBe(true);
    expect((await verifyRecovery('legacy-phrase', 'amber')).success).toBe(
      false,
    );
  });

  it('resetCredentialsWithToken меняет пароль и фразу, старый пароль не работает', async () => {
    const uid = await setupAccount('resetme', 'old-pass-1234');
    const { token } = await issueRecoveryToken(uid);

    const reset = await resetCredentialsWithToken(
      token,
      'fresh-pass-1234',
      '  New Phrase Here ',
    );
    expect(reset.success).toBe(true);
    expect(reset.uid).toBe(uid);

    expect((await authenticateUser('resetme', 'fresh-pass-1234')).success).toBe(
      true,
    );
    expect((await authenticateUser('resetme', 'old-pass-1234')).success).toBe(
      false,
    );
    // Новая фраза сравнивается целиком и хранится хэшем.
    expect((await verifyRecovery('resetme', 'new phrase here')).success).toBe(
      true,
    );
    expect(isRecoveryPhraseHash(storedPhrase(uid))).toBe(true);
  });

  it('сброс по логину без токена невозможен', async () => {
    await setupAccount('victim', 'old-pass-1234');

    expect(
      (await resetCredentialsWithToken('', 'pwned-pass-1234', 'x y z')).success,
    ).toBe(false);
    expect(
      (
        await resetCredentialsWithToken(
          'not-a-token',
          'pwned-pass-1234',
          'x y z',
        )
      ).reason,
    ).toBe('invalid_token');
    // Пароль не изменился.
    expect((await authenticateUser('victim', 'old-pass-1234')).success).toBe(
      true,
    );
    expect((await authenticateUser('victim', 'pwned-pass-1234')).success).toBe(
      false,
    );
  });

  it('токен одноразовый и не переживает лимит времени', async () => {
    const uid = await setupAccount('once', 'old-pass-1234');
    const { token } = await issueRecoveryToken(uid);

    expect(
      (await resetCredentialsWithToken(token, 'first-pass-1234')).success,
    ).toBe(true);
    expect(
      (await resetCredentialsWithToken(token, 'second-pass-1234')).reason,
    ).toBe('invalid_token');

    const expired = await issueRecoveryToken(uid, {
      ttlMs: 1000,
      nowMs: Date.now() - 5000,
    });
    expect(
      (await resetCredentialsWithToken(expired.token, 'third-pass-1234'))
        .success,
    ).toBe(false);
  });

  it('чужой токен не даёт сменить пароль другому аккаунту', async () => {
    await setupAccount('attacker', 'pass-one-1234');
    const victimUid = await setupAccount('victim2', 'old-pass-1234');
    const { token } = await issueRecoveryToken(victimUid);

    // Токен принадлежит жертве; логин атакующего не участвует вовсе.
    expect(
      (await resetCredentialsWithToken(token, 'hijacked-pass-1234')).success,
    ).toBe(true);
    expect(
      (await authenticateUser('victim2', 'hijacked-pass-1234')).success,
    ).toBe(true);
    // Пароль второго (атакующего) аккаунта не изменился.
    expect((await authenticateUser('attacker', 'pass-one-1234')).success).toBe(
      true,
    );
    expect(
      (await authenticateUser('attacker', 'hijacked-pass-1234')).success,
    ).toBe(false);
  });

  it('успешный сброс гасит остальные выданные токены', async () => {
    const uid = await setupAccount('multi-token', 'old-pass-1234');
    const first = await issueRecoveryToken(uid);
    const second = await issueRecoveryToken(uid);

    expect(
      (await resetCredentialsWithToken(first.token, 'new-pass-one-1234'))
        .success,
    ).toBe(true);
    expect(
      (await resetCredentialsWithToken(second.token, 'new-pass-two-1234'))
        .success,
    ).toBe(false);
  });

  it('сброс убирает legacy email и флаг mustChangePassword', async () => {
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
    expect((await verifyRecovery('legacy-mail', 'amber cobalt')).success).toBe(
      true,
    );
    const { token } = await issueRecoveryToken(uid);
    expect(
      (await resetCredentialsWithToken(token, 'fresh-pass-1234')).success,
    ).toBe(true);

    const stored = readJson(paths.userFile);
    expect(stored.email).toBeUndefined();
    expect(stored.mustChangePassword).toBeUndefined();
    expect(stored.username).toBe('legacy-mail');
    expect(isScryptHash(stored.passwordHash)).toBe(true);
    expect(verifyPassword(stored.passwordHash, 'fresh-pass-1234').valid).toBe(
      true,
    );
    expect(await userExists(uid)).toBe(true);
  });

  it('hashLegacyRecoveryPhrases переводит открытые фразы в хэши идемпотентно', async () => {
    const plainUid = await setupAccount('migrate-me', 'pass-one-1234');
    // Имитируем старые данные: записываем фразу открытым текстом.
    const paths = userPaths(dataDir, plainUid);
    const raw = readJson(paths.userFile);
    raw.recoveryPhrase = 'plain amber cobalt';
    fs.writeFileSync(paths.userFile, JSON.stringify(raw, null, 2));

    const hashedUid = await setupAccount(
      'already-hashed',
      'pass-one-1234',
      'kept phrase',
    );
    const hashedBefore = storedPhrase(hashedUid);

    const report = await hashLegacyRecoveryPhrases();
    expect(report.updated).toBeGreaterThanOrEqual(1);
    expect(isRecoveryPhraseHash(storedPhrase(plainUid))).toBe(true);
    expect(
      recoveryPhraseMatches(storedPhrase(plainUid), 'plain amber cobalt'),
    ).toBe(true);
    // Уже захешированная фраза не переписывается.
    expect(storedPhrase(hashedUid)).toBe(hashedBefore);

    expect((await hashLegacyRecoveryPhrases()).updated).toBe(0);
  });
});
