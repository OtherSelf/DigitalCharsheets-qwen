import { NextResponse } from 'next/server';

import { jsonError, NO_STORE, withOwnedCharacter } from '@/lib/api/respond';
import { deleteCharacterHistory, readHistory } from '@/lib/character-history';
import { groupHistorySessions } from '@/lib/history-session';

/**
 * ─── LANDMARK: HISTORY API (/api/characters/[id]/history) ──────────────────
 * Владелец читает историю листа и может её очистить. uid — только из сессии,
 * id листа проверяется до диска; чужой/несуществующий лист даёт 404.
 *
 * GET отдаёт уже сгруппированные сессии (30-минутные окна) и курсор для
 * следующей страницы. На страницу — не больше 50 сессий и ~2000 изменений,
 * чтобы ответ не разрастался до мегабайт.
 *
 * DELETE необратим: удаляет journal-файл, но не сам лист.
 */
const DEFAULT_LIMIT = 50;
const MAX_LIMIT = 100;
const MAX_CHANGES_PER_PAGE = 2000;

export async function GET(
  request: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  return withOwnedCharacter(request, params, async ({ uid, id }) => {
    const url = new URL(request.url);
    const rawLimit = url.searchParams.get('limit');
    let limit = DEFAULT_LIMIT;
    if (rawLimit !== null) {
      const parsed = Number(rawLimit);
      if (!Number.isInteger(parsed) || parsed < 1 || parsed > MAX_LIMIT) {
        return jsonError(
          400,
          'limit must be an integer from 1 to 100.',
          'invalid_limit',
        );
      }
      limit = parsed;
    }

    const rawBefore = url.searchParams.get('before');
    let beforeMs: number | null = null;
    if (rawBefore !== null) {
      const parsed = Date.parse(rawBefore);
      if (!Number.isFinite(parsed)) {
        return jsonError(400, 'before must be an ISO date.', 'invalid_before');
      }
      beforeMs = parsed;
    }

    const stored = await readHistory(uid, id);
    const sessions = groupHistorySessions(stored.revisions);
    const filtered =
      beforeMs === null
        ? sessions
        : sessions.filter((session) => {
            const started = Date.parse(session.startedAt);
            return Number.isFinite(started) && started < beforeMs;
          });

    const selected: typeof filtered = [];
    let changeCount = 0;
    for (const session of filtered) {
      if (selected.length >= limit) break;
      if (
        selected.length > 0 &&
        changeCount + session.changes.length > MAX_CHANGES_PER_PAGE
      ) {
        break;
      }
      selected.push(session);
      changeCount += session.changes.length;
    }

    const nextCursor =
      selected.length < filtered.length
        ? (selected[selected.length - 1]?.startedAt ?? null)
        : null;

    return NextResponse.json(
      {
        sessions: selected,
        nextCursor,
        totalSessions: sessions.length,
        totalRevisions: stored.revisions.length,
        storage: {
          bytes: stored.bytes,
          truncated: stored.truncated,
          oldestAt: stored.oldestAt,
        },
      },
      { headers: NO_STORE },
    );
  });
}

export async function DELETE(
  request: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  return withOwnedCharacter(request, params, async ({ uid, id }) => {
    return NextResponse.json(
      { success: true, deleted: await deleteCharacterHistory(uid, id) },
      { headers: NO_STORE },
    );
  });
}
