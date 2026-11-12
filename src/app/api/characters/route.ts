import { NextResponse } from 'next/server';

import {
  requireModuleAccess,
  resolveRequestedSystemId,
} from '@/lib/module-access';
import {
  getCharactersFromServer,
  saveCharacterToServer,
} from '@/lib/server-storage';
import { getSessionUid } from '@/lib/session';
import { Character } from '@/lib/types';

/**
 * ─── LANDMARK: CHARACTERS API (uid из сессии) ───────────────────────────────
 * Раньше uid приходил в query/body (`?userId=user-ivpdne`), то есть любой, кто
 * знал логин, мог прочитать чужие листы. Теперь uid берётся из подписанной
 * cookie, а `userId` из запроса игнорируется.
 *
 * POST дополнительно проверяет видимость редакции для роли (этап 6):
 * user не может создать test/hidden даже прямым запросом; tester — test;
 * admin — любую.
 */

// Список листов текущего пользователя; uid — только из сессии.
export async function GET(request: Request) {
  const uid = getSessionUid(request);
  if (!uid) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  const characters = getCharactersFromServer(uid);
  return NextResponse.json(characters);
}

// Создание листа: владелец — из сессии, доступ к редакции — по роли.
export async function POST(request: Request) {
  const body = (await request.json().catch(() => null)) as Record<
    string,
    unknown
  > | null;
  if (!body || typeof body !== 'object' || Array.isArray(body)) {
    return NextResponse.json(
      { success: false, error: 'Invalid JSON body.', reason: 'bad_request' },
      { status: 400 },
    );
  }

  const access = requireModuleAccess(request, resolveRequestedSystemId(body));
  if (!access.ok) {
    return NextResponse.json(
      { success: false, error: access.error, reason: access.reason },
      { status: access.status },
    );
  }

  const newCharacter: Character = {
    ...body,
    systemId: access.systemId,
    id: Date.now().toString(36) + Math.random().toString(36).substr(2),
    userId: access.uid,
  } as unknown as Character;

  saveCharacterToServer(access.uid, newCharacter);
  return NextResponse.json(newCharacter, { status: 201 });
}
