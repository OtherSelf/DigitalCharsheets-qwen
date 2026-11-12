import path from 'path';

/**
 * Каталог, в котором лежат аккаунты и листы персонажей.
 *
 * ─── LANDMARK: DATA LAYOUT v2 ───────────────────────────────────────────────
 * Схема хранения (с версии 2):
 *
 *   <data-dir>/users/<uid>/user.json          — профиль (uid неизменяем)
 *   <data-dir>/users/<uid>/characters/<id>.json
 *   <data-dir>/index/logins.json              — индекс «логин → uid» (производный)
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
