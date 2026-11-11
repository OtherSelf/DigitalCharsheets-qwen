import crypto from 'crypto';
import fs from 'fs';

import { getUserDir, getUserFile } from './data-dir';
import { withDataLock } from './data-lock';
import { defaultDisplayName, isUid, newUid, normalizeLogin } from './ids';
import { LocalUser } from './local-storage';
import { getCharactersFromServer, resetWriteSeqGuard } from './server-storage';
import {
  readLoginIndexForUpdate,
  rebuildLoginIndex,
  resolveLogin,
  writeLoginIndex,
} from './user-index';
import { normalizeUserRole, type UserRole } from './user-role';
import {
  readStoredUser,
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
 * Пароль по-прежнему хранится как sha256-хеш (без соли) — это отдельная
 * задача, не связанная со сменой схемы идентификаторов.
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
   *   invalid_input    — не прошли серверные проверки полей.
   */
  reason?:
    'no_account' | 'invalid_password' | 'blocked' | 'exists' | 'invalid_input';
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
}

export function hashPassword(password: string): string {
  return crypto.createHash('sha256').update(password).digest('hex');
}

function normalizePhrase(phrase: string): string[] {
  return phrase
    .toLowerCase()
    .trim()
    .split(/\s+/)
    .filter((w) => w.length > 0);
}

function checkPhraseMatch(storedPhrase: string, inputPhrase: string): boolean {
  const storedWords = normalizePhrase(storedPhrase);
  const inputWords = normalizePhrase(inputPhrase);
  return inputWords.some((word) => storedWords.includes(word));
}

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
  };
}

export function userExists(uid: string): boolean {
  return fs.existsSync(getUserFile(uid));
}

/**
 * Прочитать профиль по uid. Терпимо к старым/ручным файлам: `uid` берётся из
 * каталога, если в JSON его нет, а `email` считается логином. Сама
 * нормализация живёт в `user-schema.ts` (её же использует startup-проверка).
 */
export function getStoredUser(uid: string): StoredUser | null {
  return readStoredUser(uid);
}

function authenticateExisting(uid: string, passwordHash: string): AuthResult {
  let stored = getStoredUser(uid);
  if (!stored) {
    // Индекс мог устареть (например, каталог удалили руками) — пересобираем.
    rebuildLoginIndex();
    stored = getStoredUser(uid);
  }
  if (!stored) {
    return {
      success: false,
      error: 'Failed to read user data.',
      reason: 'no_account',
    };
  }
  if (stored.passwordHash !== passwordHash) {
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
  return {
    success: true,
    isNewUser: false,
    user: toLocalUser(touchLastLogin(stored)),
  };
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
function touchLastLogin(stored: StoredUser): StoredUser {
  try {
    const fresh = readStoredUser(stored.uid) ?? stored;
    const updated: StoredUser = {
      ...fresh,
      lastLoginAt: new Date().toISOString(),
    };
    writeStoredUser(stored.uid, updated);
    return updated;
  } catch (error) {
    console.error('Failed to update last login time:', error);
    return stored;
  }
}

/** Есть ли аккаунт с таким логином (регистр/пробелы нормализуются). */
export function accountExists(username: string): boolean {
  return resolveLogin(username) !== null;
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
function persistNewAccount(
  login: string,
  passwordHash: string,
  displayName?: string,
  recoveryPhrase?: string,
  options: NewAccountOptions = {},
): AuthResult {
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
    user.recoveryPhrase = recoveryPhrase.toLowerCase().trim();
  }
  if (options.mustChangePassword) {
    user.mustChangePassword = true;
  }

  writeStoredUser(uid, user);

  const index = readLoginIndexForUpdate();
  index.logins[login] = uid;
  try {
    writeLoginIndex(index);
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
export function registerUser(
  username: string,
  password: string,
  displayName: string | undefined,
  recoveryPhrase: string,
): AuthResult {
  const login = normalizeLogin(username);
  if (!login) {
    return {
      success: false,
      error: 'Username/Email is required.',
      reason: 'invalid_input',
    };
  }
  if (!password || password.length < 4) {
    return {
      success: false,
      error: 'Password must be at least 4 characters.',
      reason: 'invalid_input',
    };
  }
  if (!recoveryPhrase || recoveryPhrase.trim().length < 5) {
    return {
      success: false,
      error: 'Recovery phrase must be at least 5 characters.',
      reason: 'invalid_input',
    };
  }

  if (resolveLogin(login)) {
    return {
      success: false,
      error: 'This login is already registered.',
      reason: 'exists',
    };
  }

  // Регистрация под локом: иначе два параллельных запроса заведут два
  // аккаунта с одним логином.
  return withDataLock(() => {
    const index = readLoginIndexForUpdate();
    if (index.logins[login]) {
      return {
        success: false,
        error: 'This login is already registered.',
        reason: 'exists',
      } as AuthResult;
    }
    return persistNewAccount(
      login,
      hashPassword(password),
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
export function authenticateUser(
  username: string,
  password: string,
  displayName?: string,
  options: AuthenticateOptions = {},
): AuthResult {
  const login = normalizeLogin(username);
  const passwordHash = hashPassword(password);

  if (!login) {
    return {
      success: false,
      error: 'Username/Email is required.',
      reason: 'invalid_input',
    };
  }

  const existingUid = resolveLogin(login);
  if (existingUid) return authenticateExisting(existingUid, passwordHash);

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
  return withDataLock(() => {
    const index = readLoginIndexForUpdate();
    const racedUid = index.logins[login];
    if (racedUid) return authenticateExisting(racedUid, passwordHash);

    return persistNewAccount(login, passwordHash, displayName);
  });
}

/**
 * Обновить профиль. `currentUserId` — неизменяемый uid из сессии.
 * Смена логина меняет только user.json и индекс; каталог с листами остаётся
 * на месте.
 */
export function updateUserProfile(
  currentUserId: string,
  newUsername: string,
  newDisplayName: string,
  newPassword?: string,
  newRecoveryPhrase?: string,
): { success: boolean; user?: LocalUser; error?: string } {
  const stored = getStoredUser(currentUserId);
  if (!stored) return { success: false, error: 'User not found.' };

  const newLogin = normalizeLogin(newUsername);
  if (!newLogin) return { success: false, error: 'Username is required.' };

  const oldLogin = normalizeLogin(stored.username);
  const displayName = (newDisplayName || '').trim() || stored.displayName;

  try {
    return withDataLock(() => {
      const index = readLoginIndexForUpdate();

      if (newLogin !== oldLogin) {
        const owner = index.logins[newLogin];
        if (owner && owner !== currentUserId) {
          return { success: false, error: 'This login is already taken.' };
        }
      }

      const updated: StoredUser = {
        ...stored,
        schemaVersion: USER_SCHEMA_VERSION,
        uid: currentUserId,
        username: newLogin,
        displayName,
        role: normalizeUserRole(stored.role),
        isBlocked: !!stored.isBlocked,
        passwordHash:
          newPassword && newPassword.trim().length > 0
            ? hashPassword(newPassword)
            : stored.passwordHash,
        updatedAt: new Date().toISOString(),
      };

      // Сменили сгенерированный стартовый пароль — предупреждение больше не
      // нужно.
      if (newPassword && newPassword.trim().length > 0) {
        delete updated.mustChangePassword;
      }

      if (newRecoveryPhrase !== undefined) {
        if (newRecoveryPhrase.trim() === '') {
          delete updated.recoveryPhrase;
        } else {
          updated.recoveryPhrase = newRecoveryPhrase.toLowerCase().trim();
        }
      }

      // user.json первым: он источник истины. Если запись индекса не удастся,
      // resolveLogin при промахе пересоберёт индекс из этого файла.
      writeStoredUser(currentUserId, updated);

      if (newLogin !== oldLogin) {
        delete index.logins[oldLogin];
        index.logins[newLogin] = currentUserId;
        try {
          writeLoginIndex(index);
        } catch (e) {
          console.error('Failed to update login index after rename:', e);
          rebuildLoginIndex();
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
 * оказалась валидной), а пароль сверяется с sha256-хешем из user.json. Пароль
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

export function deleteUserAccount(
  uid: string,
  password: string,
): DeleteAccountResult {
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
    return withDataLock(() => {
      const stored = getStoredUser(uid);
      if (!stored) {
        return {
          success: false,
          error: 'User not found.',
          reason: 'not_found',
        } as DeleteAccountResult;
      }
      if (stored.passwordHash !== hashPassword(password)) {
        return {
          success: false,
          error: 'Incorrect password.',
          reason: 'invalid_password',
        } as DeleteAccountResult;
      }

      // Убираем из индекса все логины, указывающие на этот uid (обычно один).
      const index = readLoginIndexForUpdate();
      for (const [login, owner] of Object.entries(index.logins)) {
        if (owner === uid) delete index.logins[login];
      }

      fs.rmSync(getUserDir(uid), { recursive: true, force: true });

      try {
        writeLoginIndex(index);
      } catch (e) {
        // Индекс производный: его можно (и нужно) пересобрать из user.json
        // оставшихся аккаунтов, чтобы удалённый логин точно не занимал uid.
        console.error('Failed to update login index after deletion:', e);
        rebuildLoginIndex();
      }

      // In-memory карта порядка записей тоже не должна помнить удалённый лист.
      resetWriteSeqGuard(uid);

      return { success: true } as DeleteAccountResult;
    });
  } catch (e) {
    console.error('Error deleting user account:', e);
    return {
      success: false,
      error: `Failed to delete account: ${e instanceof Error ? e.message : 'Unknown error'}`,
      reason: 'failed',
    };
  }
}

export function setRecoveryPhrase(uid: string, phrase: string): boolean {
  try {
    const stored = getStoredUser(uid);
    if (!stored) {
      console.error('Failed to set recovery phrase: user not found');
      return false;
    }
    stored.recoveryPhrase = phrase.toLowerCase().trim();
    stored.updatedAt = new Date().toISOString();
    writeStoredUser(uid, stored);
    return true;
  } catch (e) {
    console.error('Error setting recovery phrase:', e);
    return false;
  }
}

function readByLogin(
  username: string,
):
  | { success: false; error: string }
  | { success: true; uid: string; user: StoredUser } {
  const uid = resolveLogin(username);
  if (!uid)
    return {
      success: false,
      error: 'No account found with this username/email.',
    };
  const user = getStoredUser(uid);
  if (!user) return { success: false, error: 'Failed to read user data.' };
  return { success: true, uid, user };
}

function checkOwnershipWords(user: StoredUser, words: string[]): string | null {
  const characters = getCharactersFromServer(user.uid);
  if (characters.length === 0) {
    return 'No character sheets found on this server. Cannot verify ownership.';
  }

  const characterDataString = JSON.stringify(characters);
  for (const word of words) {
    const cleanWord = word.toLowerCase().trim();
    if (!cleanWord) return 'Please provide valid words.';
    const escapedWord = cleanWord.replace(/[.*+?^${}()|[\]]/g, '$&');
    if (!new RegExp(`\\b${escapedWord}\\b`, 'i').test(characterDataString)) {
      return `The word "${word}" was not found in any of your character sheets.`;
    }
  }
  return null;
}

export function verifyRecovery(
  username: string,
  words: string[],
  recoveryPhraseInput: string,
): { success: boolean; user?: LocalUser; error?: string } {
  const found = readByLogin(username);
  if (!found.success) return { success: false, error: found.error };
  const storedUser = found.user;

  if (!storedUser.recoveryPhrase) {
    return {
      success: false,
      error: 'No recovery phrase set for this account.',
    };
  }

  const wordError = checkOwnershipWords(storedUser, words);
  if (wordError) return { success: false, error: wordError };

  if (!checkPhraseMatch(storedUser.recoveryPhrase, recoveryPhraseInput)) {
    return {
      success: false,
      error:
        'Recovery phrase does not match. (At least one word must match, order does not matter).',
    };
  }

  return { success: true, user: toLocalUser(storedUser) };
}

export function updateRecoveryCredentials(
  username: string,
  newPassword: string,
  newRecoveryPhrase: string,
): { success: boolean; error?: string } {
  const found = readByLogin(username);
  if (!found.success) return { success: false, error: 'User not found.' };

  try {
    const storedUser = found.user;
    storedUser.username = normalizeLogin(username);
    storedUser.passwordHash = hashPassword(newPassword);
    storedUser.recoveryPhrase = newRecoveryPhrase.toLowerCase().trim();
    storedUser.updatedAt = new Date().toISOString();
    if (storedUser.email) {
      delete storedUser.email;
    }
    writeStoredUser(found.uid, storedUser);
    return { success: true };
  } catch (e) {
    console.error('Error updating recovery credentials:', e);
    return { success: false, error: 'Failed to update account.' };
  }
}

export function recoverPasswordWithUsernameAndWords(
  username: string,
  words: string[],
  newPassword: string,
): { success: boolean; error?: string } {
  const found = readByLogin(username);
  if (!found.success) return { success: false, error: found.error };
  const storedUser = found.user;

  if (!storedUser.recoveryPhrase) {
    return {
      success: false,
      error: 'No recovery phrase set for this account.',
    };
  }

  const wordError = checkOwnershipWords(storedUser, words);
  if (wordError) return { success: false, error: wordError };

  try {
    storedUser.passwordHash = hashPassword(newPassword);
    storedUser.updatedAt = new Date().toISOString();
    if (storedUser.email) {
      delete storedUser.email;
    }
    storedUser.username = normalizeLogin(username);
    writeStoredUser(found.uid, storedUser);
    return { success: true };
  } catch (e) {
    console.error('Error resetting password:', e);
    return { success: false, error: 'Failed to reset password.' };
  }
}

/**
 * Создать импортированный аккаунт (Firestore-экспорт) с неизменяемым uid.
 * Вызывать под `withDataLock`: функция пишет user.json и индекс.
 */
export function createImportedUser(options: {
  username: string;
  displayName: string;
  passwordHash: string;
  originalFirebaseId?: string;
}): StoredUser {
  return withDataLock(() => {
    const index = readLoginIndexForUpdate();
    const login = normalizeLogin(options.username);

    const existing = index.logins[login];
    if (existing) {
      const stored = getStoredUser(existing);
      if (stored) return stored;
    }

    const uid = newUid();
    const now = new Date().toISOString();
    const user: StoredUser = {
      schemaVersion: USER_SCHEMA_VERSION,
      uid,
      username: login,
      displayName: options.displayName,
      passwordHash: options.passwordHash,
      role: 'user',
      isBlocked: false,
      createdAt: now,
      updatedAt: now,
      ...(options.originalFirebaseId
        ? { originalFirebaseId: options.originalFirebaseId }
        : {}),
    };

    writeStoredUser(uid, user);
    index.logins[login] = uid;
    try {
      writeLoginIndex(index);
    } catch (e) {
      console.error('Failed to update login index for imported user:', e);
    }
    return user;
  });
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
export function createServiceAdmin(
  username: string,
  password: string,
  displayName = 'Administrator',
): CreateServiceAdminResult {
  const login = normalizeLogin(username);
  if (!login) {
    return {
      success: false,
      error: 'Username is required.',
      reason: 'invalid_input',
    };
  }
  if (!password || password.length < 4) {
    return {
      success: false,
      error: 'Password must be at least 4 characters.',
      reason: 'invalid_input',
    };
  }

  try {
    return withDataLock(() => {
      const index = readLoginIndexForUpdate();
      if (index.logins[login]) {
        return {
          success: false,
          error: 'This login is already registered.',
          reason: 'exists',
        } as CreateServiceAdminResult;
      }

      const created = persistNewAccount(
        login,
        hashPassword(password),
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
