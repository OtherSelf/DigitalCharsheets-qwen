import { NextResponse } from 'next/server';

import { requireAdmin } from '@/lib/admin-auth';
import { listUsersForAdmin } from '@/lib/admin-users';

/**
 * ─── LANDMARK: GET /api/admin/users ─────────────────────────────────────────
 * Список пользователей для /admin: профиль, роль, блокировка, количество
 * листов и агрегированные счётчики. Доступ — только активному админу.
 *
 * Статусы: 401 — нет сессии/аккаунт заблокирован; 403 — не администратор;
 * 200 — { users, stats }.
 */
export async function GET(request: Request) {
  const auth = requireAdmin(request);
  if (!auth.ok) return auth.response;

  const { users, stats } = listUsersForAdmin();
  return NextResponse.json({ success: true, users, stats });
}
