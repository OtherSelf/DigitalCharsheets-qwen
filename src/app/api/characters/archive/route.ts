import { NextResponse } from 'next/server';

import { jsonError, NO_STORE, unauthorized } from '@/lib/api/respond';
import {
  clearArchive,
  listArchivedCharacters,
  listTrashedCharacters,
} from '@/lib/server-storage';
import { getSessionUid } from '@/lib/session';
import { cleanupExpiredTrash, TRASH_RETENTION_DAYS } from '@/lib/trash';

/**
 * ─── LANDMARK: ARCHIVE LIST (/api/characters/archive) ───────────────────────
 * GET отдаёт архив и корзину одним ответом: странице `/archive` нужны обе
 * вкладки, а полные листы ей не нужны — только сводки. cleanupExpiredTrash
 * вызывается лениво (не чаще раза в час), чтобы давно работающий процесс
 * тоже убирал просроченное без перезапуска.
 *
 * DELETE очищает архив навсегда. Корзина очищается отдельным маршрутом:
 * смешивать «убрал с глаз» и «удалил безвозвратно» в одной кнопке нельзя.
 */
export async function GET(request: Request) {
  const uid = await getSessionUid(request);
  if (!uid) return unauthorized();

  try {
    await cleanupExpiredTrash();
  } catch (error) {
    // Очистка не должна ломать просмотр архива: показываем то, что есть.
    console.error('Lazy trash cleanup failed:', error);
  }

  const [archive, trash] = await Promise.all([
    listArchivedCharacters(uid),
    listTrashedCharacters(uid),
  ]);

  return NextResponse.json(
    {
      success: true,
      archive,
      trash,
      retentionDays: TRASH_RETENTION_DAYS,
    },
    { headers: NO_STORE },
  );
}

export async function DELETE(request: Request) {
  const uid = await getSessionUid(request);
  if (!uid) return unauthorized();

  const removed = await clearArchive(uid);
  return NextResponse.json({ success: true, removed }, { headers: NO_STORE });
}
