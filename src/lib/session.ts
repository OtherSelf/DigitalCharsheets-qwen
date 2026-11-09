import crypto from 'crypto';
import fs from 'fs';
import path from 'path';

import { getDataDir, getSessionSecretFile, getUserFile } from './data-dir';

/**
 * ─── LANDMARK: SERVER-SIDE SESSION ──────────────────────────────────────────
 * Раньше клиент присылал `userId` в query/body, и `GET /api/characters?userId=…`
 * отдавал листы любого пользователя: сервер доверял строке из URL. Теперь uid
 * берётся только из подписанной httpOnly-cookie, которую ставит `/api/auth`
 * после проверки пароля.
 *
 * Формат cookie: `<uid>.<exp>.<hmac>` (exp — unix-время в секундах).
 * Подпись — HMAC-SHA256 по `<uid>.<exp>`, ключ берётся из
 * `DCS_SESSION_SECRET` или из `<data-dir>/.session-secret` (создаётся один раз,
 * права 0600). Cookie `HttpOnly; SameSite=Lax; Path=/`; флаг `Secure`
 * включается переменной `DCS_COOKIE_SECURE=1` (за HTTPS-прокси).
 *
 * Сессия живёт 30 дней. Отдельной серверной таблицы сессий нет: подпись
 * самодостаточна, а отзыв делается сменой секрета (выйти из всех устройств).
 */

export const SESSION_COOKIE = 'dcs_session';
const SESSION_TTL_SECONDS = 30 * 24 * 60 * 60;

interface CachedSecret {
  dataDir: string;
  secret: string;
}

let cachedSecret: CachedSecret | null = null;

function getSecret(): string {
  const dataDir = getDataDir();
  if (cachedSecret && cachedSecret.dataDir === dataDir)
    return cachedSecret.secret;

  const fromEnv = process.env.DCS_SESSION_SECRET;
  if (fromEnv && fromEnv.trim() !== '') {
    const secret = fromEnv.trim();
    cachedSecret = { dataDir, secret };
    return secret;
  }

  const file = getSessionSecretFile();
  try {
    const existing = fs.readFileSync(file, 'utf8').trim();
    if (existing) {
      cachedSecret = { dataDir, secret: existing };
      return existing;
    }
  } catch {
    // Файла ещё нет — создадим ниже.
  }

  fs.mkdirSync(path.dirname(file), { recursive: true });
  const generated = crypto.randomBytes(32).toString('hex');
  try {
    // 'wx' — не перезаписываем секрет, созданный параллельным запросом.
    fs.writeFileSync(file, `${generated}\n`, {
      encoding: 'utf8',
      mode: 0o600,
      flag: 'wx',
    });
    cachedSecret = { dataDir, secret: generated };
    return generated;
  } catch (error) {
    if ((error as NodeJS.ErrnoException)?.code === 'EEXIST') {
      const existing = fs.readFileSync(file, 'utf8').trim();
      cachedSecret = { dataDir, secret: existing };
      return existing;
    }
    throw error;
  }
}

function sign(uid: string, exp: number): string {
  return crypto
    .createHmac('sha256', getSecret())
    .update(`${uid}.${exp}`)
    .digest('base64url');
}

/** Собрать пару «значение cookie + время жизни» для uid. */
export function createSession(uid: string): { value: string; maxAge: number } {
  const exp = Math.floor(Date.now() / 1000) + SESSION_TTL_SECONDS;
  return {
    value: `${uid}.${exp}.${sign(uid, exp)}`,
    maxAge: SESSION_TTL_SECONDS,
  };
}

/** Проверить подпись и срок; вернуть uid или null. */
export function verifySession(value: string | null | undefined): string | null {
  if (!value) return null;
  const parts = value.split('.');
  if (parts.length !== 3) return null;

  const [uid, expRaw, signature] = parts;
  const exp = Number(expRaw);
  if (!uid || !signature || !Number.isFinite(exp)) return null;
  if (exp * 1000 <= Date.now()) return null;

  const expected = sign(uid, exp);
  const given = Buffer.from(signature);
  const want = Buffer.from(expected);
  if (given.length !== want.length) return null;
  if (!crypto.timingSafeEqual(given, want)) return null;
  return uid;
}

/** Разобрать заголовок Cookie в словарь. */
export function parseCookieHeader(
  header: string | null,
): Record<string, string> {
  const result: Record<string, string> = {};
  if (!header) return result;
  for (const pair of header.split(';')) {
    const index = pair.indexOf('=');
    if (index <= 0) continue;
    const name = pair.slice(0, index).trim();
    const value = pair.slice(index + 1).trim();
    if (!name) continue;
    try {
      result[name] = decodeURIComponent(value);
    } catch {
      result[name] = value;
    }
  }
  return result;
}

/**
 * uid из запроса или null, если сессии нет/она просрочена/подпись не сходится
 * или профиль удалён.
 *
 * Проверка `user.json` нужна после удаления аккаунта: подпись cookie
 * самодостаточна и живёт 30 дней, поэтому старая cookie на другом устройстве
 * осталась бы «валидной». Без этой проверки `GET/POST /api/characters`
 * воссоздал бы каталог `users/<uid>/characters` и удалённые данные могли бы
 * вернуться. Нет профиля — нет сессии.
 */
export function getSessionUid(request: Request): string | null {
  const cookies = parseCookieHeader(request.headers.get('cookie'));
  const uid = verifySession(cookies[SESSION_COOKIE]);
  if (!uid) return null;
  if (!fs.existsSync(getUserFile(uid))) return null;
  return uid;
}

/** Заголовок Set-Cookie, который ставит сессию после входа. */
export function sessionCookieHeader(uid: string): string {
  const { value, maxAge } = createSession(uid);
  const parts = [
    `${SESSION_COOKIE}=${value}`,
    'Path=/',
    'HttpOnly',
    'SameSite=Lax',
    `Max-Age=${maxAge}`,
  ];
  if (process.env.DCS_COOKIE_SECURE === '1') parts.push('Secure');
  return parts.join('; ');
}

/** Заголовок Set-Cookie, который стирает сессию при выходе. */
export function clearSessionCookieHeader(): string {
  return `${SESSION_COOKIE}=; Path=/; HttpOnly; SameSite=Lax; Max-Age=0`;
}
