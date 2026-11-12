import { NextResponse } from 'next/server';

import {
  AUTH_MUTATION_RATE_LIMIT,
  getAuthRateLimiter,
  rateLimitKey,
} from '@/lib/security/rate-limit';
import { revokeAllSessionsForUser } from '@/lib/security/sessions';
import { deleteUserAccount, updateUserProfile } from '@/lib/server-auth';
import {
  clearSessionCookieHeader,
  getSessionUid,
  readSession,
} from '@/lib/session';

/**
 * ─── LANDMARK: PROFILE (uid из сессии) ──────────────────────────────────────
 * uid больше не приходит в теле: он берётся из подписанной cookie. Смена
 * логина обновляет `user.json` и индекс, каталог с листами остаётся на месте.
 */
export async function PUT(request: Request) {
  try {
    const uid = getSessionUid(request);
    if (!uid) {
      return NextResponse.json(
        { success: false, error: 'Unauthorized.' },
        { status: 401 },
      );
    }

    const limiter = getAuthRateLimiter().check(
      rateLimitKey('profile-update', request, uid),
      AUTH_MUTATION_RATE_LIMIT,
    );
    if (!limiter.allowed) {
      return NextResponse.json(
        {
          success: false,
          error: 'Too many attempts. Try again later.',
          reason: 'rate_limited',
        },
        {
          status: 429,
          headers: { 'Retry-After': String(limiter.retryAfterSeconds) },
        },
      );
    }

    const body = await request.json();
    const {
      newUsername,
      newDisplayName,
      newPassword,
      newRecoveryPhrase,
      currentPassword,
    } = body;

    if (!newUsername || !newDisplayName) {
      return NextResponse.json(
        { success: false, error: 'Username and display name are required.' },
        { status: 400 },
      );
    }

    const result = updateUserProfile(
      uid,
      newUsername,
      newDisplayName,
      newPassword,
      newRecoveryPhrase,
      { currentPassword },
    );

    if (!result.success || !result.user) {
      const status =
        result.reason === 'invalid_password'
          ? 403
          : result.reason === 'not_found'
            ? 404
            : 400;
      return NextResponse.json(
        { success: false, error: result.error, reason: result.reason },
        { status },
      );
    }

    // Пароль/фраза сменились — гасим остальные устройства, оставляя текущую
    // сессию: пользователь не должен вылетать с той вкладки, где менял пароль.
    const credentialsChanged =
      (typeof newPassword === 'string' && newPassword.trim() !== '') ||
      newRecoveryPhrase !== undefined;
    if (credentialsChanged) {
      const session = readSession(request);
      revokeAllSessionsForUser(uid, session?.jti);
    }

    return NextResponse.json({ success: true, user: result.user });
  } catch (error) {
    console.error('Profile update error:', error);
    return NextResponse.json(
      { success: false, error: 'An unexpected error occurred.' },
      { status: 500 },
    );
  }
}

/**
 * ─── LANDMARK: DELETE ACCOUNT ───────────────────────────────────────────────
 * DELETE /api/auth/profile — удаление СВОЕГО аккаунта. uid, как и в PUT,
 * берётся из сессии, поэтому чужой профиль по этому маршруту не удалить.
 *
 * Требуется текущий пароль (повторная аутентификация): одной живой cookie
 * мало — иначе unlocked-устройство теряло бы аккаунт одним кликом.
 *
 * Статусы: 401 — нет сессии (в т.ч. аккаунт уже удалён); 400 — пароль не
 * передан; 403 — пароль неверный; 404 — профиля нет; 200 — каталог и запись
 * в индексе удалены, cookie стёрта.
 */
export async function DELETE(request: Request) {
  try {
    const uid = getSessionUid(request);
    if (!uid) {
      return NextResponse.json(
        { success: false, error: 'Unauthorized.', reason: 'unauthorized' },
        { status: 401 },
      );
    }

    let password = '';
    try {
      const body = await request.json();
      password = typeof body?.password === 'string' ? body.password : '';
    } catch {
      // Пустое/битое тело — это «пароль не передан», а не 500.
    }

    if (!password.trim()) {
      return NextResponse.json(
        {
          success: false,
          error: 'Password is required.',
          reason: 'invalid_input',
        },
        { status: 400 },
      );
    }

    const result = deleteUserAccount(uid, password);

    if (!result.success) {
      const status =
        result.reason === 'invalid_password'
          ? 403
          : result.reason === 'not_found'
            ? 404
            : result.reason === 'failed'
              ? 500
              : 400;
      return NextResponse.json(
        {
          success: false,
          error: result.error || 'Failed to delete the account.',
          reason: result.reason,
        },
        { status },
      );
    }

    const response = NextResponse.json({ success: true });
    // Сессия больше не нужна: профиля нет, cookie стираем сразу.
    response.headers.set('Set-Cookie', clearSessionCookieHeader());
    return response;
  } catch (error) {
    console.error('Account deletion error:', error);
    return NextResponse.json(
      { success: false, error: 'An unexpected error occurred.' },
      { status: 500 },
    );
  }
}
