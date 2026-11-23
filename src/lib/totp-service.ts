import { withDataLock } from './data-lock';
import { verifyPasswordAsync } from './security/password';
import {
  decryptTotpSecret,
  encryptTotpSecret,
  findBackupCodeIndex,
  generateBackupCodes,
  generateTotpSecret,
  getTotpKey,
  hashBackupCode,
  totpOtpauthUri,
  verifyTotpCode,
} from './security/totp';
import {
  readStoredUser,
  writeStoredUser,
  type StoredUser,
} from './user-schema';

/**
 * ─── LANDMARK: TOTP ENROLLMENT ─────────────────────────────────────────────
 * Enrollment и управление вторым фактором. Пароль требуется на каждом шаге:
 * включение TOTP по одной cookie было бы обходом SEC-21. Секрет возвращается
 * ровно один раз (setup), backup-коды — ровно один раз (enable/regenerate).
 */

export type TotpFailureReason =
  | 'not_found'
  | 'invalid_password'
  | 'totp_unavailable'
  | 'totp_already_enabled'
  | 'totp_not_enabled'
  | 'totp_pending_missing'
  | 'totp_invalid'
  | 'failed';

export interface TotpFailure {
  success: false;
  reason: TotpFailureReason;
  error: string;
}

interface TotpSetupSuccess {
  success: true;
  secret: string;
  otpauthUri: string;
}

interface TotpEnabledSuccess {
  success: true;
  backupCodes: string[];
}

interface TotpDisabledSuccess {
  success: true;
}

type Result<T> = T | TotpFailure;

function failure(reason: TotpFailureReason, error: string): TotpFailure {
  return { success: false, reason, error };
}

async function verifyCurrentPassword(
  uid: string,
  password: string | undefined,
): Promise<{ ok: true; user: StoredUser } | TotpFailure> {
  if (!password) {
    return failure('invalid_password', 'Current password is incorrect.');
  }
  const user = await readStoredUser(uid);
  if (!user) return failure('not_found', 'User not found.');
  const check = await verifyPasswordAsync(user.passwordHash, password);
  if (!check.valid) {
    return failure('invalid_password', 'Current password is incorrect.');
  }
  return { ok: true, user };
}

/** Шаг 1: сгенерировать секрет и сохранить его как «ожидающий». */
export async function startTotpSetup(
  uid: string,
  currentPassword: string | undefined,
): Promise<Result<TotpSetupSuccess>> {
  const key = getTotpKey();
  if (!key) {
    return failure(
      'totp_unavailable',
      'Two-factor authentication is not configured on this installation.',
    );
  }
  const passwordCheck = await verifyCurrentPassword(uid, currentPassword);
  if ('success' in passwordCheck) return passwordCheck;
  if (passwordCheck.user.totp?.enabledAt) {
    return failure(
      'totp_already_enabled',
      'Two-factor authentication is already enabled.',
    );
  }

  const secret = generateTotpSecret();
  const encrypted = encryptTotpSecret(secret, key, uid);
  const result = await withDataLock(
    async (): Promise<Result<TotpSetupSuccess>> => {
      const user = await readStoredUser(uid);
      if (!user) return failure('not_found', 'User not found.');
      await writeStoredUser(uid, {
        ...user,
        totp: { secret: encrypted },
        totpBackupCodes: [],
        updatedAt: new Date().toISOString(),
      });
      return {
        success: true,
        secret,
        otpauthUri: totpOtpauthUri(secret, user.username),
      };
    },
  );
  return result;
}

/** Шаг 2: подтвердить код, включить TOTP и выдать backup-коды один раз. */
export async function enableTotp(
  uid: string,
  code: string | undefined,
): Promise<Result<TotpEnabledSuccess>> {
  const key = getTotpKey();
  if (!key) {
    return failure(
      'totp_unavailable',
      'Two-factor authentication is not configured on this installation.',
    );
  }
  return withDataLock(async (): Promise<Result<TotpEnabledSuccess>> => {
    const user = await readStoredUser(uid);
    if (!user) return failure('not_found', 'User not found.');
    if (!user.totp?.secret) {
      return failure('totp_pending_missing', 'Start two-factor setup first.');
    }
    if (user.totp.enabledAt) {
      return failure(
        'totp_already_enabled',
        'Two-factor authentication is already enabled.',
      );
    }
    const secret = decryptTotpSecret(user.totp.secret, key, uid);
    if (!secret) {
      return failure(
        'totp_unavailable',
        'Two-factor authentication is temporarily unavailable.',
      );
    }
    const step = verifyTotpCode(secret, code ?? '', Date.now());
    if (step === null) {
      return failure('totp_invalid', 'Invalid two-factor authentication code.');
    }
    const backupCodes = generateBackupCodes();
    await writeStoredUser(uid, {
      ...user,
      totp: {
        secret: user.totp.secret,
        enabledAt: new Date().toISOString(),
        lastStep: step,
      },
      totpBackupCodes: backupCodes.map((value) =>
        hashBackupCode(value, key, uid),
      ),
      updatedAt: new Date().toISOString(),
    });
    return { success: true, backupCodes };
  });
}

/** Выключить TOTP: нужны пароль и действующий код (или backup-код). */
export async function disableTotp(
  uid: string,
  currentPassword: string | undefined,
  code: string | undefined,
): Promise<Result<TotpDisabledSuccess>> {
  const key = getTotpKey();
  if (!key) {
    return failure(
      'totp_unavailable',
      'Two-factor authentication is not configured on this installation.',
    );
  }
  const passwordCheck = await verifyCurrentPassword(uid, currentPassword);
  if ('success' in passwordCheck) return passwordCheck;
  if (!passwordCheck.user.totp?.enabledAt) {
    return failure(
      'totp_not_enabled',
      'Two-factor authentication is not enabled.',
    );
  }
  const secret = decryptTotpSecret(passwordCheck.user.totp.secret, key, uid);
  if (!secret) {
    return failure(
      'totp_unavailable',
      'Two-factor authentication is temporarily unavailable.',
    );
  }
  const candidate = code ?? '';
  const validCode =
    verifyTotpCode(secret, candidate, Date.now()) !== null ||
    findBackupCodeIndex(
      candidate,
      passwordCheck.user.totpBackupCodes ?? [],
      key,
      uid,
    ) !== -1;
  if (!validCode) {
    return failure('totp_invalid', 'Invalid two-factor authentication code.');
  }

  return withDataLock(async (): Promise<Result<TotpDisabledSuccess>> => {
    const user = await readStoredUser(uid);
    if (!user) return failure('not_found', 'User not found.');
    const updated = { ...user };
    delete updated.totp;
    delete updated.totpBackupCodes;
    updated.updatedAt = new Date().toISOString();
    await writeStoredUser(uid, updated);
    return { success: true };
  });
}

/** Перегенерировать backup-коды (старые сразу перестают работать). */
export async function regenerateBackupCodes(
  uid: string,
  currentPassword: string | undefined,
): Promise<Result<TotpEnabledSuccess>> {
  const key = getTotpKey();
  if (!key) {
    return failure(
      'totp_unavailable',
      'Two-factor authentication is not configured on this installation.',
    );
  }
  const passwordCheck = await verifyCurrentPassword(uid, currentPassword);
  if ('success' in passwordCheck) return passwordCheck;
  if (!passwordCheck.user.totp?.enabledAt) {
    return failure(
      'totp_not_enabled',
      'Two-factor authentication is not enabled.',
    );
  }
  const backupCodes = generateBackupCodes();
  const result = await withDataLock(
    async (): Promise<Result<TotpEnabledSuccess>> => {
      const user = await readStoredUser(uid);
      if (!user) return failure('not_found', 'User not found.');
      await writeStoredUser(uid, {
        ...user,
        totpBackupCodes: backupCodes.map((value) =>
          hashBackupCode(value, key, uid),
        ),
        updatedAt: new Date().toISOString(),
      });
      return { success: true, backupCodes };
    },
  );
  return result;
}
