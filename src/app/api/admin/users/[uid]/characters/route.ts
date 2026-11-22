import { NextResponse } from 'next/server';

import { requireAdmin } from '@/lib/admin-auth';
import { listCharactersForAdmin } from '@/lib/admin-users';
import { jsonError } from '@/lib/api/respond';

/**
 * ─── LANDMARK: GET /api/admin/users/[uid]/characters ────────────────────────
 * Список листов чужого пользователя для диалога «список чарлистов» в /admin.
 * Отдаётся только сводка (id, имя, система, класс, уровень/ранг, дата файла):
 * админ видит, что у пользователя есть, но не редактирует чужие листы.
 *
 * Статусы: 401 — нет сессии; 403 — не админ; 404 — профиль не найден;
 * 200 — { characters }.
 */
export async function GET(
  request: Request,
  { params }: { params: Promise<{ uid: string }> },
) {
  const auth = await requireAdmin(request);
  if (!auth.ok) return auth.response;

  const { uid } = await params;
  const characters = await listCharactersForAdmin(uid);
  if (characters === null) {
    return jsonError(404, 'User not found.', 'not_found');
  }

  return NextResponse.json({ success: true, uid, characters });
}
