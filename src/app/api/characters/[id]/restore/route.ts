import { NextResponse } from 'next/server';

import { jsonError, NO_STORE, withOwner } from '@/lib/api/respond';
import { QuotaExceededError } from '@/lib/quotas';
import { restoreCharacterFromTrash } from '@/lib/server-storage';

/**
 * ─── LANDMARK: RESTORE FROM TRASH (/api/characters/[id]/restore) ────────────
 * Возврат удалённого листа из корзины. Просроченная запись не
 * восстанавливается (404): её срок уже истёк, и автоочистка вправе была её
 * удалить. Квота листов проверяется как при создании.
 */
export async function POST(
  request: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  return withOwner(request, params, async ({ uid, id }) => {
    try {
      const character = await restoreCharacterFromTrash(uid, id);
      if (!character) {
        return jsonError(
          404,
          'Character not found or the trash entry has expired.',
          'not_found',
        );
      }
      return NextResponse.json(
        { success: true, character },
        { headers: NO_STORE },
      );
    } catch (error) {
      if (error instanceof QuotaExceededError) {
        return jsonError(409, error.message, 'quota_exceeded', undefined, {
          limit: error.reason,
          sheets: error.usage.sheets,
          bytes: error.usage.bytes,
        });
      }
      console.error(`Failed to restore character ${id}:`, error);
      return jsonError(500, 'Failed to restore character.', 'restore_failed');
    }
  });
}
