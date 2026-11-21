import fs from 'fs/promises';
import type { Dirent } from 'node:fs';
import path from 'path';

import { getDataDir, getLoginIndexFile, getUsersDir } from './data-dir';
import { writeJsonAtomic } from './fs-atomic';
import { normalizeLogin } from './ids';
import { readThroughCache } from './read-cache';

/**
 * ─── LANDMARK: LOGIN INDEX ──────────────────────────────────────────────────
 * Личность пользователя — `uid` (случайный UUID), логин — изменяемый атрибут.
 * Чтобы вход «логин + пароль» не сканировал все каталоги, держим индекс
 * `<data-dir>/index/logins.json`:
 *
 *   { "version": 1, "logins": { "hero@example.com": "<uid>" } }
 *
 * Индекс ПРОИЗВОДНЫЙ: источник истины — `users/<uid>/user.json`. Файл можно
 * удалить в любой момент, он пересоберётся сканом каталогов. Поэтому запись
 * user.json и индекса не обязана быть транзакционной: если процесс упадёт
 * между ними, `resolveLogin` при промахе пересоберёт индекс и найдёт аккаунт.
 *
 * Мутации индекса вызывают только под `withDataLock` (data-lock.ts), иначе
 * два параллельных запроса могут потерять чужую запись.
 */

export interface LoginIndex {
  version: 1;
  logins: Record<string, string>;
}

export function emptyLoginIndex(): LoginIndex {
  return { version: 1, logins: {} };
}

/** Прочитать индекс с диска. `null` — файла нет или он битый. */
async function readIndexFile(): Promise<LoginIndex | null> {
  return readThroughCache<LoginIndex>(getLoginIndexFile(), (raw) => {
    const parsed = JSON.parse(raw) as unknown;
    if (!parsed || typeof parsed !== 'object' || Array.isArray(parsed)) {
      return null;
    }
    const rawLogins = (parsed as { logins?: unknown }).logins;
    if (
      !rawLogins ||
      typeof rawLogins !== 'object' ||
      Array.isArray(rawLogins)
    ) {
      return null;
    }
    const logins: Record<string, string> = {};
    for (const [login, uid] of Object.entries(
      rawLogins as Record<string, unknown>,
    )) {
      const key = normalizeLogin(login);
      if (key && typeof uid === 'string' && uid) logins[key] = uid;
    }
    return { version: 1, logins };
  });
}

async function writeIndexFile(index: LoginIndex): Promise<void> {
  await fs.mkdir(path.dirname(getLoginIndexFile()), { recursive: true });
  await writeJsonAtomic(getLoginIndexFile(), index);
}

/**
 * Пересобрать индекс сканом `users/* /user.json` и записать его на диск.
 * Битые/чужие каталоги пропускаются: индекс не должен ронять вход.
 */
export async function rebuildLoginIndex(): Promise<LoginIndex> {
  const index = emptyLoginIndex();
  const usersDir = getUsersDir();
  let entries: Dirent[];
  try {
    entries = await fs.readdir(usersDir, { withFileTypes: true });
  } catch {
    entries = [];
  }

  for (const entry of entries) {
    if (!entry.isDirectory()) continue;
    try {
      const raw = await fs.readFile(
        path.join(usersDir, entry.name, 'user.json'),
        'utf8',
      );
      const data = JSON.parse(raw) as { username?: unknown; email?: unknown };
      const login = normalizeLogin(String(data.username ?? data.email ?? ''));
      if (!login) continue;
      index.logins[login] = entry.name;
    } catch {
      // Пропускаем недописанный/битый профиль — остальные важнее.
    }
  }

  try {
    await writeIndexFile(index);
  } catch {
    // Каталог только для чтения / нет места: отдаём индекс в памяти,
    // следующий вход попробует пересобрать снова.
  }
  return index;
}

/**
 * Индекс «для чтения». Если файла нет или он битый — пересобираем.
 * `rebuildIfMissing: false` — не трогать диск (используется в тестах/диагностике).
 */
export async function readLoginIndex(
  options: { rebuildIfMissing?: boolean } = {},
): Promise<LoginIndex> {
  const fromDisk = await readIndexFile();
  if (fromDisk) return fromDisk;
  if (options.rebuildIfMissing === false) return emptyLoginIndex();
  return rebuildLoginIndex();
}

/**
 * Индекс «для записи» (вызывать под `withDataLock`): если файла нет —
 * пересобираем, иначе дописываем к тому, что на диске.
 */
export async function readLoginIndexForUpdate(): Promise<LoginIndex> {
  return (await readIndexFile()) ?? rebuildLoginIndex();
}

/** Записать индекс на диск. Вызывать под `withDataLock`. */
export async function writeLoginIndex(index: LoginIndex): Promise<void> {
  await writeIndexFile(index);
}

/**
 * Пересборка индекса на промахе — не чаще одного раза в минуту на data-dir.
 * Раньше любой несуществующий логин (а это дешёвый запрос для перебора)
 * заставлял читать все `user.json` с диска: лимитер ограничивает попытки, но
 * сам скан не должен быть бесплатным. Гонка «профиль записан, индекс — ещё
 * нет» переживается следующей попыткой входа в пределах минуты.
 */
const REBUILD_COOLDOWN_MS = 60_000;
let lastRebuild: { dataDir: string; at: number } | null = null;

/** Сбросить троттлинг пересборки (тесты, диагностика). */
export function resetLoginIndexRebuildCooldown(): void {
  lastRebuild = null;
}

function mayRebuildNow(dataDir: string, now: number): boolean {
  if (
    lastRebuild &&
    lastRebuild.dataDir === dataDir &&
    now - lastRebuild.at < REBUILD_COOLDOWN_MS
  ) {
    return false;
  }
  lastRebuild = { dataDir, at: now };
  return true;
}

/**
 * Найти uid по логину. При промахе пересобирает индекс (не чаще раза в
 * минуту): это лечит рассинхронизацию после падения между записью user.json и
 * индекса, а также ручное удаление `index/logins.json`.
 */
export async function resolveLogin(login: string): Promise<string | null> {
  const normalized = normalizeLogin(login);
  if (!normalized) return null;

  const index = await readLoginIndex();
  const found = index.logins[normalized];
  if (found) return found;

  if (!mayRebuildNow(getDataDir(), Date.now())) return null;

  const rebuilt = await rebuildLoginIndex();
  return rebuilt.logins[normalized] ?? null;
}
