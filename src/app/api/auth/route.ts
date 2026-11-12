import { NextResponse } from 'next/server';

import {
  getAuthRateLimiter,
  LOGIN_RATE_LIMIT,
  rateLimitKey,
} from '@/lib/security/rate-limit';
import { authenticateUser } from '@/lib/server-auth';
import { sessionCookieHeader } from '@/lib/session';

/**
 * ─── LANDMARK: LOGIN (только существующие аккаунты) ─────────────────────────
 * POST /api/auth — вход. Свободный логин больше НЕ создаёт аккаунт: страница
 * /login сначала отдельно проверяет существование
 * (POST /api/auth/exists) и предлагает регистрацию
 * (POST /api/auth/register). Поэтому здесь `allowRegistration: false`.
 *
 * Статусы: 400 — не заполнены поля; 401 — неверный пароль; 404 — аккаунт не
 * найден; 429 — превышен лимит попыток; 200 — сессия в httpOnly-cookie.
 *
 * Длину пароля вход НЕ проверяет: политика (минимум 12) действует в момент
 * установки пароля, иначе аккаунты, созданные раньше, потеряли бы доступ.
 * Перебор ограничивает лимитер (10 попыток за 10 минут на IP+логин).
 */
export async function POST(request: Request) {
  try {
    const body = await request.json();
    const { username, password, displayName } = body;

    // Validate inputs
    if (!username || !password) {
      return NextResponse.json(
        { success: false, error: 'Username/Email and password are required.' },
        { status: 400 },
      );
    }

    const limiter = getAuthRateLimiter().check(
      rateLimitKey('login', request, String(username)),
      LOGIN_RATE_LIMIT,
    );
    if (!limiter.allowed) {
      return NextResponse.json(
        {
          success: false,
          error: 'Too many login attempts. Try again later.',
          reason: 'rate_limited',
        },
        {
          status: 429,
          headers: { 'Retry-After': String(limiter.retryAfterSeconds) },
        },
      );
    }

    const result = authenticateUser(username, password, displayName, {
      allowRegistration: false,
    });

    if (!result.success || !result.user) {
      // В журнал — только причина: логин и пароль в лог не попадают.
      console.warn(
        `[security] login rejected: reason=${result.reason ?? 'unknown'}`,
      );
      const status =
        result.reason === 'no_account'
          ? 404
          : result.reason === 'invalid_input'
            ? 400
            : result.reason === 'blocked'
              ? 403
              : 401;
      return NextResponse.json(
        {
          success: false,
          error: result.error || 'Login failed.',
          reason: result.reason,
        },
        { status },
      );
    }

    // Сессия — подписанная httpOnly-cookie; дальше uid берётся только из неё.
    const response = NextResponse.json({
      success: true,
      isNewUser: result.isNewUser,
      user: result.user,
    });
    response.headers.set('Set-Cookie', sessionCookieHeader(result.user.uid));
    return response;
  } catch (error) {
    return NextResponse.json(
      { success: false, error: 'An unexpected error occurred.' },
      { status: 500 },
    );
  }
}
