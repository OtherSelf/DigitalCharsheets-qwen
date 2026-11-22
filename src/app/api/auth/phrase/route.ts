import { NextResponse } from 'next/server';

import { jsonError, unauthorized } from '@/lib/api/respond';
import { readAuthJson } from '@/lib/security/payload';
import {
  AUTH_MUTATION_RATE_LIMIT,
  getAuthRateLimiter,
  rateLimitKey,
} from '@/lib/security/rate-limit';
import { revokeAllSessionsForUser } from '@/lib/security/sessions';
import { setRecoveryPhrase } from '@/lib/server-auth';
import { getSessionUid, readSession } from '@/lib/session';

/**
 * Установка recovery-фразы. Раньше сюда приходил `username` и uid вычислялся
 * из него — то есть фразу можно было поставить любому аккаунту, зная логин.
 * Теперь uid берётся из сессии: менять можно только свой профиль.
 */
export async function POST(request: Request) {
  try {
    const uid = await getSessionUid(request);
    if (!uid) return unauthorized();

    const limiter = getAuthRateLimiter().check(
      rateLimitKey('phrase', request, uid),
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
    const { phrase } = parsedBody.body as { phrase?: string };

    if (!phrase) {
      return jsonError(400, 'Phrase is required.');
    }

    const success = await setRecoveryPhrase(uid, phrase);

    if (!success) {
      return jsonError(500, 'Failed to update recovery phrase.');
    }

    // Новая фраза — новый секрет: чужие сессии (старые устройства) гасим,
    // текущую оставляем.
    await revokeAllSessionsForUser(uid, (await readSession(request))?.jti);

    return NextResponse.json({ success: true });
  } catch (error) {
    return jsonError(500, 'An unexpected error occurred.');
  }
}
