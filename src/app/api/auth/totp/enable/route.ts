import { NextResponse } from 'next/server';

import { jsonError, unauthorized } from '@/lib/api/respond';
import { totpFailureResponse } from '@/lib/api/totp';
import { readAuthJson } from '@/lib/security/payload';
import {
  AUTH_MUTATION_RATE_LIMIT,
  getAuthRateLimiter,
  rateLimitKey,
} from '@/lib/security/rate-limit';
import { revokeAllSessionsForUser } from '@/lib/security/sessions';
import { getSessionUid, readSession } from '@/lib/session';
import { enableTotp } from '@/lib/totp-service';

/** Подтвердить код, включить TOTP и выдать backup-коды один раз. */
export async function POST(request: Request) {
  const uid = await getSessionUid(request);
  if (!uid) return unauthorized();

  const limiter = getAuthRateLimiter().check(
    rateLimitKey('totp-enable', request, uid),
    AUTH_MUTATION_RATE_LIMIT,
  );
  if (!limiter.allowed) {
    return jsonError(
      429,
      'Too many attempts. Try again later.',
      'rate_limited',
      {
        'Retry-After': String(limiter.retryAfterSeconds),
      },
    );
  }

  const parsedBody = await readAuthJson(request);
  if (!parsedBody.ok) {
    return jsonError(parsedBody.status, parsedBody.error, parsedBody.reason);
  }
  const { code } = parsedBody.body as { code?: string };
  const result = await enableTotp(uid, code);
  if (!result.success) return totpFailureResponse(result);

  // Второй фактор сменился — старые устройства должны подтвердить его заново.
  await revokeAllSessionsForUser(uid, (await readSession(request))?.jti);
  return NextResponse.json(result);
}
