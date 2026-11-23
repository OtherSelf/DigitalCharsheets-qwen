import { NextResponse } from 'next/server';

import type { TotpFailureReason } from '@/lib/totp-service';

import { jsonError } from './respond';

const STATUS: Record<TotpFailureReason, number> = {
  not_found: 404,
  invalid_password: 403,
  totp_unavailable: 503,
  totp_already_enabled: 409,
  totp_not_enabled: 409,
  totp_pending_missing: 409,
  totp_invalid: 403,
  failed: 500,
};

/** Единый маппинг причин TOTP-сервиса в HTTP-ответ. */
export function totpFailureResponse(failure: {
  reason: TotpFailureReason;
  error: string;
}): NextResponse {
  return jsonError(STATUS[failure.reason], failure.error, failure.reason);
}
