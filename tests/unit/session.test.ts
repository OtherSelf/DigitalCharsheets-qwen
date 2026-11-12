import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

import {
  countActiveSessions,
  createSessionRecord,
  isSessionActive,
  readActiveSessions,
  revokeAllSessionsForUser,
  revokeSession,
} from '@/lib/security/sessions';
import {
  clearSessionCookieHeader,
  createSession,
  parseCookieHeader,
  SESSION_COOKIE,
  sessionCookieHeader,
  verifySession,
} from '@/lib/session';

import { removeDir, useTempDataDir } from './helpers';

/**
 * Сессии (SEC-6): серверный реестр `jti` и флаги cookie.
 *
 * Проверяем то, что нельзя проверить «на глаз»: подпись без записи не пускает,
 * logout/смена пароля гасят cookie на другом устройстве, просроченная запись
 * не оживает, `Secure` включается в production по умолчанию.
 */

const UID = '9d1f0d4e-2c0f-4b5e-9f8a-4a1b2c3d4e5f';
let dataDir: string;

beforeEach(() => {
  dataDir = useTempDataDir();
});

afterEach(() => {
  vi.useRealTimers();
  delete process.env.DCS_COOKIE_INSECURE;
  delete process.env.DCS_COOKIE_SECURE;
  removeDir(dataDir);
});

describe('реестр сессий (jti)', () => {
  it('создаёт запись и принимает её, пока она жива', () => {
    const session = createSession(UID);

    expect(session.value.split('.')).toHaveLength(4);
    expect(session.value.startsWith(`${UID}.`)).toBe(true);

    const verified = verifySession(session.value);
    expect(verified?.uid).toBe(UID);
    expect(verified?.jti).toBe(session.jti);
    expect(isSessionActive(session.jti, UID)).toBe(true);
    expect(countActiveSessions(UID)).toBe(1);
  });

  it('logout гасит сессию: та же cookie больше не пускает', () => {
    const session = createSession(UID);

    expect(revokeSession(session.jti)).toBe(true);
    expect(verifySession(session.value)).toBeNull();
    expect(isSessionActive(session.jti, UID)).toBe(false);
    // Повторный logout — уже нечего гасить.
    expect(revokeSession(session.jti)).toBe(false);
  });

  it('сессии разных устройств независимы, отзыв всех оставляет текущую', () => {
    const first = createSession(UID);
    const second = createSession(UID);
    expect(countActiveSessions(UID)).toBe(2);

    // Смена пароля на «первом» устройстве: текущая сессия жива, вторая — нет.
    expect(revokeAllSessionsForUser(UID, first.jti)).toBe(1);
    expect(verifySession(first.value)?.uid).toBe(UID);
    expect(verifySession(second.value)).toBeNull();

    expect(revokeAllSessionsForUser(UID)).toBe(1);
    expect(verifySession(first.value)).toBeNull();
    expect(countActiveSessions(UID)).toBe(0);
  });

  it('отзыв не трогает сессии других пользователей', () => {
    const other = '557e8400-e29b-41d4-a716-446655440000';
    const mine = createSession(UID);
    const theirs = createSession(other);

    expect(revokeAllSessionsForUser(UID)).toBe(1);
    expect(verifySession(theirs.value)?.uid).toBe(other);
    expect(verifySession(mine.value)).toBeNull();
  });

  it('просроченная запись не оживает', () => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date('2026-01-01T00:00:00.000Z'));

    const session = createSession(UID);
    expect(verifySession(session.value)?.uid).toBe(UID);

    // TTL 14 дней: через 14 дней и секунду cookie невалидна.
    vi.setSystemTime(new Date('2026-01-15T00:00:01.000Z'));
    expect(verifySession(session.value)).toBeNull();

    vi.useRealTimers();
    // И на диске её уже нет после чистки при следующей записи.
    createSessionRecord(UID, { ttlMs: 1000 });
    expect(readActiveSessions()).not.toContain(session.jti);
  });

  it('чужая подпись, чужой jti и старый трёхчастный формат отклоняются', () => {
    const session = createSession(UID);
    const [uid, exp, jti, signature] = session.value.split('.');

    expect(
      verifySession(`${uid}.${exp}.${jti}.${signature.slice(0, -2)}xx`),
    ).toBeNull();
    expect(verifySession(`${uid}.${exp}.another-jti.${signature}`)).toBeNull();
    // Cookie прошлой версии приложения (без jti) больше не принимается.
    expect(verifySession(`${uid}.${exp}.${signature}`)).toBeNull();
    expect(verifySession('')).toBeNull();
    expect(verifySession(null)).toBeNull();
  });

  it('jti из подписи нельзя подменить на живой jti другого аккаунта', () => {
    const mine = createSession(UID);
    const other = createSession('557e8400-e29b-41d4-a716-446655440000');
    const [, exp, myJti, mySignature] = mine.value.split('.');
    const otherJti = other.value.split('.')[2];

    expect(otherJti).not.toBe(myJti);
    // Подпись от моего uid + jti чужой сессии: HMAC не сойдётся.
    expect(
      verifySession(`${UID}.${exp}.${otherJti}.${mySignature}`),
    ).toBeNull();
    // Чужой jti не подходит и с корректной подписью: запись принадлежит
    // другому uid.
    expect(isSessionActive(otherJti, UID)).toBe(false);
  });
});

describe('cookie сессии: флаги', () => {
  it('в разработке Secure не ставится, HttpOnly/SameSite всегда', () => {
    const header = sessionCookieHeader(UID);

    expect(header).toMatch(new RegExp(`^${SESSION_COOKIE}=`));
    expect(header).toMatch(/HttpOnly/);
    expect(header).toMatch(/SameSite=Lax/);
    expect(header).toMatch(/Path=\//);
    expect(header).toMatch(/Max-Age=1209600/);
    expect(header).not.toMatch(/Secure/);
  });

  it('в production Secure ставится по умолчанию, включая очистку', () => {
    vi.stubEnv('NODE_ENV', 'production');

    expect(sessionCookieHeader(UID)).toMatch(/; Secure/);
    expect(clearSessionCookieHeader()).toMatch(/; Secure/);

    vi.unstubAllEnvs();
  });

  it('DCS_COOKIE_INSECURE=1 — осознанный opt-out для локальной разработки', () => {
    vi.stubEnv('NODE_ENV', 'production');
    vi.stubEnv('DCS_COOKIE_INSECURE', '1');

    expect(sessionCookieHeader(UID)).not.toMatch(/Secure/);
    expect(clearSessionCookieHeader()).not.toMatch(/Secure/);

    vi.unstubAllEnvs();
  });

  it('DCS_COOKIE_SECURE=1 оставлен как совместимый способ включить Secure', () => {
    vi.stubEnv('DCS_COOKIE_SECURE', '1');
    expect(sessionCookieHeader(UID)).toMatch(/; Secure/);
    vi.unstubAllEnvs();
  });

  it('parseCookieHeader разбирает несколько cookie и percent-encoding', () => {
    const parsed = parseCookieHeader(
      `theme=dark; ${SESSION_COOKIE}=a%2Eb; broken`,
    );
    expect(parsed.theme).toBe('dark');
    expect(parsed[SESSION_COOKIE]).toBe('a.b');
  });
});
