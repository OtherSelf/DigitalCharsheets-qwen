import fs from 'fs/promises';
import type { Dirent } from 'node:fs';

import { normalizeCharacterOrder } from './character-order';
import { getUserDir, getUserFile, getUsersDir } from './data-dir';
import { withDataLock } from './data-lock';
import { writeJsonAtomic } from './fs-atomic';
import { defaultDisplayName, isUid, normalizeLogin } from './ids';
import { parseLanguage, type Language } from './language';
import { readThroughCache } from './read-cache';
import { isUserRole, type UserRole } from './user-role';

/**
 * ─── LANDMARK: USER PROFILE SCHEMA v6 ──────────────────────────────────────
 * `users/<uid>/user.json` — источник истины по аккаунту. v4 добавила роль
 * `tester` (видит test-редакции, но не админку); v5 — опциональный TOTP
 * (`totp` и `totpBackupCodes`); v6 — выбранный язык интерфейса (`language`),
 * который переживает очистку cookie и переезд на другое устройство.
 * Неизвестная роль нормализуется в `user` (fail-closed). На старте приложения
 * шаблон проверяется: недостающие поля дописываются значениями по умолчанию,
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

export const USER_SCHEMA_VERSION = 6;

/** Второй фактор: секрет в шифре, `enabledAt` отсутствует до подтверждения. */
export interface StoredTotp {
  /** `v1.<iv>.<tag>.<cipher>`; ключ — `DCS_TOTP_KEY`, AAD — uid. */
  secret: string;
  /** Момент подтверждения; без него TOTP не требуется при входе. */
  enabledAt?: string;
  /** Последний принятый шаг: защита от повторного использования кода. */
  lastStep?: number;
}

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
  totp?: StoredTotp;
  /** Ключевые хэши одноразовых backup-кодов (сами коды не хранятся). */
  totpBackupCodes?: string[];
  /**
   * Выбранный язык интерфейса. Отсутствие — «язык не выбран»: первый кадр
   * берёт cookie или `Accept-Language`, а не навязанный `en`.
   */
  language?: Language;
  /**
   * Пользовательский порядок карточек (id листов). Отсутствие — порядок по
   * mtime («свежие сверху»); неизвестные id при выдаче игнорируются.
   */
  characterOrder?: string[];
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

  /*
    Язык не «дозаполняем»: отсутствие поля означает «выбор не сделан», и
    первый кадр должен слушать cookie/`Accept-Language`, а не записывать всем
    старым аккаунтам `en`. Невалидное значение (ручная правка, чужая локаль)
    снимаем, чтобы клиент не упал на неизвестном языке.
  */
  if (user.characterOrder !== undefined) {
    const order = normalizeCharacterOrder(user.characterOrder);
    if (order) user.characterOrder = order;
    else {
      missing.push('characterOrder');
      delete user.characterOrder;
    }
  }

  if (user.language !== undefined) {
    const language = parseLanguage(user.language);
    if (language) user.language = language;
    else {
      missing.push('language');
      delete user.language;
    }
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
export async function readStoredUser(uid: string): Promise<StoredUser | null> {
  if (!isUid(uid)) return null;
  return readThroughCache<StoredUser>(getUserFile(uid), (raw, stat) => {
    const parsed = JSON.parse(raw) as unknown;
    if (!parsed || typeof parsed !== 'object' || Array.isArray(parsed)) {
      return null;
    }
    return normalizeStoredUser(
      uid,
      parsed as Record<string, unknown>,
      new Date(stat.mtimeMs).toISOString(),
    ).user;
  });
}

/** Атомарно записать профиль (каталог создаётся при необходимости). */
export async function writeStoredUser(
  uid: string,
  data: StoredUser,
): Promise<void> {
  await fs.mkdir(getUserDir(uid), { recursive: true });
  await writeJsonAtomic(getUserFile(uid), data);
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
export async function scanUserRecords(): Promise<ScanUserRecordsResult> {
  const records: (ParsedUserRecord & { uid: string })[] = [];
  const issues: string[] = [];

  let entries: Dirent[];
  try {
    entries = await fs.readdir(getUsersDir(), { withFileTypes: true });
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
      mtimeIso = (await fs.stat(file)).mtime.toISOString();
      raw = await fs.readFile(file, 'utf8');
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
export async function listStoredUsers(): Promise<StoredUser[]> {
  return (await scanUserRecords()).records.map((record) => record.user);
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
export async function normalizeUserProfiles(): Promise<NormalizeProfilesReport> {
  const { records, issues } = await scanUserRecords();
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
      await withDataLock(() => writeStoredUser(record.uid, record.user));
      updated += 1;
    } catch (error) {
      issues.push(
        `users/${record.uid}: не удалось обновить профиль (${error instanceof Error ? error.message : 'unknown'})`,
      );
    }
  }

  return { total: records.length, updated, issues };
}
