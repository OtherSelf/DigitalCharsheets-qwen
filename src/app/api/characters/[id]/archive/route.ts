import { NextResponse } from 'next/server';

import { jsonError, NO_STORE, withOwner } from '@/lib/api/respond';
import { QuotaExceededError } from '@/lib/quotas';
import {
  archiveCharacterFromServer,
  unarchiveCharacterFromServer,
} from '@/lib/server-storage';

/**
 * ─── LANDMARK: CHARACTER ARCHIVE (/api/characters/[id]/archive) ─────────────
 * POST — убрать лист из активного списка в архив; DELETE — вернуть обратно.
 * Файл физически перемещается между `characters/` и `archive/`, поэтому
 * обычный GET листа в архиве даёт 404, а ссылка на него отзывается.
 *
 * Возврат проверяет квоту листов: архивный лист не занимает место в лимите,
 * но после возврата снова становится активным.
 */
export async function POST(
  request: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  return withOwner(request, params, async ({ uid, id }) => {
    const archived = await archiveCharacterFromServer(uid, id);
    if (!archived) return jsonError(404, 'Character not found.', 'not_found');
    return NextResponse.json(
      { success: true, character: archived },
      { headers: NO_STORE },
    );
  });
}

export async function DELETE(
  request: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  return withOwner(request, params, async ({ uid, id }) => {
    try {
      const character = await unarchiveCharacterFromServer(uid, id);
      if (!character) {
        return jsonError(404, 'Character not found.', 'not_found');
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
      console.error(`Failed to unarchive character ${id}:`, error);
      return jsonError(500, 'Failed to restore character.', 'restore_failed');
    }
  });
}
