import fs from 'fs';

import { getUserDir, getUserFile, getUsersDir } from './data-dir';
import { withDataLock } from './data-lock';
import { writeJsonAtomic } from './fs-atomic';
import { defaultDisplayName, isUid, normalizeLogin } from './ids';
import { isUserRole, type UserRole } from './user-role';

/**
 * ─── LANDMARK: USER PROFILE SCHEMA v4 ──────────────────────────────────────
 * `users/<uid>/user.json` — источник истины по аккаунту. v4 добавила роль
 * `tester` (видит test-редакции, но не админку); неизвестная роль
 * нормализуется в `user` (fail-closed). На старте приложения шаблон
 * проверяется: недостающие поля дописываются значениями по умолчанию,
 * существующие не перезаписываются.
 *
 * Проверка идемпотентна: файл пишется только если после нормализации его
 * содержимое реально изменилось (сравнение JSON до/после). Это важно, потому
 * что `readStoredUser()` нормализует запись в памяти на каждом чтении — без
 * такой проверки мы бы переписывали `user.json` на каждый запрос.
 *
 * Поля, которые НЕЛЬЗЯ придумать (например, `passwordHash`), только
 * репортятся как отсутствующие: администратор может задать пароль через
 * /admin, а вход по пустому хешу и так невозможен.
 */

export const USER_SCHEMA_VERSION = 4;

export interface StoredUser {
  schemaVersion?: number;
  uid: string;
  username: string;
  displayName: string;
  passwordHash: string;
  /** `'admin'` — доступ к /admin; отсутствие поля трактуется как `'user'`. */
  role?: UserRole;
  /** true — вход запрещён, существующие сессии перестают действовать. */
  isBlocked?: boolean;
  blockedAt?: string | null;
  lastLoginAt?: string;
  /** Пароль сгенерирован при первом запуске — предложить сменить. */
  mustChangePassword?: boolean;
  recoveryPhrase?: string;
  createdAt?: string;
  updatedAt?: string;
  originalFirebaseId?: string;
  [key: string]: unknown;
}

export interface ParsedUserRecord {
  user: StoredUser;
  /** Какие поля шаблона отсутствовали/были неверного типа. */
  missing: string[];
  /** Изменилось ли содержимое после нормализации (нужно ли писать файл). */
  changed: boolean;
}

/**
 * Привести запись к шаблону v3. Не бросает на мусоре: всё, что можно
 * восстановить, восстанавливается, остальное попадает в `missing`.
 *
 * `fallbackIso` — дата файла (mtime) для отсутствующих `createdAt`/
 * `updatedAt`: так старые аккаунты сохраняют «возраст» и порядок сортировки
 * в админке, а не выглядят созданными в день обновления.
 */
export function normalizeStoredUser(
  uid: string,
  raw: Record<string, unknown>,
  fallbackIso: string,
): ParsedUserRecord {
  const missing: string[] = [];
  const user = { ...raw } as StoredUser;
  const before = JSON.stringify(user);

  if (user.uid !== uid) {
    missing.push('uid');
    user.uid = uid;
  }

  // Логин: старое поле `email` считается логином (совместимость с v1/v2).
  const login = normalizeLogin(String(user.username ?? user.email ?? ''));
  if (!login) {
    missing.push('username');
  } else if (user.username !== login) {
    missing.push('username');
    user.username = login;
  }

  if (typeof user.displayName !== 'string' || !user.displayName.trim()) {
    missing.push('displayName');
    user.displayName = defaultDisplayName(login || uid);
  }

  if (typeof user.passwordHash !== 'string' || !user.passwordHash) {
    // Хеш не восстанавливаем: пусть аккаунт чинит администратор.
    missing.push('passwordHash');
  }

  if (!isUserRole(user.role)) {
    missing.push('role');
    user.role = 'user';
  }

  if (typeof user.isBlocked !== 'boolean') {
    missing.push('isBlocked');
    user.isBlocked = false;
  }

  if (!user.createdAt) {
    missing.push('createdAt');
    user.createdAt = fallbackIso;
  }

  if (!user.updatedAt) {
    missing.push('updatedAt');
    user.updatedAt = user.createdAt;
  }

  // Более новый профиль (schemaVersion больше текущего) не трогаем: его мог
  // записать более свежий инстанс, и понижение версии потеряло бы поля.
  if (typeof user.schemaVersion !== 'number') {
    missing.push('schemaVersion');
    user.schemaVersion = USER_SCHEMA_VERSION;
  } else if (user.schemaVersion < USER_SCHEMA_VERSION) {
    missing.push('schemaVersion');
    user.schemaVersion = USER_SCHEMA_VERSION;
  }

  return { user, missing, changed: JSON.stringify(user) !== before };
}

/**
 * Прочитать профиль с диска и нормализовать его в памяти.
 * `uid` обязан быть UUID: значение приходит из URL/сессии, а попадает в путь.
 */
export function readStoredUser(uid: string): StoredUser | null {
  if (!isUid(uid)) return null;
  const file = getUserFile(uid);

  let mtimeIso: string;
  try {
    mtimeIso = fs.statSync(file).mtime.toISOString();
  } catch {
    return null;
  }

  try {
    const parsed = JSON.parse(fs.readFileSync(file, 'utf8')) as unknown;
    if (!parsed || typeof parsed !== 'object' || Array.isArray(parsed)) {
      return null;
    }
    return normalizeStoredUser(uid, parsed as Record<string, unknown>, mtimeIso)
      .user;
  } catch (error) {
    console.error(`Failed to read user profile ${uid}:`, error);
    return null;
  }
}

/** Атомарно записать профиль (каталог создаётся при необходимости). */
export function writeStoredUser(uid: string, data: StoredUser): void {
  fs.mkdirSync(getUserDir(uid), { recursive: true });
  writeJsonAtomic(getUserFile(uid), data);
}

export interface ScanUserRecordsResult {
  records: (ParsedUserRecord & { uid: string })[];
  /** Битые/непригодные каталоги и файлы, которые были пропущены. */
  issues: string[];
}

/**
 * Пройти по `users/*` и разобрать все профили. Не бросает: один битый
 * каталог не должен мешать остальным (ни входу, ни админке).
 */
export function scanUserRecords(): ScanUserRecordsResult {
  const records: (ParsedUserRecord & { uid: string })[] = [];
  const issues: string[] = [];

  let entries: fs.Dirent[] = [];
  try {
    entries = fs.readdirSync(getUsersDir(), { withFileTypes: true });
  } catch {
    return { records, issues };
  }

  for (const entry of entries) {
    if (!entry.isDirectory()) continue;
    if (!isUid(entry.name)) {
      issues.push(`users/${entry.name}: имя каталога не является UUID`);
      continue;
    }

    const file = getUserFile(entry.name);
    let raw: string;
    let mtimeIso: string;
    try {
      mtimeIso = fs.statSync(file).mtime.toISOString();
      raw = fs.readFileSync(file, 'utf8');
    } catch {
      issues.push(`users/${entry.name}: нет user.json`);
      continue;
    }

    try {
      const parsed = JSON.parse(raw) as unknown;
      if (!parsed || typeof parsed !== 'object' || Array.isArray(parsed)) {
        issues.push(`users/${entry.name}: user.json не объект`);
        continue;
      }
      const normalized = normalizeStoredUser(
        entry.name,
        parsed as Record<string, unknown>,
        mtimeIso,
      );
      records.push({ uid: entry.name, ...normalized });
    } catch (error) {
      issues.push(
        `users/${entry.name}: user.json не читается (${error instanceof Error ? error.message : 'unknown'})`,
      );
    }
  }

  return { records, issues };
}

/** Только валидные профили — для админки и поиска активных админов. */
export function listStoredUsers(): StoredUser[] {
  return scanUserRecords().records.map((record) => record.user);
}

export interface NormalizeProfilesReport {
  total: number;
  updated: number;
  issues: string[];
}

/**
 * Startup-проверка шаблона профилей: после обновления приложения все
 * `user.json` дополняются недостающими полями. Вызывается из
 * `src/instrumentation.ts` при каждом старте/перезапуске сервера.
 */
export function normalizeUserProfiles(): NormalizeProfilesReport {
  const { records, issues } = scanUserRecords();
  let updated = 0;

  for (const record of records) {
    if (record.missing.includes('passwordHash')) {
      issues.push(
        `users/${record.uid}: отсутствует passwordHash — вход по паролю невозможен`,
      );
    }
    if (!record.changed) continue;

    try {
      // Под локом: нормализация может идти параллельно с записью профиля
      // из другого процесса (несколько инстансов на одном data-dir).
      withDataLock(() => writeStoredUser(record.uid, record.user));
      updated += 1;
    } catch (error) {
      issues.push(
        `users/${record.uid}: не удалось обновить профиль (${error instanceof Error ? error.message : 'unknown'})`,
      );
    }
  }

  return { total: records.length, updated, issues };
}
