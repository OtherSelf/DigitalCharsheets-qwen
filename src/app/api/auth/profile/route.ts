import { NextResponse } from 'next/server';

import { jsonError, unauthorized } from '@/lib/api/respond';
import { readAuthJson } from '@/lib/security/payload';
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
    const uid = await getSessionUid(request);
    if (!uid) return unauthorized();

    const limiter = getAuthRateLimiter().check(
      rateLimitKey('profile-update', request, uid),
      AUTH_MUTATION_RATE_LIMIT,
    );
    if (!limiter.allowed) {
      return jsonError(
        429,
        'Too many attempts. Try again later.',
        'rate_limited',
        { 'Retry-After': String(limiter.retryAfterSeconds) },
      );
    }

    const parsedBody = await readAuthJson(request);
    if (!parsedBody.ok) {
      return jsonError(parsedBody.status, parsedBody.error, parsedBody.reason);
    }
    const {
      newUsername,
      newDisplayName,
      newPassword,
      newRecoveryPhrase,
      currentPassword,
    } = parsedBody.body as {
      newUsername?: string;
      newDisplayName?: string;
      newPassword?: string;
      newRecoveryPhrase?: string;
      currentPassword?: string;
    };

    if (!newUsername || !newDisplayName) {
      return jsonError(400, 'Username and display name are required.');
    }

    const result = await updateUserProfile(
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
      return jsonError(status, result.error || 'Update failed.', result.reason);
    }

    // Пароль/фраза сменились — гасим остальные устройства, оставляя текущую
    // сессию: пользователь не должен вылетать с той вкладки, где менял пароль.
    const credentialsChanged =
      (typeof newPassword === 'string' && newPassword.trim() !== '') ||
      newRecoveryPhrase !== undefined;
    if (credentialsChanged) {
      const session = await readSession(request);
      await revokeAllSessionsForUser(uid, session?.jti);
    }

    return NextResponse.json({ success: true, user: result.user });
  } catch (error) {
    console.error('Profile update error:', error);
    return jsonError(500, 'An unexpected error occurred.');
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
    const uid = await getSessionUid(request);
    if (!uid) return unauthorized();

    let password = '';
    const parsedBody = await readAuthJson(request);
    if (!parsedBody.ok && parsedBody.status === 413) {
      return jsonError(parsedBody.status, parsedBody.error, parsedBody.reason);
    }
    if (parsedBody.ok) {
      password =
        typeof parsedBody.body.password === 'string'
          ? parsedBody.body.password
          : '';
    }

    if (!password.trim()) {
      return jsonError(400, 'Password is required.', 'invalid_input');
    }

    const result = await deleteUserAccount(uid, password);

    if (!result.success) {
      const status =
        result.reason === 'invalid_password'
          ? 403
          : result.reason === 'not_found'
            ? 404
            : result.reason === 'failed'
              ? 500
              : 400;
      return jsonError(
        status,
        result.error || 'Failed to delete the account.',
        result.reason,
      );
    }

    const response = NextResponse.json({ success: true });
    // Сессия больше не нужна: профиля нет, cookie стираем сразу.
    response.headers.set('Set-Cookie', clearSessionCookieHeader());
    return response;
  } catch (error) {
    console.error('Account deletion error:', error);
    return jsonError(500, 'An unexpected error occurred.');
  }
}
