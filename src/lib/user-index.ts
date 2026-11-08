import fs from 'fs';
import path from 'path';
import { getLoginIndexFile, getUsersDir } from './data-dir';
import { writeJsonAtomic } from './fs-atomic';
import { normalizeLogin } from './ids';

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
function readIndexFile(): LoginIndex | null {
  try {
    const parsed = JSON.parse(fs.readFileSync(getLoginIndexFile(), 'utf8'));
    if (!parsed || typeof parsed !== 'object') return null;
    if (!parsed.logins || typeof parsed.logins !== 'object' || Array.isArray(parsed.logins)) {
      return null;
    }
    const logins: Record<string, string> = {};
    for (const [login, uid] of Object.entries(parsed.logins)) {
      const key = normalizeLogin(login);
      if (key && typeof uid === 'string' && uid) logins[key] = uid;
    }
    return { version: 1, logins };
  } catch {
    return null;
  }
}

function writeIndexFile(index: LoginIndex): void {
  fs.mkdirSync(path.dirname(getLoginIndexFile()), { recursive: true });
  writeJsonAtomic(getLoginIndexFile(), index);
}

/**
 * Пересобрать индекс сканом `users/* /user.json` и записать его на диск.
 * Битые/чужие каталоги пропускаются: индекс не должен ронять вход.
 */
export function rebuildLoginIndex(): LoginIndex {
  const index = emptyLoginIndex();
  const usersDir = getUsersDir();
  let entries: fs.Dirent[] = [];
  try {
    entries = fs.readdirSync(usersDir, { withFileTypes: true });
  } catch {
    entries = [];
  }

  for (const entry of entries) {
    if (!entry.isDirectory()) continue;
    try {
      const raw = fs.readFileSync(path.join(usersDir, entry.name, 'user.json'), 'utf8');
      const data = JSON.parse(raw) as { username?: unknown; email?: unknown };
      const login = normalizeLogin(String(data.username ?? data.email ?? ''));
      if (!login) continue;
      index.logins[login] = entry.name;
    } catch {
      // Пропускаем недописанный/битый профиль — остальные важнее.
    }
  }

  try {
    writeIndexFile(index);
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
export function readLoginIndex(options: { rebuildIfMissing?: boolean } = {}): LoginIndex {
  const fromDisk = readIndexFile();
  if (fromDisk) return fromDisk;
  if (options.rebuildIfMissing === false) return emptyLoginIndex();
  return rebuildLoginIndex();
}

/**
 * Индекс «для записи» (вызывать под `withDataLock`): если файла нет —
 * пересобираем, иначе дописываем к тому, что на диске.
 */
export function readLoginIndexForUpdate(): LoginIndex {
  return readIndexFile() ?? rebuildLoginIndex();
}

/** Записать индекс на диск. Вызывать под `withDataLock`. */
export function writeLoginIndex(index: LoginIndex): void {
  writeIndexFile(index);
}

/**
 * Найти uid по логину. При промахе пересобирает индекс один раз: это лечит
 * рассинхронизацию после падения между записью user.json и индекса, а также
 * ручное удаление `index/logins.json`.
 */
export function resolveLogin(login: string): string | null {
  const normalized = normalizeLogin(login);
  if (!normalized) return null;

  const index = readLoginIndex();
  const found = index.logins[normalized];
  if (found) return found;

  const rebuilt = rebuildLoginIndex();
  return rebuilt.logins[normalized] ?? null;
}
