import { NextResponse } from 'next/server';
import { authenticateUser } from '@/lib/server-auth';
import { sessionCookieHeader } from '@/lib/session';

/**
 * ─── LANDMARK: LOGIN (только существующие аккаунты) ─────────────────────────
 * POST /api/auth — вход. Свободный логин больше НЕ создаёт аккаунт: страница
 * /login сначала отдельно проверяет существование
 * (POST /api/auth/exists) и предлагает регистрацию
 * (POST /api/auth/register). Поэтому здесь `allowRegistration: false`.
 *
 * Статусы: 400 — не заполнены поля/короткий пароль; 404 — аккаунт не найден;
 * 401 — неверный пароль; 200 — сессия в httpOnly-cookie.
 */
export async function POST(request: Request) {
  try {
    const body = await request.json();
    const { username, password, displayName } = body;

    // Validate inputs
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

    const result = authenticateUser(username, password, displayName, {
      allowRegistration: false,
    });

    if (!result.success || !result.user) {
      const status =
        result.reason === 'no_account' ? 404 : result.reason === 'invalid_input' ? 400 : 401;
      return NextResponse.json(
        { success: false, error: result.error || 'Login failed.', reason: result.reason },
        { status }
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
      { status: 500 }
    );
  }
}
