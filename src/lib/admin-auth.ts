import { NextResponse } from 'next/server';

import { getSessionUid } from './session';
import { readStoredUser } from './user-schema';

/**
 * ─── LANDMARK: ADMIN AUTHORIZATION ─────────────────────────────────────────
 * Проверка «пускать ли в /api/admin/*». Роль берётся из `user.json`, а не из
 * тела запроса и не из localStorage — клиентский снимок профиля можно
 * подменить, серверный файл нет.
 *
 * Ответы:
 *   401 — нет/просрочена сессия или аккаунт удалён/заблокирован;
 *   403 — сессия валидна, но роль не `admin`.
 *
 * Разные статусы важны клиенту: 401 отправляет на /login, 403 — на главную.
 */
export type AdminAuthResult =
  { ok: true; uid: string } | { ok: false; response: NextResponse };

export function requireAdmin(request: Request): AdminAuthResult {
  const uid = getSessionUid(request);
  if (!uid) {
    return {
      ok: false,
      response: NextResponse.json(
        { success: false, error: 'Unauthorized.', reason: 'unauthorized' },
        { status: 401 },
      ),
    };
  }

  const user = readStoredUser(uid);
  if (!user || user.isBlocked || user.role !== 'admin') {
    return {
      ok: false,
      response: NextResponse.json(
        { success: false, error: 'Forbidden.', reason: 'forbidden' },
        { status: 403 },
      ),
    };
  }

  return { ok: true, uid };
}
