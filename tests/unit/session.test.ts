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

import { removeDir, useTempDataDir } from '@tests/support';

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
  it('создаёт запись и принимает её, пока она жива', async () => {
    const session = await createSession(UID);

    expect(session.value.split('.')).toHaveLength(4);
    expect(session.value.startsWith(`${UID}.`)).toBe(true);

    const verified = await verifySession(session.value);
    expect(verified?.uid).toBe(UID);
    expect(verified?.jti).toBe(session.jti);
    expect(await isSessionActive(session.jti, UID)).toBe(true);
    expect(await countActiveSessions(UID)).toBe(1);
  });

  it('logout гасит сессию: та же cookie больше не пускает', async () => {
    const session = await createSession(UID);

    expect(await revokeSession(session.jti)).toBe(true);
    expect(await verifySession(session.value)).toBeNull();
    expect(await isSessionActive(session.jti, UID)).toBe(false);
    // Повторный logout — уже нечего гасить.
    expect(await revokeSession(session.jti)).toBe(false);
  });

  it('сессии разных устройств независимы, отзыв всех оставляет текущую', async () => {
    const first = await createSession(UID);
    const second = await createSession(UID);
    expect(await countActiveSessions(UID)).toBe(2);

    // Смена пароля на «первом» устройстве: текущая сессия жива, вторая — нет.
    expect(await revokeAllSessionsForUser(UID, first.jti)).toBe(1);
    expect((await verifySession(first.value))?.uid).toBe(UID);
    expect(await verifySession(second.value)).toBeNull();

    expect(await revokeAllSessionsForUser(UID)).toBe(1);
    expect(await verifySession(first.value)).toBeNull();
    expect(await countActiveSessions(UID)).toBe(0);
  });

  it('отзыв не трогает сессии других пользователей', async () => {
    const other = '557e8400-e29b-41d4-a716-446655440000';
    const mine = await createSession(UID);
    const theirs = await createSession(other);

    expect(await revokeAllSessionsForUser(UID)).toBe(1);
    expect((await verifySession(theirs.value))?.uid).toBe(other);
    expect(await verifySession(mine.value)).toBeNull();
  });

  it('просроченная запись не оживает', async () => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date('2026-01-01T00:00:00.000Z'));

    const session = await createSession(UID);
    expect((await verifySession(session.value))?.uid).toBe(UID);

    // TTL 14 дней: через 14 дней и секунду cookie невалидна.
    vi.setSystemTime(new Date('2026-01-15T00:00:01.000Z'));
    expect(await verifySession(session.value)).toBeNull();

    vi.useRealTimers();
    // И на диске её уже нет после чистки при следующей записи.
    await createSessionRecord(UID, { ttlMs: 1000 });
    expect(await readActiveSessions()).not.toContain(session.jti);
  });

  it('чужая подпись, чужой jti и старый трёхчастный формат отклоняются', async () => {
    const session = await createSession(UID);
    const [uid, exp, jti, signature] = session.value.split('.');

    expect(
      await verifySession(`${uid}.${exp}.${jti}.${signature.slice(0, -2)}xx`),
    ).toBeNull();
    expect(
      await verifySession(`${uid}.${exp}.another-jti.${signature}`),
    ).toBeNull();
    // Cookie прошлой версии приложения (без jti) больше не принимается.
    expect(await verifySession(`${uid}.${exp}.${signature}`)).toBeNull();
    expect(await verifySession('')).toBeNull();
    expect(await verifySession(null)).toBeNull();
  });

  it('jti из подписи нельзя подменить на живой jti другого аккаунта', async () => {
    const mine = await createSession(UID);
    const other = await createSession('557e8400-e29b-41d4-a716-446655440000');
    const [, exp, myJti, mySignature] = mine.value.split('.');
    const otherJti = other.value.split('.')[2];

    expect(otherJti).not.toBe(myJti);
    // Подпись от моего uid + jti чужой сессии: HMAC не сойдётся.
    expect(
      await verifySession(`${UID}.${exp}.${otherJti}.${mySignature}`),
    ).toBeNull();
    // Чужой jti не подходит и с корректной подписью: запись принадлежит
    // другому uid.
    expect(await isSessionActive(otherJti, UID)).toBe(false);
  });
});

describe('cookie сессии: флаги', () => {
  it('в разработке Secure не ставится, HttpOnly/SameSite всегда', async () => {
    const header = await sessionCookieHeader(UID);

    expect(header).toMatch(new RegExp(`^${SESSION_COOKIE}=`));
    expect(header).toMatch(/HttpOnly/);
    expect(header).toMatch(/SameSite=Lax/);
    expect(header).toMatch(/Path=\//);
    expect(header).toMatch(/Max-Age=1209600/);
    expect(header).not.toMatch(/Secure/);
  });

  it('в production Secure ставится по умолчанию, включая очистку', async () => {
    vi.stubEnv('NODE_ENV', 'production');

    expect(await sessionCookieHeader(UID)).toMatch(/; Secure/);
    expect(clearSessionCookieHeader()).toMatch(/; Secure/);

    vi.unstubAllEnvs();
  });

  it('DCS_COOKIE_INSECURE=1 — осознанный opt-out для локальной разработки', async () => {
    vi.stubEnv('NODE_ENV', 'production');
    vi.stubEnv('DCS_COOKIE_INSECURE', '1');

    expect(await sessionCookieHeader(UID)).not.toMatch(/Secure/);
    expect(clearSessionCookieHeader()).not.toMatch(/Secure/);

    vi.unstubAllEnvs();
  });

  it('DCS_COOKIE_SECURE=1 оставлен как совместимый способ включить Secure', async () => {
    vi.stubEnv('DCS_COOKIE_SECURE', '1');
    expect(await sessionCookieHeader(UID)).toMatch(/; Secure/);
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
