import crypto from 'crypto';
import fs from 'fs';

import { getUserDir, getUserFile } from './data-dir';
import { withDataLock } from './data-lock';
import { writeJsonAtomic } from './fs-atomic';
import { defaultDisplayName, isUid, newUid, normalizeLogin } from './ids';
import { LocalUser } from './local-storage';
import { getCharactersFromServer, resetWriteSeqGuard } from './server-storage';
import {
  readLoginIndexForUpdate,
  rebuildLoginIndex,
  resolveLogin,
  writeLoginIndex,
} from './user-index';

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

export interface StoredUser {
  schemaVersion?: number;
  uid: string;
  username: string;
  displayName: string;
  passwordHash: string;
  recoveryPhrase?: string;
  createdAt?: string;
  updatedAt?: string;
  originalFirebaseId?: string;
  [key: string]: unknown;
}

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
   *   exists           — регистрация отклонена: логин уже занят;
   *   invalid_input    — не прошли серверные проверки полей.
   */
  reason?: 'no_account' | 'invalid_password' | 'exists' | 'invalid_input';
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

function hashPassword(password: string): string {
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

function toLocalUser(user: StoredUser): LocalUser {
  return {
    uid: user.uid,
    username: user.username,
    displayName: user.displayName,
    hasRecoveryPhrase: !!user.recoveryPhrase,
  };
}

export function userExists(uid: string): boolean {
  return fs.existsSync(getUserFile(uid));
}

/**
 * Прочитать профиль по uid. Терпимо к старым/ручным файлам: `uid` берётся из
 * каталога, если в JSON его нет, а `email` считается логином.
 */
export function getStoredUser(uid: string): StoredUser | null {
  const file = getUserFile(uid);
  if (!fs.existsSync(file)) return null;
  try {
    const data = JSON.parse(fs.readFileSync(file, 'utf8')) as Record<
      string,
      unknown
    >;
    if (!data.uid) data.uid = uid;
    if (!data.username && data.email) data.username = data.email;
    return data as unknown as StoredUser;
  } catch (e) {
    console.error('Failed to read user data:', e);
    return null;
  }
}

/** Записать профиль (атомарно) и вернуть его. */
function writeStoredUser(uid: string, data: StoredUser): StoredUser {
  fs.mkdirSync(getUserDir(uid), { recursive: true });
  writeJsonAtomic(getUserFile(uid), data);
  return data;
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
  return { success: true, isNewUser: false, user: toLocalUser(stored) };
}

/** Есть ли аккаунт с таким логином (регистр/пробелы нормализуются). */
export function accountExists(username: string): boolean {
  return resolveLogin(username) !== null;
}

/**
 * Создать профиль и запись в индексе. Вызывать только под `withDataLock`,
 * после проверки, что логин свободен.
 */
function persistNewAccount(
  login: string,
  passwordHash: string,
  displayName?: string,
  recoveryPhrase?: string,
): AuthResult {
  const uid = newUid();
  const now = new Date().toISOString();
  const user: StoredUser = {
    schemaVersion: 2,
    uid,
    username: login,
    displayName:
      (displayName && displayName.trim()) || defaultDisplayName(login),
    passwordHash,
    createdAt: now,
    updatedAt: now,
  };

  if (recoveryPhrase !== undefined && recoveryPhrase.trim() !== '') {
    user.recoveryPhrase = recoveryPhrase.toLowerCase().trim();
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
        schemaVersion: 2,
        uid: currentUserId,
        username: newLogin,
        displayName,
        passwordHash:
          newPassword && newPassword.trim().length > 0
            ? hashPassword(newPassword)
            : stored.passwordHash,
        updatedAt: new Date().toISOString(),
      };

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
    return 'No character sheets found locally. Cannot verify ownership.';
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
      schemaVersion: 2,
      uid,
      username: login,
      displayName: options.displayName,
      passwordHash: options.passwordHash,
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
