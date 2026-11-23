import { NextResponse } from 'next/server';

import { NO_STORE, unauthorized } from '@/lib/api/respond';
import { listTrashedCharacters, purgeTrash } from '@/lib/server-storage';
import { getSessionUid } from '@/lib/session';
import { cleanupExpiredTrash, TRASH_RETENTION_DAYS } from '@/lib/trash';

/**
 * ─── LANDMARK: TRASH LIST (/api/characters/trash) ──────────────────────────
 * GET — удалённые листы, которые ещё можно вернуть; DELETE — очистить
 * корзину навсегда. Срок возврата берётся из `TRASH_RETENTION_DAYS`.
 */
export async function GET(request: Request) {
  const uid = await getSessionUid(request);
  if (!uid) return unauthorized();

  try {
    await cleanupExpiredTrash();
  } catch (error) {
    console.error('Lazy trash cleanup failed:', error);
  }

  return NextResponse.json(
    {
      success: true,
      trash: await listTrashedCharacters(uid),
      retentionDays: TRASH_RETENTION_DAYS,
    },
    { headers: NO_STORE },
  );
}

export async function DELETE(request: Request) {
  const uid = await getSessionUid(request);
  if (!uid) return unauthorized();

  const removed = await purgeTrash(uid);
  return NextResponse.json({ success: true, removed }, { headers: NO_STORE });
}
