import crypto from 'crypto';
import fs from 'fs';
import path from 'path';

import { getDataDir, getSessionSecretFile } from './data-dir';
import {
  createSessionRecord,
  isSessionActive,
  revokeSession,
} from './security/sessions';
import { readStoredUser } from './user-schema';

/**
 * ─── LANDMARK: SERVER-SIDE SESSION ──────────────────────────────────────────
 * uid берётся только из подписанной httpOnly-cookie, которую ставит
 * `/api/auth` после проверки пароля. Клиент не может «назвать» себя в
 * query/body.
 *
 * Формат cookie: `<uid>.<exp>.<jti>.<hmac>` (exp — unix-время в секундах).
 * Подпись — HMAC-SHA256 по `<uid>.<exp>.<jti>`, ключ берётся из
 * `DCS_SESSION_SECRET` или из `<data-dir>/.session-secret` (создаётся один
 * раз, права 0600). Cookie `HttpOnly; SameSite=Lax; Path=/`, флаг `Secure`
 * включён по умолчанию в production (отключается только `DCS_COOKIE_INSECURE=1`
 * для локальной разработки).
 *
 * `jti` связывает cookie с записью в `<data-dir>/sessions.json`
 * (`security/sessions.ts`): logout и смена пароля/фразы гасят запись, и та же
 * cookie перестаёт работать, не дожидаясь истечения подписи.
 *
 * Сессия живёт 14 дней. «Выйти на всех устройствах» —
 * `revokeAllSessionsForUser`.
 */

export const SESSION_COOKIE = 'dcs_session';
const SESSION_TTL_SECONDS = 14 * 24 * 60 * 60;

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

function sign(uid: string, exp: number, jti: string): string {
  return crypto
    .createHmac('sha256', getSecret())
    .update(`${uid}.${exp}.${jti}`)
    .digest('base64url');
}

export interface CreatedSession {
  value: string;
  maxAge: number;
  jti: string;
}

/**
 * Создать сессию: завести запись `jti` и собрать подписанную cookie.
 * Вызывается после успешного входа/регистрации.
 */
export function createSession(uid: string): CreatedSession {
  const exp = Math.floor(Date.now() / 1000) + SESSION_TTL_SECONDS;
  const { jti } = createSessionRecord(uid, {
    ttlMs: SESSION_TTL_SECONDS * 1000,
  });
  return {
    value: `${uid}.${exp}.${jti}.${sign(uid, exp, jti)}`,
    maxAge: SESSION_TTL_SECONDS,
    jti,
  };
}

export interface VerifiedSession {
  uid: string;
  jti: string;
  exp: number;
}

/**
 * Проверить подпись, срок и живость записи `jti`.
 * `null` — cookie не наша, просрочена или сессия отозвана.
 */
export function verifySession(
  value: string | null | undefined,
): VerifiedSession | null {
  if (!value) return null;
  const parts = value.split('.');
  if (parts.length !== 4) return null;

  const [uid, expRaw, jti, signature] = parts;
  const exp = Number(expRaw);
  if (!uid || !jti || !signature || !Number.isFinite(exp)) return null;
  if (exp * 1000 <= Date.now()) return null;

  const expected = sign(uid, exp, jti);
  const given = Buffer.from(signature);
  const want = Buffer.from(expected);
  if (given.length !== want.length) return null;
  if (!crypto.timingSafeEqual(given, want)) return null;

  // Подпись верна, но сессию могли погасить явно (logout, смена пароля).
  if (!isSessionActive(jti, uid)) return null;

  return { uid, jti, exp };
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

/** Сессия из запроса: `null`, если cookie нет, она невалидна или погашена. */
export function readSession(request: Request): VerifiedSession | null {
  const cookies = parseCookieHeader(request.headers.get('cookie'));
  return verifySession(cookies[SESSION_COOKIE]);
}

/**
 * uid из запроса или null, если сессии нет/она просрочена/подпись не сходится,
 * запись сессии погашена, профиль удалён или аккаунт заблокирован
 * администратором.
 *
 * Проверка `user.json` нужна после удаления аккаунта: подпись cookie
 * самодостаточна, поэтому старая cookie на другом устройстве осталась бы
 * «валидной». Блокировка проверяется здесь же — правка профиля действует на
 * следующем запросе, поэтому «заблокировать» в админке сразу выкидывает
 * пользователя из всех вкладок.
 */
export function getSessionUid(request: Request): string | null {
  const session = readSession(request);
  if (!session) return null;
  const user = readStoredUser(session.uid);
  if (!user || user.isBlocked) return null;
  return session.uid;
}

/** Погасить сессию из запроса (logout). `false` — сессии уже нет. */
export function revokeSessionFromRequest(request: Request): boolean {
  const session = readSession(request);
  if (!session) return false;
  return revokeSession(session.jti);
}

/**
 * Флаг `Secure` для cookie. По умолчанию включён в production: приложение
 * разворачивают за HTTPS-прокси, а cookie без `Secure` уезжает по http.
 * Отключение — только явным `DCS_COOKIE_INSECURE=1` для локальной разработки.
 * `DCS_COOKIE_SECURE=1` оставлен как совместимый способ включить флаг в dev.
 */
function cookieSecureFlag(): boolean {
  if (process.env.DCS_COOKIE_INSECURE === '1') return false;
  if (process.env.DCS_COOKIE_SECURE === '1') return true;
  return process.env.NODE_ENV === 'production';
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
  if (cookieSecureFlag()) parts.push('Secure');
  return parts.join('; ');
}

/** Заголовок Set-Cookie, который стирает сессию при выходе. */
export function clearSessionCookieHeader(): string {
  const parts = [
    `${SESSION_COOKIE}=`,
    'Path=/',
    'HttpOnly',
    'SameSite=Lax',
    'Max-Age=0',
  ];
  if (cookieSecureFlag()) parts.push('Secure');
  return parts.join('; ');
}
