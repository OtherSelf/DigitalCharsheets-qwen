import fs from 'fs';
import crypto from 'crypto';
import { LocalUser } from './local-storage';
import { getCharactersFromServer } from './server-storage';
import { getUserDir, getUserFile } from './data-dir';
import { writeJsonAtomic } from './fs-atomic';
import { defaultDisplayName, newUid, normalizeLogin } from './ids';
import { withDataLock } from './data-lock';
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
}

function hashPassword(password: string): string {
  return crypto.createHash('sha256').update(password).digest('hex');
}

function normalizePhrase(phrase: string): string[] {
  return phrase.toLowerCase().trim().split(/\s+/).filter(w => w.length > 0);
}

function checkPhraseMatch(storedPhrase: string, inputPhrase: string): boolean {
  const storedWords = normalizePhrase(storedPhrase);
  const inputWords = normalizePhrase(inputPhrase);
  return inputWords.some(word => storedWords.includes(word));
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
    const data = JSON.parse(fs.readFileSync(file, 'utf8')) as Record<string, unknown>;
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
  if (!stored) return { success: false, error: 'Failed to read user data.' };
  if (stored.passwordHash !== passwordHash) return { success: false, error: 'Incorrect password.' };
  return { success: true, isNewUser: false, user: toLocalUser(stored) };
}

/**
 * Вход или регистрация. Новый аккаунт создаётся только при первом входе с
 * этим логином; uid выдаётся здесь и больше не меняется.
 */
export function authenticateUser(
  username: string,
  password: string,
  displayName?: string,
): AuthResult {
  const login = normalizeLogin(username);
  const passwordHash = hashPassword(password);

  if (!login) return { success: false, error: 'Username/Email is required.' };

  const existingUid = resolveLogin(login);
  if (existingUid) return authenticateExisting(existingUid, passwordHash);

  // Регистрация: проверка «логин свободен» и создание каталога — под локом,
  // иначе два параллельных запроса заведут два аккаунта с одним логином.
  return withDataLock(() => {
    const index = readLoginIndexForUpdate();
    const racedUid = index.logins[login];
    if (racedUid) return authenticateExisting(racedUid, passwordHash);

    const uid = newUid();
    const now = new Date().toISOString();
    const user: StoredUser = {
      schemaVersion: 2,
      uid,
      username: login,
      displayName: (displayName && displayName.trim()) || defaultDisplayName(login),
      passwordHash,
      createdAt: now,
      updatedAt: now,
    };

    writeStoredUser(uid, user);

    index.logins[login] = uid;
    try {
      writeLoginIndex(index);
    } catch (e) {
      // Источник истины — user.json; индекс пересоберётся при следующем входе.
      console.error('Failed to update login index:', e);
    }

    return { success: true, isNewUser: true, user: toLocalUser(user) };
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

function readByLogin(username: string):
  | { success: false; error: string }
  | { success: true; uid: string; user: StoredUser } {
  const uid = resolveLogin(username);
  if (!uid) return { success: false, error: 'No account found with this username/email.' };
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
    return { success: false, error: 'No recovery phrase set for this account.' };
  }

  const wordError = checkOwnershipWords(storedUser, words);
  if (wordError) return { success: false, error: wordError };

  if (!checkPhraseMatch(storedUser.recoveryPhrase, recoveryPhraseInput)) {
    return {
      success: false,
      error: 'Recovery phrase does not match. (At least one word must match, order does not matter).',
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
    return { success: false, error: 'No recovery phrase set for this account.' };
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
      ...(options.originalFirebaseId ? { originalFirebaseId: options.originalFirebaseId } : {}),
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
