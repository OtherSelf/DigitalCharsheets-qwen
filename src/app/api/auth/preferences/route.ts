import { NextResponse } from 'next/server';

import { jsonError, unauthorized } from '@/lib/api/respond';
import {
  isLanguage,
  languageCookieHeader,
  SITE_LANGUAGES,
} from '@/lib/language';
import { readAuthJson } from '@/lib/security/payload';
import {
  AUTH_MUTATION_RATE_LIMIT,
  getAuthRateLimiter,
  rateLimitKey,
} from '@/lib/security/rate-limit';
import { updateUserLanguage } from '@/lib/server-auth';
import { getSessionUid } from '@/lib/session';

/**
 * ─── LANDMARK: USER PREFERENCES (/api/auth/preferences) ─────────────────────
 * Выбранный язык интерфейса: профиль (`user.json#language`) плюс cookie
 * `dcs_language` в ответе.
 *
 * Отдельный роут, а не `PUT /api/auth/profile`: язык меняется часто и не
 * требует пароля, тогда как профиль — смена логина/имени/секрета. uid
 * берётся из сессии, тело — только известные поля, иначе 400.
 */
export async function PUT(request: Request) {
  try {
    const uid = await getSessionUid(request);
    if (!uid) return unauthorized();

    const limiter = getAuthRateLimiter().check(
      rateLimitKey('preferences', request, uid),
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
    const { language } = parsedBody.body as { language?: unknown };

    if (!isLanguage(language)) {
      return jsonError(
        400,
        `Language must be one of: ${SITE_LANGUAGES.join(', ')}.`,
        'invalid_language',
      );
    }

    const updated = await updateUserLanguage(uid, language);
    if (!updated) {
      return jsonError(404, 'User not found.', 'not_found');
    }

    const response = NextResponse.json({
      success: true,
      language: updated.language,
    });
    response.headers.set('Set-Cookie', languageCookieHeader(language));
    return response;
  } catch (error) {
    return jsonError(500, 'An unexpected error occurred.');
  }
}
