import { NextResponse } from 'next/server';

import {
  getAuthRateLimiter,
  rateLimitKey,
  RECOVERY_RATE_LIMIT,
} from '@/lib/security/rate-limit';
import { resetCredentialsWithToken } from '@/lib/server-auth';

/**
 * ─── LANDMARK: RECOVER UPDATE ───────────────────────────────────────────────
 * POST /api/auth/recover/update — { token, newPassword, newRecoveryPhrase }
 *
 * Пароль и фразу меняет только одноразовый токен из `recover/verify`; логин в
 * теле больше не принимается (он ничего не доказывает). Токен гасится при
 * успешном обмене и не переживает смену секретов.
 *
 * `newRecoveryPhrase` необязателен: без него фраза остаётся прежней — так
 * legacy-эндпоинт `/api/auth/recover` работает как «сменить только пароль».
 *
 * Статусы: 400 — невалидные поля или неудачная запись; 401 — нет/просрочен/
 * погашен токен; 429 — лимит попыток; 500 — внутренняя ошибка.
 */
export async function POST(request: Request) {
  try {
    const body = (await request.json().catch(() => null)) as Record<
      string,
      unknown
    > | null;

    const token = typeof body?.token === 'string' ? body.token : '';
    const newPassword =
      typeof body?.newPassword === 'string' ? body.newPassword : '';
    const newRecoveryPhrase =
      typeof body?.newRecoveryPhrase === 'string'
        ? body.newRecoveryPhrase
        : undefined;

    const limiter = getAuthRateLimiter().check(
      rateLimitKey('recover-update', request),
      RECOVERY_RATE_LIMIT,
    );
    if (!limiter.allowed) {
      return NextResponse.json(
        {
          success: false,
          error: 'Too many recovery attempts. Try again later.',
          reason: 'rate_limited',
        },
        {
          status: 429,
          headers: { 'Retry-After': String(limiter.retryAfterSeconds) },
        },
      );
    }

    if (token.trim() === '') {
      return NextResponse.json(
        {
          success: false,
          error: 'Recovery token is required.',
          reason: 'invalid_token',
        },
        { status: 401 },
      );
    }

    if (newPassword.length < 4) {
      return NextResponse.json(
        {
          success: false,
          error: 'New password must be at least 4 characters.',
          reason: 'invalid_input',
        },
        { status: 400 },
      );
    }

    if (
      newRecoveryPhrase !== undefined &&
      newRecoveryPhrase.trim() !== '' &&
      newRecoveryPhrase.trim().length < 5
    ) {
      return NextResponse.json(
        {
          success: false,
          error: 'Recovery phrase must be at least 5 characters.',
          reason: 'invalid_input',
        },
        { status: 400 },
      );
    }

    const result = resetCredentialsWithToken(
      token,
      newPassword,
      newRecoveryPhrase,
    );
    if (!result.success) {
      const status = result.reason === 'invalid_token' ? 401 : 400;
      return NextResponse.json(
        { success: false, error: result.error, reason: result.reason },
        { status },
      );
    }

    return NextResponse.json({ success: true });
  } catch (error) {
    console.error('Recovery update error:', error);
    return NextResponse.json(
      { success: false, error: 'An unexpected error occurred.' },
      { status: 500 },
    );
  }
}
