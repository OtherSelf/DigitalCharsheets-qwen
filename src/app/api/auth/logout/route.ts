import { NextResponse } from 'next/server';

import { clearSessionCookieHeader } from '@/lib/session';

/**
 * Выход: стираем сессионную cookie. Отдельного серверного хранилища сессий
 * нет (подпись самодостаточна), поэтому этого достаточно — клиент ещё чистит
 * свой localStorage.
 */
export async function POST() {
  const response = NextResponse.json({ success: true });
  response.headers.set('Set-Cookie', clearSessionCookieHeader());
  return response;
}
