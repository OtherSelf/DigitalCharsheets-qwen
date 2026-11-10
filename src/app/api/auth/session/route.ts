import { NextResponse } from 'next/server';

import { getStoredUser, toLocalUser } from '@/lib/server-auth';
import { getSessionUid } from '@/lib/session';

/**
 * ─── LANDMARK: CURRENT SESSION ──────────────────────────────────────────────
 * GET /api/auth/session — актуальный снимок профиля по httpOnly-cookie.
 *
 * Зачем отдельный роут: клиент держит только localStorage-снимок, который
 * устаревает после смены роли/логина/блокировки. При загрузке приложение
 * сверяется с сервером и:
 *   • получает актуальную роль (пункт «Админка» появляется без перелогина);
 *   • узнаёт, что аккаунт заблокирован (сессия уже невалидна → 401);
 *   • обновляет displayName/username после правки в админке.
 *
 * 401 — сессии нет, профиль удалён или аккаунт заблокирован. Клиент в этом
 * случае стирает локальный снимок и считает пользователя гостем.
 */
export async function GET(request: Request) {
  const uid = getSessionUid(request);
  if (!uid) {
    return NextResponse.json(
      { success: false, error: 'Unauthorized.', reason: 'unauthorized' },
      { status: 401 },
    );
  }

  const stored = getStoredUser(uid);
  if (!stored) {
    return NextResponse.json(
      { success: false, error: 'Unauthorized.', reason: 'unauthorized' },
      { status: 401 },
    );
  }

  return NextResponse.json({ success: true, user: toLocalUser(stored) });
}
