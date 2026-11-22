import { NextResponse } from 'next/server';

import {
  jsonError,
  NO_STORE,
  withOwnedCharacter,
  withOwner,
} from '@/lib/api/respond';
import { sharePath } from '@/lib/routes';
import { readJsonObject } from '@/lib/security/payload';
import {
  DEFAULT_SHARE_EXPIRY_DAYS,
  getShareForCharacter,
  isShareExpiryDays,
  issueShareToken,
  revokeShareForCharacter,
} from '@/lib/shares';

/**
 * ─── LANDMARK: SHARE API (/api/characters/[id]/share) ──────────────────────
 * Управление гостевой ссылкой листа: выдать, посмотреть статус, отозвать.
 * uid берётся только из подписанной cookie, id листа проверяется до диска.
 *
 * Токен возвращается ровно один раз в ответе POST: на диске лежит только
 * SHA-256, поэтому GET не может показать ссылку повторно. Потеряли — значит
 * перевыпустили; старая ссылка при этом умирает.
 *
 * Коды:
 *   200/201 — успех;
 *   400 — небезопасный id или недопустимый срок;
 *   401 — нет сессии;
 *   404 — листа нет/он чужой;
 *   500 — не удалось прочитать/записать реестр ссылок.
 */
export async function GET(
  request: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  return withOwnedCharacter(request, params, async ({ uid, id }) => {
    const share = await getShareForCharacter(uid, id);
    return NextResponse.json(
      share
        ? {
            success: true,
            active: true,
            createdAt: share.createdAt,
            expiresAt: share.expiresAt,
            includeHistory: share.includeHistory,
          }
        : { success: true, active: false },
      { headers: NO_STORE },
    );
  });
}

export async function POST(
  request: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  return withOwnedCharacter(request, params, async ({ uid, id }) => {
    const parsedBody = await readJsonObject(request);
    if (!parsedBody.ok) {
      return jsonError(parsedBody.status, parsedBody.error, parsedBody.reason);
    }

    const rawExpiry = parsedBody.body.expiresInDays;
    const expiresInDays =
      rawExpiry === undefined ? DEFAULT_SHARE_EXPIRY_DAYS : rawExpiry;
    if (!isShareExpiryDays(expiresInDays)) {
      return jsonError(
        400,
        'expiresInDays must be 7, 30, 90 or null.',
        'invalid_expiry',
      );
    }

    const rawIncludeHistory = parsedBody.body.includeHistory;
    if (
      rawIncludeHistory !== undefined &&
      typeof rawIncludeHistory !== 'boolean'
    ) {
      return jsonError(
        400,
        'includeHistory must be a boolean.',
        'invalid_include_history',
      );
    }
    const includeHistory = rawIncludeHistory === true;

    try {
      const share = await issueShareToken(uid, id, {
        expiresInDays,
        includeHistory,
      });
      return NextResponse.json(
        {
          success: true,
          token: share.token,
          path: sharePath(share.token),
          createdAt: share.createdAt,
          expiresAt: share.expiresAt,
          includeHistory,
        },
        { status: 201, headers: NO_STORE },
      );
    } catch (cause) {
      console.error(`Failed to issue share link for ${uid}/${id}:`, cause);
      return jsonError(500, 'Failed to create share link.', 'failed');
    }
  });
}

export async function DELETE(
  request: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  return withOwner(request, params, async ({ uid, id }) => {
    try {
      // Идемпотентно: даже если ссылки уже нет или лист удалён, ответ успешный.
      await revokeShareForCharacter(uid, id);
      return NextResponse.json({ success: true }, { headers: NO_STORE });
    } catch (cause) {
      console.error(`Failed to revoke share link for ${uid}/${id}:`, cause);
      return jsonError(500, 'Failed to revoke share link.', 'failed');
    }
  });
}
