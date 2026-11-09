import { NextResponse } from 'next/server';
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
 * Статусы: 400 — невалидные поля; 409 — логин уже занят; 200 — аккаунт создан.
 */
export async function POST(request: Request) {
  try {
    const body = await request.json();
    const { username, password, displayName, recoveryPhrase } = body;

    if (!username || !password) {
      return NextResponse.json(
        { success: false, error: 'Username/Email and password are required.' },
        { status: 400 }
      );
    }

    if (password.length < 4) {
      return NextResponse.json(
        { success: false, error: 'Password must be at least 4 characters.' },
        { status: 400 }
      );
    }

    if (typeof recoveryPhrase !== 'string' || recoveryPhrase.trim().length < 5) {
      return NextResponse.json(
        { success: false, error: 'Recovery phrase must be at least 5 characters.' },
        { status: 400 }
      );
    }

    const result = registerUser(username, password, displayName, recoveryPhrase);

    if (!result.success || !result.user) {
      const status = result.reason === 'exists' ? 409 : 400;
      return NextResponse.json(
        { success: false, error: result.error || 'Registration failed.', reason: result.reason },
        { status }
      );
    }

    const response = NextResponse.json({
      success: true,
      isNewUser: true,
      user: result.user,
    });
    response.headers.set('Set-Cookie', sessionCookieHeader(result.user.uid));
    return response;
  } catch {
    return NextResponse.json(
      { success: false, error: 'An unexpected error occurred.' },
      { status: 500 }
    );
  }
}
