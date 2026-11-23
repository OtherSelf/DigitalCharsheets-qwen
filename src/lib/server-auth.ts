import fs from 'fs/promises';

import { getUserFile } from './data-dir';
import { withDataLock } from './data-lock';
import { defaultDisplayName, isUid, newUid, normalizeLogin } from './ids';
import { LocalUser } from './local-storage';
import {
  hashPassword,
  hashPasswordAsync,
  passwordPolicyError,
  verifyPasswordAsync,
} from './security/password';
import {
  hashRecoveryPhraseAsync,
  isRecoveryPhraseHash,
  normalizePhrase,
  recoveryPhraseMatchesAsync,
} from './security/phrase';
import { phrasePolicyError } from './security/phrase-policy';
import { isCurrentScryptParams } from './security/scrypt';
import { revokeAllSessionsForUser } from './security/sessions';
import {
  consumeRecoveryToken,
  revokeRecoveryTokensForUser,
} from './security/tokens';
import {
  decryptTotpSecret,
  findBackupCodeIndex,
  getTotpKey,
  verifyTotpCode,
} from './security/totp';
import { resetWriteSeqGuard } from './server-storage';
import { revokeSharesForUser } from './shares';
import { moveAccountToTrash } from './trash';
import {
  readLoginIndexForUpdate,
  rebuildLoginIndex,
  resolveLogin,
  writeLoginIndex,
} from './user-index';
import { normalizeUserRole, type UserRole } from './user-role';
import {
  readStoredUser,
  scanUserRecords,
  USER_SCHEMA_VERSION,
  writeStoredUser,
  type StoredUser,
} from './user-schema';

/**
 * ─── LANDMARK: USER IDENTITY / AUTH ─────────────────────────────────────────
 * Личность пользователя — неизменяемый `uid` (UUID), который живёт в
 * `users/<uid>/user.json`. Логин (`username`) — изменяемый атрибут и ключ
 * индекса `index/logins.json`.
 *
 * Поэтому:
 *   • смена логина НЕ переносит каталог и не трогает листы — меняются две
 *     строки (user.json и запись в индексе);
 *   • регистрация идёт под файловым локом, чтобы два одновременных входа с
 *     одним логином не создали два аккаунта;
 *   • вход не зависит от формата логина: `Hero@Example.com` и
 *     `  hero@example.com ` — один и тот же ключ.
 *
 * Пароль хранится как scrypt-хэш с солью и версией формата
 * (`security/password.ts`); legacy sha256 читается один раз и перехэшируется
 * при входе (`needsRehash`).
 */

export type { StoredUser } from './user-schema';

interface AuthResult {
  success: boolean;
  user?: LocalUser;
  error?: string;
  isNewUser?: boolean;
  /**
   * Машиночитаемая причина отказа (чтобы роуты выбирали HTTP-статус, а UI —
   * локализованный текст, не разбирая английскую строку ошибки):
   *   no_account       — логин свободен, но вход запрещён (регистрация отдельно);
   *   invalid_password — аккаунт есть, пароль не совпал;
   *   blocked          — аккаунт заблокирован администратором;
   *   exists           — регистрация отклонена: логин уже занят;
   *   invalid_phrase   — не прошла политика recovery-фразы;
   *   totp_required    — пароль верный, но нужен второй фактор;
   *   totp_invalid     — код/backup-код не подошёл или уже использован;
   *   totp_unavailable — TOTP включён, но ключ `DCS_TOTP_KEY` недоступен;
   *   invalid_input    — не прошли серверные проверки полей.
   */
  reason?:
    | 'no_account'
    | 'invalid_password'
    | 'blocked'
    | 'exists'
    | 'invalid_phrase'
    | 'totp_required'
    | 'totp_invalid'
    | 'totp_unavailable'
    | 'invalid_input';
}

export interface AuthenticateOptions {
  /**
   * `false` — режим «только вход»: свободный логин НЕ создаёт аккаунт, а
   * возвращает `reason: 'no_account'`. Так работает POST /api/auth; отдельная
   * регистрация — POST /api/auth/register.
   *
   * По умолчанию `true`, чтобы внутренние сценарии (миграция, тесты,
   * скрипты) могли по-прежнему создавать аккаунт первым входом.
   */
  allowRegistration?: boolean;
  /** Код TOTP или backup-код; проверяется только при включённом TOTP. */
  totpCode?: string;
}

/**
 * Хэш пароля живёт в `security/password.ts` (scrypt + соль); реэкспорт нужен,
 * чтобы админка и служебные скрипты не тянули приватный путь модуля.
 */
export { hashPassword } from './security/password';

/**
 * Публичный снимок профиля для UI. `role`/`isBlocked` нужны клиенту, чтобы
 * показать пункт «Админка» и предупреждение о сгенерированном пароле, но
 * никаких прав они не дают: сервер каждый раз проверяет роль сам.
 */
export function toLocalUser(user: StoredUser): LocalUser {
  return {
    uid: user.uid,
    username: user.username,
    displayName: user.displayName,
    hasRecoveryPhrase: !!user.recoveryPhrase,
    role: normalizeUserRole(user.role),
    isBlocked: !!user.isBlocked,
    mustChangePassword: !!user.mustChangePassword,
    totpEnabled: !!user.totp?.enabledAt,
  };
}

export async function userExists(uid: string): Promise<boolean> {
  try {
    await fs.access(getUserFile(uid));
    return true;
  } catch {
    return false;
  }
}

/**
 * Прочитать профиль по uid. Терпимо к старым/ручным файлам: `uid` берётся из
 * каталога, если в JSON его нет, а `email` считается логином. Сама
 * нормализация живёт в `user-schema.ts` (её же использует startup-проверка).
 */
export async function getStoredUser(uid: string): Promise<StoredUser | null> {
  return readStoredUser(uid);
}

/**
 * Перезаписать устаревший хэш пароля (sha256 → scrypt). Вызывается только
 * после успешной проверки, поэтому пароль уже известен.
 *
 * `locked` — вызывающий уже держит `withDataLock` (вход по «протухшему»
 * индексу рождается внутри лока): вложенный лок — это взаимоблокировка.
 */
async function rehashPassword(
  stored: StoredUser,
  password: string,
  options: { locked: boolean },
): Promise<StoredUser> {
  const write = async (): Promise<StoredUser> => {
    const fresh = (await readStoredUser(stored.uid)) ?? stored;
    // Пока проверялся пароль, его могли сменить: перезаписываем только если
    // на диске всё ещё старый хэш от этого же пароля.
    if (!(await verifyPasswordAsync(fresh.passwordHash, password)).needsRehash)
      return fresh;
    const updated: StoredUser = {
      ...fresh,
      passwordHash: await hashPasswordAsync(password),
      updatedAt: new Date().toISOString(),
    };
    await writeStoredUser(stored.uid, updated);
    return updated;
  };

  try {
    return options.locked ? await write() : await withDataLock(write);
  } catch (e) {
    // Вход не должен падать из-за оптимизации хранения: следующий вход
    // попробует миграцию снова.
    console.error('Failed to migrate password hash:', e);
    return stored;
  }
}

async function authenticateExisting(
  uid: string,
  password: string,
  options: { locked?: boolean; totpCode?: string } = {},
): Promise<AuthResult> {
  let stored = await getStoredUser(uid);
  if (!stored) {
    // Индекс мог устареть (например, каталог удалили руками) — пересобираем.
    await rebuildLoginIndex();
    stored = await getStoredUser(uid);
  }
  if (!stored) {
    return {
      success: false,
      error: 'Failed to read user data.',
      reason: 'no_account',
    };
  }

  const check = await verifyPasswordAsync(stored.passwordHash, password);
  if (!check.valid) {
    return {
      success: false,
      error: 'Incorrect password.',
      reason: 'invalid_password',
    };
  }
  // Блокировку проверяем после пароля: иначе по ответу можно было бы узнать,
  // что аккаунт существует, не зная его пароля.
  if (stored.isBlocked) {
    return {
      success: false,
      error: 'This account is blocked by an administrator.',
      reason: 'blocked',
    };
  }
  // Второй фактор проверяется только после верного пароля: иначе ответ
  // `totp_required` выдавал бы существование аккаунта.
  if (stored.totp?.enabledAt) {
    const key = getTotpKey();
    if (!key) {
      return {
        success: false,
        error: 'Two-factor authentication is temporarily unavailable.',
        reason: 'totp_unavailable',
      };
    }
    const code = (options.totpCode ?? '').trim();
    if (!code) {
      return {
        success: false,
        error: 'Two-factor authentication code is required.',
        reason: 'totp_required',
      };
    }
    const secret = decryptTotpSecret(stored.totp.secret, key, stored.uid);
    if (!secret) {
      return {
        success: false,
        error: 'Two-factor authentication is temporarily unavailable.',
        reason: 'totp_unavailable',
      };
    }
    const step = verifyTotpCode(secret, code, Date.now());
    if (step !== null) {
      if (stored.totp.lastStep !== undefined && step <= stored.totp.lastStep) {
        return {
          success: false,
          error: 'Two-factor authentication code has already been used.',
          reason: 'totp_invalid',
        };
      }
      stored = await updateTotpState(
        stored,
        { lastStep: step },
        options.locked,
      );
    } else {
      const backupIndex = findBackupCodeIndex(
        code,
        stored.totpBackupCodes ?? [],
        key,
        stored.uid,
      );
      if (backupIndex === -1) {
        return {
          success: false,
          error: 'Invalid two-factor authentication code.',
          reason: 'totp_invalid',
        };
      }
      stored = await updateTotpState(
        stored,
        { usedBackupIndex: backupIndex },
        options.locked,
      );
    }
  }

  if (check.needsRehash) {
    stored = await rehashPassword(stored, password, {
      locked: options.locked === true,
    });
  }
  return {
    success: true,
    isNewUser: false,
    user: toLocalUser(await touchLastLogin(stored)),
  };
}

/**
 * Обновить TOTP-состояние после входа: последний шаг (anti-replay) или
 * израсходованный backup-код. `locked` — вызывающий уже держит глобальный лок.
 */
async function updateTotpState(
  stored: StoredUser,
  update: { lastStep?: number; usedBackupIndex?: number },
  locked?: boolean,
): Promise<StoredUser> {
  const write = async (): Promise<StoredUser> => {
    const fresh = (await readStoredUser(stored.uid)) ?? stored;
    const currentTotp = fresh.totp;
    if (!currentTotp?.enabledAt) return fresh;
    const updated: StoredUser = {
      ...fresh,
      totp: { ...currentTotp },
      updatedAt: new Date().toISOString(),
    };
    if (update.lastStep !== undefined) {
      updated.totp = { ...currentTotp, lastStep: update.lastStep };
    }
    if (update.usedBackupIndex !== undefined) {
      updated.totpBackupCodes = (fresh.totpBackupCodes ?? []).filter(
        (_code, index) => index !== update.usedBackupIndex,
      );
    }
    await writeStoredUser(stored.uid, updated);
    return updated;
  };
  try {
    return locked ? await write() : await withDataLock(write);
  } catch (e) {
    // Вход не должен падать из-за best-effort обновления anti-replay:
    // код уже проверен, но повтор в окне возможен — это лучше 500.
    console.error('Failed to update TOTP state:', e);
    return stored;
  }
}

/**
 * Отметить успешный вход. Пишем без лока: это «activity», а не профиль, и
 * потеря отметки при гонке с админской правкой не критична. Лок здесь был бы
 * опасен: `authenticateExisting` вызывается и внутри уже взятого лока.
 *
 * Перед записью перечитываем профиль: пока шла проверка пароля, админ мог
 * сменить логин/роль/пароль, и запись устаревшего снимка откатила бы правку.
 * Атомарность «прочитал-записал» всё равно не гарантируется, но окно гонки
 * сужается до минимума, а чужие изменения не затираются снимком из начала
 * входа.
 */
async function touchLastLogin(stored: StoredUser): Promise<StoredUser> {
  try {
    const fresh = (await readStoredUser(stored.uid)) ?? stored;
    const updated: StoredUser = {
      ...fresh,
      lastLoginAt: new Date().toISOString(),
    };
    await writeStoredUser(stored.uid, updated);
    return updated;
  } catch (error) {
    console.error('Failed to update last login time:', error);
    return stored;
  }
}

/** Есть ли аккаунт с таким логином (регистр/пробелы нормализуются). */
export async function accountExists(username: string): Promise<boolean> {
  return (await resolveLogin(username)) !== null;
}

interface NewAccountOptions {
  role?: UserRole;
  mustChangePassword?: boolean;
}

/**
 * Создать профиль и запись в индексе. Вызывать только под `withDataLock`,
 * после проверки, что логин свободен.
 *
 * `options` нужен только служебному администратору (роль `admin` и флаг
 * «пароль сгенерирован»); обычная регистрация всегда создаёт `user`.
 */
async function persistNewAccount(
  login: string,
  passwordHash: string,
  displayName?: string,
  recoveryPhrase?: string,
  options: NewAccountOptions = {},
): Promise<AuthResult> {
  const uid = newUid();
  const now = new Date().toISOString();
  const user: StoredUser = {
    schemaVersion: USER_SCHEMA_VERSION,
    uid,
    username: login,
    displayName:
      (displayName && displayName.trim()) || defaultDisplayName(login),
    passwordHash,
    role: normalizeUserRole(options.role),
    isBlocked: false,
    createdAt: now,
    updatedAt: now,
  };

  if (recoveryPhrase !== undefined && recoveryPhrase.trim() !== '') {
    // На диск — только хэш: фраза доказывает владение аккаунтом (см.
    // security/phrase.ts).
    user.recoveryPhrase = await hashRecoveryPhraseAsync(recoveryPhrase);
  }
  if (options.mustChangePassword) {
    user.mustChangePassword = true;
  }

  await writeStoredUser(uid, user);

  const index = await readLoginIndexForUpdate();
  index.logins[login] = uid;
  try {
    await writeLoginIndex(index);
  } catch (e) {
    // Источник истины — user.json; индекс пересоберётся при следующем входе.
    console.error('Failed to update login index:', e);
  }

  return { success: true, isNewUser: true, user: toLocalUser(user) };
}

/**
 * Регистрация нового аккаунта с явно заданной recovery-фразой.
 *
 * Отличие от `authenticateUser`: занятый логин — это ошибка (`reason:
 * 'exists'`), а не вход в существующий аккаунт. Вызывается из
 * `POST /api/auth/register`.
 */
export async function registerUser(
  username: string,
  password: string,
  displayName: string | undefined,
  recoveryPhrase: string,
): Promise<AuthResult> {
  const login = normalizeLogin(username);
  if (!login) {
    return {
      success: false,
      error: 'Username/Email is required.',
      reason: 'invalid_input',
    };
  }
  const policyError = passwordPolicyError(password);
  if (policyError) {
    return {
      success: false,
      error: policyError,
      reason: 'invalid_input',
    };
  }
  const phraseError = phrasePolicyError(recoveryPhrase);
  if (phraseError) {
    return {
      success: false,
      error: phraseError,
      reason: 'invalid_phrase',
    };
  }

  if (await resolveLogin(login)) {
    return {
      success: false,
      error: 'This login is already registered.',
      reason: 'exists',
    };
  }

  // Регистрация под локом: иначе два параллельных запроса заведут два
  // аккаунта с одним логином.
  return withDataLock(async () => {
    const index = await readLoginIndexForUpdate();
    if (index.logins[login]) {
      return {
        success: false,
        error: 'This login is already registered.',
        reason: 'exists',
      } as AuthResult;
    }
    return persistNewAccount(
      login,
      await hashPasswordAsync(password),
      displayName,
      recoveryPhrase,
    );
  });
}

/**
 * Вход или регистрация. Новый аккаунт создаётся только при первом входе с
 * этим логином; uid выдаётся здесь и больше не меняется.
 *
 * `options.allowRegistration: false` включает режим «только вход»: свободный
 * логин возвращает `reason: 'no_account'` и ничего не пишет на диск. Именно
 * так работает `POST /api/auth` — на странице /login регистрация отдельная.
 */
export async function authenticateUser(
  username: string,
  password: string,
  displayName?: string,
  options: AuthenticateOptions = {},
): Promise<AuthResult> {
  const login = normalizeLogin(username);

  if (!login) {
    return {
      success: false,
      error: 'Username/Email is required.',
      reason: 'invalid_input',
    };
  }

  const existingUid = await resolveLogin(login);
  if (existingUid) {
    return authenticateExisting(existingUid, password, {
      totpCode: options.totpCode,
    });
  }

  if (options.allowRegistration === false) {
    return {
      success: false,
      error:
        'No account found with this username/email. Create an account first.',
      reason: 'no_account',
    };
  }

  // Регистрация: проверка «логин свободен» и создание каталога — под локом,
  // иначе два параллельных запроса заведут два аккаунта с одним логином.
  return withDataLock(async () => {
    const index = await readLoginIndexForUpdate();
    const racedUid = index.logins[login];
    // Лок уже взят: миграция хэша должна писать без вложенного лока.
    if (racedUid)
      return authenticateExisting(racedUid, password, {
        locked: true,
        totpCode: options.totpCode,
      });

    return persistNewAccount(
      login,
      await hashPasswordAsync(password),
      displayName,
    );
  });
}

/**
 * Обновить профиль. `currentUserId` — неизменяемый uid из сессии.
 * Смена логина меняет только user.json и индекс; каталог с листами остаётся
 * на месте.
 */
export interface UpdateProfileOptions {
  /**
   * Текущий пароль. Обязателен при смене пароля: одной сессии для этого мало
   * (unlocked-устройство не должно терять аккаунт одним запросом).
   */
  currentPassword?: string;
}

export interface UpdateProfileResult {
  success: boolean;
  user?: LocalUser;
  error?: string;
  reason?:
    'not_found' | 'invalid_input' | 'invalid_phrase' | 'invalid_password';
}

export async function updateUserProfile(
  currentUserId: string,
  newUsername: string,
  newDisplayName: string,
  newPassword?: string,
  newRecoveryPhrase?: string,
  options: UpdateProfileOptions = {},
): Promise<UpdateProfileResult> {
  const stored = await getStoredUser(currentUserId);
  if (!stored) {
    return { success: false, reason: 'not_found', error: 'User not found.' };
  }

  const changesPassword = !!newPassword && newPassword.trim() !== '';
  if (changesPassword) {
    const policyError = passwordPolicyError(newPassword);
    if (policyError) {
      return { success: false, reason: 'invalid_input', error: policyError };
    }
  }
  if (newRecoveryPhrase !== undefined && newRecoveryPhrase.trim() !== '') {
    const phraseError = phrasePolicyError(newRecoveryPhrase);
    if (phraseError) {
      return {
        success: false,
        reason: 'invalid_phrase',
        error: phraseError,
      };
    }
  }

  const newLogin = normalizeLogin(newUsername);
  if (!newLogin) {
    return {
      success: false,
      reason: 'invalid_input',
      error: 'Username is required.',
    };
  }

  const oldLogin = normalizeLogin(stored.username);
  const displayName = (newDisplayName || '').trim() || stored.displayName;

  try {
    return withDataLock(async (): Promise<UpdateProfileResult> => {
      // Перечитываем под локом: между проверкой и записью пароль мог сменить
      // администратор, и сверять текущий пароль нужно с актуальным файлом.
      const current = await getStoredUser(currentUserId);
      if (!current) {
        return {
          success: false,
          reason: 'not_found',
          error: 'User not found.',
        };
      }

      // Новый пароль или новая фраза — это смена секрета аккаунта: одной
      // живой cookie для неё мало (SEC-21). Логин/имя меняются без пароля.
      if (changesPassword || newRecoveryPhrase !== undefined) {
        const check = await verifyPasswordAsync(
          current.passwordHash,
          options.currentPassword ?? '',
        );
        if (!check.valid) {
          return {
            success: false,
            reason: 'invalid_password',
            error: 'Current password is incorrect.',
          };
        }
      }

      const index = await readLoginIndexForUpdate();

      if (newLogin !== oldLogin) {
        const owner = index.logins[newLogin];
        if (owner && owner !== currentUserId) {
          return { success: false, error: 'This login is already taken.' };
        }
      }

      const updated: StoredUser = {
        ...current,
        schemaVersion: USER_SCHEMA_VERSION,
        uid: currentUserId,
        username: newLogin,
        displayName,
        role: normalizeUserRole(current.role),
        isBlocked: !!current.isBlocked,
        passwordHash: changesPassword
          ? await hashPasswordAsync(newPassword as string)
          : current.passwordHash,
        updatedAt: new Date().toISOString(),
      };

      // Сменили сгенерированный стартовый пароль — предупреждение больше не
      // нужно.
      if (changesPassword) {
        delete updated.mustChangePassword;
      }

      if (newRecoveryPhrase !== undefined) {
        if (newRecoveryPhrase.trim() === '') {
          delete updated.recoveryPhrase;
        } else {
          updated.recoveryPhrase =
            await hashRecoveryPhraseAsync(newRecoveryPhrase);
        }
      }

      // user.json первым: он источник истины. Если запись индекса не удастся,
      // resolveLogin при промахе пересоберёт индекс из этого файла.
      await writeStoredUser(currentUserId, updated);

      if (newLogin !== oldLogin) {
        delete index.logins[oldLogin];
        index.logins[newLogin] = currentUserId;
        try {
          await writeLoginIndex(index);
        } catch (e) {
          console.error('Failed to update login index after rename:', e);
          await rebuildLoginIndex();
        }
      }

      return { success: true, user: toLocalUser(updated) };
    });
  } catch (e) {
    console.error('Error updating user profile:', e);
    return {
      success: false,
      error: `Failed to update profile: ${e instanceof Error ? e.message : 'Unknown error'}`,
    };
  }
}

/**
 * ─── LANDMARK: ACCOUNT DELETION ─────────────────────────────────────────────
 * Удаление своего профиля. Необратимо: стирается каталог `users/<uid>` целиком
 * (user.json + все листы персонажей) и запись из индекса логинов. Восстановить
 * данные после этого нельзя — «отмена» ищет файлы, которых больше нет.
 *
 * Защита: uid обязан быть UUID (он приходит из подписанной cookie, но путь
 * проверяем отдельно — `rm -rf` не должен зависеть от того, что подпись
 * оказалась валидной), а пароль сверяется с хэшем из `user.json`
 * (`verifyPasswordAsync`: scrypt, legacy sha256 — с перехэшированием). Пароль
 * проверяется ПОД локом, чтобы параллельная смена пароля не дала удалить
 * аккаунт по старому значению.
 *
 * Порядок операций: сначала каталог, потом индекс. Если процесс упадёт между
 * ними, в индексе останется запись на несуществующий uid — `authenticateExisting`
 * такой случай переживает (пересобирает индекс и отвечает `no_account`).
 */
export interface DeleteAccountResult {
  success: boolean;
  error?: string;
  reason?: 'invalid_input' | 'invalid_password' | 'not_found' | 'failed';
}

export async function deleteUserAccount(
  uid: string,
  password: string,
): Promise<DeleteAccountResult> {
  if (!isUid(uid)) {
    return { success: false, error: 'User not found.', reason: 'not_found' };
  }
  if (typeof password !== 'string' || password.trim() === '') {
    return {
      success: false,
      error: 'Password is required.',
      reason: 'invalid_input',
    };
  }

  try {
    const result = await withDataLock(
      async (): Promise<DeleteAccountResult> => {
        const stored = await getStoredUser(uid);
        if (!stored) {
          return {
            success: false,
            error: 'User not found.',
            reason: 'not_found',
          };
        }
        if (!(await verifyPasswordAsync(stored.passwordHash, password)).valid) {
          return {
            success: false,
            error: 'Incorrect password.',
            reason: 'invalid_password',
          };
        }

        // Убираем из индекса все логины, указывающие на этот uid (обычно один).
        const index = await readLoginIndexForUpdate();
        for (const [login, owner] of Object.entries(index.logins)) {
          if (owner === uid) delete index.logins[login];
        }

        // Каталог не удаляем безвозвратно: теневая копия живёт
        // TRASH_RETENTION_DAYS и чистится стартовым обслуживанием.
        const moved = await moveAccountToTrash(uid);
        if (!moved) {
          return {
            success: false,
            error: 'Failed to move the account to trash.',
            reason: 'failed',
          };
        }

        try {
          await writeLoginIndex(index);
        } catch (e) {
          // Индекс производный: его можно (и нужно) пересобрать из user.json
          // оставшихся аккаунтов, чтобы удалённый логин точно не занимал uid.
          console.error('Failed to update login index after deletion:', e);
          await rebuildLoginIndex();
        }

        // In-memory карта порядка записей тоже не должна помнить удалённый лист.
        resetWriteSeqGuard(uid);

        return { success: true };
      },
    );

    // Выданные токены, сессии и гостевые ссылки пережили бы удаление профиля:
    // гасим. Ссылки лежат в общем shares.json, а не в каталоге пользователя.
    if (result.success) {
      try {
        await revokeRecoveryTokensForUser(uid);
        await revokeAllSessionsForUser(uid);
        await revokeSharesForUser(uid);
      } catch (e) {
        console.error('Failed to revoke credentials after deletion:', e);
      }
    }
    return result;
  } catch (e) {
    console.error('Error deleting user account:', e);
    return {
      success: false,
      error: `Failed to delete account: ${e instanceof Error ? e.message : 'Unknown error'}`,
      reason: 'failed',
    };
  }
}

/**
 * Сохранить recovery-фразу. На диск уходит только хэш: сама фраза — секрет,
 * доказывающий владение аккаунтом.
 */
export async function setRecoveryPhrase(
  uid: string,
  phrase: string,
): Promise<boolean> {
  if (normalizePhrase(phrase) === '') {
    console.error('Failed to set recovery phrase: empty phrase');
    return false;
  }
  try {
    return withDataLock(async () => {
      const stored = await getStoredUser(uid);
      if (!stored) {
        console.error('Failed to set recovery phrase: user not found');
        return false;
      }
      await writeStoredUser(uid, {
        ...stored,
        recoveryPhrase: await hashRecoveryPhraseAsync(phrase),
        updatedAt: new Date().toISOString(),
      });
      return true;
    });
  } catch (e) {
    console.error('Error setting recovery phrase:', e);
    return false;
  }
}

export type ChangeRecoveryPhraseReason =
  | 'invalid_password'
  | 'invalid_phrase'
  | 'invalid_input'
  | 'not_found'
  | 'failed';

export interface ChangeRecoveryPhraseResult {
  success: boolean;
  reason?: ChangeRecoveryPhraseReason;
  error?: string;
}

/**
 * Сменить фразу из живой сессии. В отличие от `setRecoveryPhrase` (внутренняя
 * запись для тестов и миграций), здесь обязателен текущий пароль: украденная
 * cookie не должна превращаться в постоянный захват аккаунта (SEC-21).
 * Пароль сверяется под локом с актуальным файлом, как в `updateUserProfile`.
 */
export async function changeRecoveryPhrase(
  uid: string,
  phrase: string,
  currentPassword: string | undefined,
): Promise<ChangeRecoveryPhraseResult> {
  if (!currentPassword || currentPassword === '') {
    return {
      success: false,
      reason: 'invalid_password',
      error: 'Current password is incorrect.',
    };
  }
  if (normalizePhrase(phrase) === '') {
    return {
      success: false,
      reason: 'invalid_input',
      error: 'Phrase is required.',
    };
  }
  const phraseError = phrasePolicyError(phrase);
  if (phraseError) {
    return {
      success: false,
      reason: 'invalid_phrase',
      error: phraseError,
    };
  }
  try {
    return await withDataLock(async (): Promise<ChangeRecoveryPhraseResult> => {
      const stored = await getStoredUser(uid);
      if (!stored) {
        return {
          success: false,
          reason: 'not_found',
          error: 'User not found.',
        };
      }
      const check = await verifyPasswordAsync(
        stored.passwordHash,
        currentPassword,
      );
      if (!check.valid) {
        return {
          success: false,
          reason: 'invalid_password',
          error: 'Current password is incorrect.',
        };
      }
      await writeStoredUser(uid, {
        ...stored,
        recoveryPhrase: await hashRecoveryPhraseAsync(phrase),
        updatedAt: new Date().toISOString(),
      });
      return { success: true };
    });
  } catch (e) {
    console.error('Error changing recovery phrase:', e);
    return {
      success: false,
      reason: 'failed',
      error: 'Failed to update recovery phrase.',
    };
  }
}

/**
 * ─── LANDMARK: RECOVERY VERIFY ──────────────────────────────────────────────
 * Проверка recovery-фразы: фраза сравнивается целиком (состав и порядок слов),
 * а не «хотя бы одно слово». Слова из листов персонажей фактором больше не
 * являются: их знает любой, кто видел лист, а автор персонажа не обязательно
 * владелец аккаунта.
 *
 * При успехе выдаётся НЕ сессия, а одноразовый токен (`security/tokens.ts`):
 * пароль и фразу меняет только `recover/update`, и только по токену.
 *
 * Старый формат (фраза открытым текстом) принимается один раз: сразу после
 * успешного совпадения значение перезаписывается хэшем.
 */
export type RecoveryFailureReason =
  'no_account' | 'no_phrase' | 'mismatch' | 'blocked';

export interface VerifyRecoveryResult {
  success: boolean;
  user?: LocalUser;
  reason?: RecoveryFailureReason;
  error?: string;
}

export async function verifyRecovery(
  username: string,
  recoveryPhraseInput: string,
): Promise<VerifyRecoveryResult> {
  const uid = await resolveLogin(username);
  if (!uid) {
    return {
      success: false,
      reason: 'no_account',
      error: 'No account found with this username/email.',
    };
  }
  const storedUser = await getStoredUser(uid);
  if (!storedUser) {
    return {
      success: false,
      reason: 'no_account',
      error: 'No account found with this username/email.',
    };
  }

  // Блокировка — это отказ администратора, а не проверка фразы. Ответ
  // остаётся единым (`recovery_failed`), чтобы не выдавать статус аккаунта.
  if (storedUser.isBlocked) {
    return {
      success: false,
      reason: 'blocked',
      error: 'Recovery verification failed.',
    };
  }

  if (!storedUser.recoveryPhrase) {
    return {
      success: false,
      reason: 'no_phrase',
      error: 'No recovery phrase set for this account.',
    };
  }

  if (
    !(await recoveryPhraseMatchesAsync(
      storedUser.recoveryPhrase,
      recoveryPhraseInput,
    ))
  ) {
    return {
      success: false,
      reason: 'mismatch',
      error: 'Recovery phrase does not match.',
    };
  }

  // Фраза подтверждена: открытый текст (легаси) и старые параметры scrypt
  // перезаписываем текущими. Иначе после повышения N старый хэш остался бы
  // навсегда, а открытая фраза — секретом на диске.
  const phraseNeedsPlaintextMigration = !isRecoveryPhraseHash(
    storedUser.recoveryPhrase,
  );
  const phraseNeedsParamMigration =
    isRecoveryPhraseHash(storedUser.recoveryPhrase) &&
    !isCurrentScryptParams(storedUser.recoveryPhrase);
  if (phraseNeedsPlaintextMigration || phraseNeedsParamMigration) {
    try {
      await withDataLock(async () => {
        const fresh = await getStoredUser(uid);
        if (!fresh?.recoveryPhrase) return;
        const freshIsPlaintext = !isRecoveryPhraseHash(fresh.recoveryPhrase);
        if (!freshIsPlaintext && isCurrentScryptParams(fresh.recoveryPhrase)) {
          return;
        }
        const valueToHash = freshIsPlaintext
          ? fresh.recoveryPhrase
          : recoveryPhraseInput;
        await writeStoredUser(uid, {
          ...fresh,
          recoveryPhrase: await hashRecoveryPhraseAsync(valueToHash),
          updatedAt: new Date().toISOString(),
        });
      });
    } catch (e) {
      // Не мешаем восстановлению: фраза совпала, миграция повторится позже
      // (в том числе стартовой проверкой `hashLegacyRecoveryPhrases`).
      console.error('Failed to migrate recovery phrase to a hash:', e);
    }
  }

  return { success: true, user: toLocalUser(storedUser) };
}

export type ResetWithTokenReason =
  'invalid_token' | 'invalid_input' | 'invalid_phrase' | 'failed';

export interface ResetWithTokenResult {
  success: boolean;
  uid?: string;
  reason?: ResetWithTokenReason;
  error?: string;
}

/**
 * ─── LANDMARK: RESET BY TOKEN ───────────────────────────────────────────────
 * Сменить пароль (и, если передана, фразу) по одноразовому токену из
 * `recover/verify`. Логин здесь не принимается: он ничего не доказывает.
 *
 * Порядок: сначала гасим токен, затем пишем профиль. Если запись не удалась,
 * токен уже сгорел — пользователь повторит проверку фразы (она ему известна)
 * и получит новый. Обратный порядок был бы хуже: живой токен после смены
 * пароля — это второй ключ к аккаунту.
 */
export async function resetCredentialsWithToken(
  token: string,
  newPassword: string,
  newRecoveryPhrase?: string,
): Promise<ResetWithTokenResult> {
  const policyError = passwordPolicyError(newPassword);
  if (policyError) {
    return { success: false, reason: 'invalid_input', error: policyError };
  }
  if (newRecoveryPhrase !== undefined && newRecoveryPhrase.trim() !== '') {
    const phraseError = phrasePolicyError(newRecoveryPhrase);
    if (phraseError) {
      return {
        success: false,
        reason: 'invalid_phrase',
        error: phraseError,
      };
    }
  }

  const consumed = await consumeRecoveryToken(token);
  if (!consumed.success) {
    return {
      success: false,
      reason: 'invalid_token',
      error: 'Recovery token is invalid or expired.',
    };
  }

  try {
    const result = await withDataLock(
      async (): Promise<ResetWithTokenResult> => {
        const stored = await getStoredUser(consumed.uid);
        if (!stored || stored.isBlocked) {
          // Заблокированный не должен менять пароль/фразу даже по токену:
          // токен уже сожжён выше, ответ не отличается от невалидного.
          return {
            success: false,
            reason: 'invalid_token',
            error: 'Recovery token is invalid or expired.',
          };
        }

        const updated: StoredUser = {
          ...stored,
          passwordHash: await hashPasswordAsync(newPassword),
          updatedAt: new Date().toISOString(),
        };
        if (
          newRecoveryPhrase !== undefined &&
          newRecoveryPhrase.trim() !== ''
        ) {
          updated.recoveryPhrase =
            await hashRecoveryPhraseAsync(newRecoveryPhrase);
        }
        // `email` — legacy-поле логина: логин живёт в `username`.
        delete updated.email;
        // Временный пароль, выданный администратором, больше не действует.
        delete updated.mustChangePassword;
        // Восстановление доступа отключает второй фактор: иначе потеря
        // устройства оставила бы аккаунт без входа даже после сброса пароля.
        delete updated.totp;
        delete updated.totpBackupCodes;

        await writeStoredUser(consumed.uid, updated);
        return { success: true, uid: consumed.uid };
      },
    );

    // Секреты сменились: гасим остальные токены и все живые сессии аккаунта.
    // Восстановление доступа — это «вернуть контроль», а не «войти на устройстве
    // злоумышленника»: создание сессии здесь и не предусмотрено.
    if (result.success) {
      try {
        await revokeRecoveryTokensForUser(consumed.uid);
        await revokeAllSessionsForUser(consumed.uid);
      } catch (e) {
        console.error('Failed to revoke recovery credentials:', e);
      }
    }
    return result;
  } catch (e) {
    console.error('Error resetting credentials:', e);
    return {
      success: false,
      reason: 'failed',
      error: 'Failed to reset credentials.',
    };
  }
}

export interface HashLegacyPhrasesReport {
  total: number;
  updated: number;
  issues: string[];
}

/**
 * Стартовая миграция: перевести открытые recovery-фразы в хэши.
 *
 * Без неё фразами, заданными до появления хэширования, можно «поделиться»
 * вместе с копией `user.json` — а файл профиля уезжает в бэкапы и копии
 * data-dir. Миграция идемпотентна: значения-хэши и отсутствующие фразы не
 * трогаются.
 */
export async function hashLegacyRecoveryPhrases(): Promise<HashLegacyPhrasesReport> {
  const { records, issues } = await scanUserRecords();
  const report: HashLegacyPhrasesReport = {
    total: records.length,
    updated: 0,
    issues: [...issues],
  };

  for (const record of records) {
    const phrase = record.user.recoveryPhrase;
    if (!phrase || isRecoveryPhraseHash(phrase)) continue;

    try {
      await withDataLock(async () => {
        const fresh = await getStoredUser(record.uid);
        if (
          !fresh?.recoveryPhrase ||
          isRecoveryPhraseHash(fresh.recoveryPhrase)
        )
          return;
        await writeStoredUser(record.uid, {
          ...fresh,
          recoveryPhrase: await hashRecoveryPhraseAsync(fresh.recoveryPhrase),
          updatedAt: new Date().toISOString(),
        });
        report.updated += 1;
      });
    } catch (error) {
      report.issues.push(
        `users/${record.uid}: не удалось захешировать recovery-фразу (${error instanceof Error ? error.message : 'unknown'})`,
      );
    }
  }

  return report;
}

export interface CreateServiceAdminResult {
  success: boolean;
  user?: LocalUser;
  error?: string;
  reason?: 'invalid_input' | 'exists' | 'failed';
}

/**
 * ─── LANDMARK: SERVICE ADMIN CREATION ───────────────────────────────────────
 * Служебный администратор создаётся стартовой проверкой (`startup.ts`), когда
 * в data-dir нет ни одного активного админа. Пароль генерируется вызывающим и
 * сразу помечается как «временный» (`mustChangePassword`).
 *
 * Логин выбирает вызывающий; здесь ещё раз проверяется занятость под локом —
 * между сканом и созданием мог проскочить параллельный запрос.
 */
export async function createServiceAdmin(
  username: string,
  password: string,
  displayName = 'Administrator',
): Promise<CreateServiceAdminResult> {
  const login = normalizeLogin(username);
  if (!login) {
    return {
      success: false,
      error: 'Username is required.',
      reason: 'invalid_input',
    };
  }
  const policyError = passwordPolicyError(password);
  if (policyError) {
    return {
      success: false,
      error: policyError,
      reason: 'invalid_input',
    };
  }

  try {
    return withDataLock(async () => {
      const index = await readLoginIndexForUpdate();
      if (index.logins[login]) {
        return {
          success: false,
          error: 'This login is already registered.',
          reason: 'exists',
        } as CreateServiceAdminResult;
      }

      const created = await persistNewAccount(
        login,
        await hashPasswordAsync(password),
        displayName,
        undefined,
        { role: 'admin', mustChangePassword: true },
      );
      if (!created.success || !created.user) {
        return {
          success: false,
          error: created.error || 'Failed to create administrator.',
          reason: 'failed',
        } as CreateServiceAdminResult;
      }
      return { success: true, user: created.user };
    });
  } catch (error) {
    console.error('Failed to create service administrator:', error);
    return {
      success: false,
      error: 'Failed to create administrator.',
      reason: 'failed',
    };
  }
}
