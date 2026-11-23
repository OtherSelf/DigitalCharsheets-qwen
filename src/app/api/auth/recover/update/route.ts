import { NextResponse } from 'next/server';

import { jsonError } from '@/lib/api/respond';
import { passwordPolicyError } from '@/lib/security/password';
import { readAuthJson } from '@/lib/security/payload';
import { phrasePolicyError } from '@/lib/security/phrase-policy';
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
    const parsedBody = await readAuthJson(request);
    if (!parsedBody.ok) {
      return jsonError(parsedBody.status, parsedBody.error, parsedBody.reason);
    }
    const body = parsedBody.body;

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
      return jsonError(
        429,
        'Too many recovery attempts. Try again later.',
        'rate_limited',
        { 'Retry-After': String(limiter.retryAfterSeconds) },
      );
    }

    if (token.trim() === '') {
      return jsonError(401, 'Recovery token is required.', 'invalid_token');
    }

    const policyError = passwordPolicyError(newPassword);
    if (policyError) {
      return jsonError(400, policyError, 'invalid_input');
    }

    if (newRecoveryPhrase !== undefined && newRecoveryPhrase.trim() !== '') {
      const phraseError = phrasePolicyError(newRecoveryPhrase);
      if (phraseError) {
        return jsonError(400, phraseError, 'invalid_phrase');
      }
    }

    const result = await resetCredentialsWithToken(
      token,
      newPassword,
      newRecoveryPhrase,
    );
    if (!result.success) {
      const status = result.reason === 'invalid_token' ? 401 : 400;
      return jsonError(
        status,
        result.error || 'Recovery failed.',
        result.reason,
      );
    }

    return NextResponse.json({ success: true });
  } catch (error) {
    console.error('Recovery update error:', error);
    return jsonError(500, 'An unexpected error occurred.');
  }
}
