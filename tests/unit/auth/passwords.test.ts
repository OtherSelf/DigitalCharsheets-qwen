/**
 * Пароли: миграция legacy sha256 → scrypt и политика длины (SEC-7).
 */

import fs from 'node:fs';

import { afterEach, beforeEach, describe, expect, it } from 'vitest';

import { newUid } from '@/lib/ids';
import { verifyPassword } from '@/lib/security/password';
import { isScryptHash } from '@/lib/security/scrypt';
import { issueRecoveryToken } from '@/lib/security/tokens';
import {
  authenticateUser,
  registerUser,
  resetCredentialsWithToken,
  updateUserProfile,
} from '@/lib/server-auth';
import { resetLoginIndexRebuildCooldown, resolveLogin } from '@/lib/user-index';

import { readJson, removeDir, userPaths, useTempDataDir } from '@tests/support';
import { sha256 } from '@tests/support/hash';

let dataDir: string;

beforeEach(() => {
  dataDir = useTempDataDir();
});

afterEach(() => {
  removeDir(dataDir);
});

describe('пароли: миграция хэшей и политика (SEC-7)', () => {
  it('старый sha256-аккаунт входит и получает scrypt-хэш', async () => {
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

    const result = await authenticateUser('legacy-hash', 'legacy-pass-1234');
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
    expect(
      (await authenticateUser('legacy-hash', 'legacy-pass-1234')).success,
    ).toBe(true);
    expect(
      (await authenticateUser('legacy-hash', 'wrong-pass-1234')).success,
    ).toBe(false);
  });

  it('неверный пароль не переписывает устаревший хэш', async () => {
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

    expect(
      (await authenticateUser('legacy-stays', 'other-pass-1234')).success,
    ).toBe(false);
    expect(readJson(paths.userFile).passwordHash).toBe(legacyHash);
  });

  it('registerUser и updateUserProfile требуют минимум 12 символов', async () => {
    const tooShort = await registerUser(
      'short-pw',
      'short123',
      'Short',
      'amber cobalt',
    );
    expect(tooShort.success).toBe(false);
    expect(tooShort.reason).toBe('invalid_input');
    expect(tooShort.error).toContain('at least 12');

    const created = await authenticateUser('policy-user', 'valid-pass-1234');
    const uid = created.user!.uid;
    const before = readJson(userPaths(dataDir, uid).userFile).passwordHash;

    const update = await updateUserProfile(
      uid,
      'policy-user',
      'Policy',
      'short123',
    );
    expect(update.success).toBe(false);
    expect(update.error).toContain('at least 12');
    // Неудачная валидация не трогает профиль.
    expect(readJson(userPaths(dataDir, uid).userFile).passwordHash).toBe(
      before,
    );

    // Пустая строка — это «не менять пароль», а не «установить пустой».
    expect(
      (await updateUserProfile(uid, 'policy-user', 'Policy', '   ')).success,
    ).toBe(true);
  });

  it('resetCredentialsWithToken требует минимум 12 символов', async () => {
    const uid = (await authenticateUser('reset-policy', 'valid-pass-1234'))
      .user!.uid;
    const { token } = await issueRecoveryToken(uid);

    const tooShort = await resetCredentialsWithToken(token, 'short123');
    expect(tooShort.success).toBe(false);
    expect(tooShort.reason).toBe('invalid_input');
    // Пароль не сменился, а токен не сгорел на валидации.
    expect(
      (await authenticateUser('reset-policy', 'valid-pass-1234')).success,
    ).toBe(true);
    expect(
      (await resetCredentialsWithToken(token, 'fresh-valid-1234')).success,
    ).toBe(true);
  });

  it('resolveLogin пересобирает индекс не чаще раза в минуту', async () => {
    await authenticateUser('index-known', 'valid-pass-1234');
    resetLoginIndexRebuildCooldown();

    // Первый промах — пересборка разрешена (индекс перечитывается с диска).
    expect(await resolveLogin('ghost-one')).toBeNull();

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
    expect(await resolveLogin('late-user')).toBeNull();

    // После сброса троттлинга тот же логин находится: значит, дело было
    // именно в пропущенном скане, а не в отсутствии данных.
    resetLoginIndexRebuildCooldown();
    expect(await resolveLogin('late-user')).toBe(lateUid);
  });
});
