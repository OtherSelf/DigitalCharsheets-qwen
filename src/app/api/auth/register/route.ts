import { NextResponse } from 'next/server';

import { jsonError } from '@/lib/api/respond';
import { passwordPolicyError } from '@/lib/security/password';
import { readAuthJson } from '@/lib/security/payload';
import {
  getAuthRateLimiter,
  rateLimitKey,
  REGISTER_RATE_LIMIT,
} from '@/lib/security/rate-limit';
import { registerUser } from '@/lib/server-auth';
import { sessionCookieHeader } from '@/lib/session';

/**
 * ─── LANDMARK: REGISTER ─────────────────────────────────────────────────────
 * POST /api/auth/register — явная регистрация (в отличие от входа):
 *   { username, password, displayName, recoveryPhrase }
 *
 * Аккаунт создаётся сразу с recovery-фразой, поэтому после ответа UI может
 * вести пользователя на дашборд без модалки «настройте фразу». Сессия
 * ставится той же httpOnly-cookie, что и при входе.
 *
 * Статусы: 400 — невалидные поля (в т.ч. пароль короче 12 символов);
 * 409 — логин уже занят; 429 — превышен лимит регистраций; 200 — аккаунт создан.
 */
export async function POST(request: Request) {
  try {
    const parsedBody = await readAuthJson(request);
    if (!parsedBody.ok) {
      return jsonError(parsedBody.status, parsedBody.error, parsedBody.reason);
    }
    const { username, password, displayName, recoveryPhrase } =
      parsedBody.body as {
        username?: string;
        password?: string;
        displayName?: string;
        recoveryPhrase?: string;
      };

    if (!username || !password) {
      return jsonError(400, 'Username/Email and password are required.');
    }

    const limiter = getAuthRateLimiter().check(
      rateLimitKey('register', request, String(username)),
      REGISTER_RATE_LIMIT,
    );
    if (!limiter.allowed) {
      return jsonError(
        429,
        'Too many registrations. Try again later.',
        'rate_limited',
        { 'Retry-After': String(limiter.retryAfterSeconds) },
      );
    }

    const policyError = passwordPolicyError(password);
    if (policyError) {
      return jsonError(400, policyError, 'invalid_input');
    }

    if (
      typeof recoveryPhrase !== 'string' ||
      recoveryPhrase.trim().length < 5
    ) {
      return jsonError(400, 'Recovery phrase must be at least 5 characters.');
    }

    const result = await registerUser(
      username,
      password,
      displayName,
      recoveryPhrase,
    );

    if (!result.success || !result.user) {
      const status = result.reason === 'exists' ? 409 : 400;
      return jsonError(
        status,
        result.error || 'Registration failed.',
        result.reason,
      );
    }

    const response = NextResponse.json({
      success: true,
      isNewUser: true,
      user: result.user,
    });
    response.headers.set(
      'Set-Cookie',
      await sessionCookieHeader(result.user.uid),
    );
    return response;
  } catch {
    return jsonError(500, 'An unexpected error occurred.');
  }
}
