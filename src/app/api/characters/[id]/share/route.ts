import { NextResponse } from 'next/server';

import { sharePath } from '@/lib/routes';
import { isSafeId } from '@/lib/security/paths';
import { readJsonObject } from '@/lib/security/payload';
import { getCharacterFromServer } from '@/lib/server-storage';
import { getSessionUid } from '@/lib/session';
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
const NO_STORE = { 'Cache-Control': 'no-store' };

function error(
  status: 400 | 401 | 404 | 413 | 500,
  message: string,
  reason: string,
) {
  return NextResponse.json(
    { success: false, error: message, reason },
    { status, headers: NO_STORE },
  );
}

export async function GET(
  request: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  const { id } = await params;
  const uid = getSessionUid(request);
  if (!uid) return error(401, 'Unauthorized.', 'unauthorized');
  if (!isSafeId(id)) return error(400, 'Invalid character id.', 'invalid_id');

  const character = getCharacterFromServer(uid, id);
  if (!character) return error(404, 'Character not found.', 'not_found');

  const share = getShareForCharacter(uid, id);
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
}

export async function POST(
  request: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  const { id } = await params;
  const uid = getSessionUid(request);
  if (!uid) return error(401, 'Unauthorized.', 'unauthorized');
  if (!isSafeId(id)) return error(400, 'Invalid character id.', 'invalid_id');

  const character = getCharacterFromServer(uid, id);
  if (!character) return error(404, 'Character not found.', 'not_found');

  const parsedBody = await readJsonObject(request);
  if (!parsedBody.ok) {
    return error(parsedBody.status, parsedBody.error, parsedBody.reason);
  }

  const rawExpiry = parsedBody.body.expiresInDays;
  const expiresInDays =
    rawExpiry === undefined ? DEFAULT_SHARE_EXPIRY_DAYS : rawExpiry;
  if (!isShareExpiryDays(expiresInDays)) {
    return error(
      400,
      'expiresInDays must be 7, 30, 90 or null.',
      'invalid_expiry',
    );
  }

  try {
    const share = issueShareToken(uid, id, { expiresInDays });
    return NextResponse.json(
      {
        success: true,
        token: share.token,
        path: sharePath(share.token),
        createdAt: share.createdAt,
        expiresAt: share.expiresAt,
      },
      { status: 201, headers: NO_STORE },
    );
  } catch (cause) {
    console.error(`Failed to issue share link for ${uid}/${id}:`, cause);
    return error(500, 'Failed to create share link.', 'failed');
  }
}

export async function DELETE(
  request: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  const { id } = await params;
  const uid = getSessionUid(request);
  if (!uid) return error(401, 'Unauthorized.', 'unauthorized');
  if (!isSafeId(id)) return error(400, 'Invalid character id.', 'invalid_id');

  try {
    // Идемпотентно: даже если ссылки уже нет или лист удалён, ответ успешный.
    revokeShareForCharacter(uid, id);
    return NextResponse.json({ success: true }, { headers: NO_STORE });
  } catch (cause) {
    console.error(`Failed to revoke share link for ${uid}/${id}:`, cause);
    return error(500, 'Failed to revoke share link.', 'failed');
  }
}
