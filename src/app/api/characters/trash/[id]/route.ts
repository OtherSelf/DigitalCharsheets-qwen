import { NextResponse } from 'next/server';

import { jsonError, NO_STORE, withOwner } from '@/lib/api/respond';
import { purgeTrashEntry } from '@/lib/server-storage';

/**
 * ─── LANDMARK: PURGE TRASH ENTRY (/api/characters/trash/[id]) ──────────────
 * Окончательное удаление одного листа из корзины, не дожидаясь срока.
 * Файл, метаданные и историю убирает storage-слой под общим локом.
 */
export async function DELETE(
  request: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  return withOwner(request, params, async ({ uid, id }) => {
    const removed = await purgeTrashEntry(uid, id);
    if (!removed) {
      return jsonError(404, 'Trash entry not found.', 'not_found');
    }
    return NextResponse.json(
      { success: true, removed: true },
      { headers: NO_STORE },
    );
  });
}
