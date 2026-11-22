import { NextResponse } from 'next/server';

import { jsonError } from '@/lib/api/respond';
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
 * Статусы: 400 — не заполнены поля; 401 — «нет такого аккаунта» и «неверный
 * пароль» неразличимы; 403 — аккаунт заблокирован (виден только после верного
 * пароля); 429 — превышен лимит попыток; 200 — сессия в httpOnly-cookie.
 *
 * Длину пароля вход НЕ проверяет: политика (минимум 12) действует в момент
 * установки пароля, иначе аккаунты, созданные раньше, потеряли бы доступ.
 * Перебор ограничивает лимитер (10 попыток за 10 минут на IP+логин).
 */
export async function POST(request: Request) {
  try {
    const body = await request.json();
    const { username, password, displayName } = body;

    if (!username || !password) {
      return jsonError(400, 'Username/Email and password are required.');
    }

    // Ключ окна — IP + логин. Считаются неудачные попытки: успешный вход
    // сбрасывает окно, иначе человек, который несколько раз переключался
    // между аккаунтами (или ждал в очереди с общим NAT), упирался бы в 429.
    const loginKey = rateLimitKey('login', request, String(username));
    const limiter = getAuthRateLimiter().check(loginKey, LOGIN_RATE_LIMIT);
    if (!limiter.allowed) {
      return jsonError(
        429,
        'Too many login attempts. Try again later.',
        'rate_limited',
        { 'Retry-After': String(limiter.retryAfterSeconds) },
      );
    }

    const result = await authenticateUser(username, password, displayName, {
      allowRegistration: false,
    });

    if (!result.success || !result.user) {
      // В журнал — только причина: логин и пароль в лог не попадают.
      console.warn(
        `[security] login rejected: reason=${result.reason ?? 'unknown'}`,
      );

      // «Нет аккаунта» и «неверный пароль» — один статус и один текст:
      // иначе логин становится оракулом перечисления аккаунтов (SEC-9).
      if (
        result.reason === 'no_account' ||
        result.reason === 'invalid_password'
      ) {
        return jsonError(
          401,
          'Invalid login or password.',
          'invalid_credentials',
        );
      }

      // Блокировка видна только после верного пароля, поэтому аккаунт не
      // выдаёт; ошибки валидации полей — 400.
      const status =
        result.reason === 'invalid_input'
          ? 400
          : result.reason === 'blocked'
            ? 403
            : 401;
      return jsonError(status, result.error || 'Login failed.', result.reason);
    }

    // Успешный вход обнуляет счётчик неудач для этой пары IP+логин.
    getAuthRateLimiter().reset(loginKey);

    // Сессия — подписанная httpOnly-cookie; дальше uid берётся только из неё.
    const response = NextResponse.json({
      success: true,
      isNewUser: result.isNewUser,
      user: result.user,
    });
    response.headers.set(
      'Set-Cookie',
      await sessionCookieHeader(result.user.uid),
    );
    return response;
  } catch (error) {
    return jsonError(500, 'An unexpected error occurred.');
  }
}
