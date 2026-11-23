import { NextResponse } from 'next/server';

import { jsonError, unauthorized } from '@/lib/api/respond';
import { totpFailureResponse } from '@/lib/api/totp';
import { readAuthJson } from '@/lib/security/payload';
import {
  AUTH_MUTATION_RATE_LIMIT,
  getAuthRateLimiter,
  rateLimitKey,
} from '@/lib/security/rate-limit';
import { getSessionUid } from '@/lib/session';
import { regenerateBackupCodes } from '@/lib/totp-service';

/** Перегенерировать backup-коды; старые сразу перестают работать. */
export async function POST(request: Request) {
  const uid = await getSessionUid(request);
  if (!uid) return unauthorized();

  const limiter = getAuthRateLimiter().check(
    rateLimitKey('totp-backup-codes', request, uid),
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
  const { currentPassword } = parsedBody.body as { currentPassword?: string };
  const result = await regenerateBackupCodes(uid, currentPassword);
  if (!result.success) return totpFailureResponse(result);
  return NextResponse.json(result);
}
