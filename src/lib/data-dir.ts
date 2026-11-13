import path from 'path';

import { isSafeId, resolveInside } from './security/paths';

/**
 * Каталог, в котором лежат аккаунты и листы персонажей.
 *
 * ─── LANDMARK: DATA LAYOUT v2 ───────────────────────────────────────────────
 * Схема хранения (с версии 2):
 *
 *   <data-dir>/users/<uid>/user.json          — профиль (uid неизменяем)
 *   <data-dir>/users/<uid>/characters/<id>.json
 *   <data-dir>/users/<uid>/history/<id>.jsonl  — изменения листа (append-only)
 *   <data-dir>/index/logins.json              — индекс «логин → uid» (производный)
 *   <data-dir>/tokens.json                    — хэши одноразовых recovery-токенов
 *   <data-dir>/sessions.json                  — серверный реестр сессий (jti)
 *   <data-dir>/shares.json                    — хэши токенов гостевых ссылок
 *   <data-dir>/.session-secret                — ключ подписи cookie (0600)
 *   <data-dir>/.lock                          — каталог-мьютекс для операций записи
 *
 * `<uid>` — случайный UUID из `ids.ts`, а не хеш логина. Логин меняется без
 * переноса каталога: достаточно обновить `user.json` и запись в индексе.
 *
 * По умолчанию data-dir — `<cwd>/data`; абсолютный путь задаётся через
 * `DCS_DATA_DIR` (он же используется тестами и predeploy-смоуком).
 * Переопределяется переменной окружения `DCS_DATA_DIR` (абсолютный или
 * относительный путь). Нужно для:
 *   - тестов (изоляция от реальных данных);
 *   - деплоя, когда данные лежат вне каталога проекта
 *     (`DCS_DATA_DIR=/var/lib/charsheets/data npm start`).
 *
 * Читается при каждом вызове, а не на этапе импорта модуля, поэтому
 * переменную можно задавать/менять в рантайме (в т.ч. в тестах).
 */
export function getDataDir(): string {
  const fromEnv = process.env.DCS_DATA_DIR;
  if (fromEnv && fromEnv.trim() !== '') {
    return path.resolve(fromEnv.trim());
  }
  return path.join(process.cwd(), 'data');
}

/** Корень всех аккаунтов: `<data-dir>/users`. */
export function getUsersDir(): string {
  return path.join(getDataDir(), 'users');
}

/** Каталог одного пользователя: `<data-dir>/users/<uid>`. */
export function getUserDir(uid: string): string {
  return path.join(getUsersDir(), uid);
}

/** Файл профиля: `<data-dir>/users/<uid>/user.json`. */
export function getUserFile(uid: string): string {
  return path.join(getUserDir(uid), 'user.json');
}

/** Каталог листов: `<data-dir>/users/<uid>/characters`. */
export function getCharactersDir(uid: string): string {
  return path.join(getUserDir(uid), 'characters');
}

/** Каталог истории листов: `<data-dir>/users/<uid>/history`. */
export function getHistoryDir(uid: string): string {
  return path.join(getUserDir(uid), 'history');
}

/**
 * Файл истории одного листа: `history/<id>.jsonl`. `null` — id небезопасен
 * или путь вышел за каталог истории (та же защита, что у листа).
 */
export function getHistoryFile(
  uid: string,
  characterId: string,
): string | null {
  if (!isSafeId(characterId)) return null;
  return resolveInside(getHistoryDir(uid), `${characterId}.jsonl`);
}

/** Каталог индексов: `<data-dir>/index`. */
export function getIndexDir(): string {
  return path.join(getDataDir(), 'index');
}

/** Индекс «логин → uid»: `<data-dir>/index/logins.json`. */
export function getLoginIndexFile(): string {
  return path.join(getIndexDir(), 'logins.json');
}

/** Каталог-мьютекс: `<data-dir>/.lock` (создаётся/удаляется в data-lock.ts). */
export function getDataLockDir(): string {
  return path.join(getDataDir(), '.lock');
}

/** Каталог настроек приложения: `<data-dir>/settings`. */
export function getSettingsDir(): string {
  return path.join(getDataDir(), 'settings');
}

/** Каталог видимости игр: `<data-dir>/settings/game-catalog.json`. */
export function getGameCatalogFile(): string {
  return path.join(getSettingsDir(), 'game-catalog.json');
}

/** Ключ подписи сессионных cookie: `<data-dir>/.session-secret`. */
export function getSessionSecretFile(): string {
  return path.join(getDataDir(), '.session-secret');
}

/**
 * Одноразовые токены восстановления: `<data-dir>/tokens.json`.
 * Ключ записи — хэш токена, сам токен на диске не хранится (см.
 * `src/lib/security/tokens.ts`).
 */
export function getRecoveryTokensFile(): string {
  return path.join(getDataDir(), 'tokens.json');
}

/**
 * Серверный реестр сессий: `<data-dir>/sessions.json`.
 * Cookie хранит только `jti`, а запись можно отозвать (logout, смена пароля,
 * «выйти на всех устройствах»); см. `src/lib/security/sessions.ts`.
 */
export function getSessionsFile(): string {
  return path.join(getDataDir(), 'sessions.json');
}

/**
 * Реестр гостевых ссылок: `<data-dir>/shares.json`.
 * Ключ записи — хэш токена, сам токен на диске не хранится (см.
 * `src/lib/shares.ts`). Одна запись на пару `uid + characterId`.
 */
export function getSharesFile(): string {
  return path.join(getDataDir(), 'shares.json');
}
