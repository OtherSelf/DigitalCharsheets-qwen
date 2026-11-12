import { NextResponse } from 'next/server';

import { revokeAllSessionsForUser } from '@/lib/security/sessions';
import {
  clearSessionCookieHeader,
  getSessionUid,
  revokeSessionFromRequest,
} from '@/lib/session';

/**
 * ─── LANDMARK: LOGOUT ───────────────────────────────────────────────────────
 * POST /api/auth/logout — выход. Гасит запись сессии (`jti`) на сервере и
 * стирает cookie, поэтому украденная копия cookie перестаёт работать сразу, а
 * не через 14 дней.
 *
 * Тело `{ "all": true }` — «выйти на всех устройствах»: гасятся все живые
 * сессии текущего uid.
 *
 * Статусы: 200 — вышли (в т.ч. если сессии уже не было); cookie стирается в
 * любом случае.
 */
export async function POST(request: Request) {
  let revokeAll = false;
  try {
    const body = await request.json();
    revokeAll = body?.all === true;
  } catch {
    // Пустое/битое тело — обычный logout.
  }

  if (revokeAll) {
    const uid = getSessionUid(request);
    if (uid) revokeAllSessionsForUser(uid);
  } else {
    revokeSessionFromRequest(request);
  }

  const response = NextResponse.json({ success: true });
  response.headers.set('Set-Cookie', clearSessionCookieHeader());
  return response;
}
