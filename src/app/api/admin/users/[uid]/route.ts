import { NextResponse } from 'next/server';

import { requireAdmin } from '@/lib/admin-auth';
import type {
  AdminActionReason,
  AdminUserUpdatePatch,
} from '@/lib/admin-types';
import { deleteUserByAdmin, updateUserByAdmin } from '@/lib/admin-users';

/**
 * ─── LANDMARK: PATCH/DELETE /api/admin/users/[uid] ──────────────────────────
 * PATCH — правка чужого профиля: displayName, username, password, role,
 * isBlocked. Пустой password = «не менять». Пароль сюда приходит открытым
 * текстом по HTTPS (как и при обычном входе) и сразу превращается в sha256.
 *
 * DELETE — удаление чужого аккаунта вместе с каталогом листов. Себя удалить
 * нельзя (для этого есть /settings), последнего активного админа — тоже.
 *
 * Статусы: 400 — невалидные поля/своя роль/блокировка; 401 — нет сессии;
 * 403 — не админ; 404 — пользователь не найден; 409 — логин занят или это
 * последний админ; 500 — ошибка записи.
 */
function statusForReason(reason?: AdminActionReason): number {
  switch (reason) {
    case 'not_found':
      return 404;
    case 'username_taken':
    case 'last_admin':
      return 409;
    case 'self':
    case 'invalid_input':
      return 400;
    default:
      return 500;
  }
}

export async function PATCH(
  request: Request,
  { params }: { params: Promise<{ uid: string }> },
) {
  const auth = requireAdmin(request);
  if (!auth.ok) return auth.response;

  const { uid } = await params;

  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return NextResponse.json(
      { success: false, error: 'Invalid or empty JSON body.' },
      { status: 400 },
    );
  }

  if (!body || typeof body !== 'object' || Array.isArray(body)) {
    return NextResponse.json(
      { success: false, error: 'Invalid or empty JSON body.' },
      { status: 400 },
    );
  }

  const result = updateUserByAdmin(auth.uid, uid, body as AdminUserUpdatePatch);
  if (!result.success) {
    return NextResponse.json(result, {
      status: statusForReason(result.reason),
    });
  }

  return NextResponse.json({ success: true, user: result.user });
}

export async function DELETE(
  request: Request,
  { params }: { params: Promise<{ uid: string }> },
) {
  const auth = requireAdmin(request);
  if (!auth.ok) return auth.response;

  const { uid } = await params;
  const result = deleteUserByAdmin(auth.uid, uid);
  if (!result.success) {
    return NextResponse.json(result, {
      status: statusForReason(result.reason),
    });
  }

  return NextResponse.json({ success: true });
}
