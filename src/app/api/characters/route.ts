import { NextResponse } from 'next/server';
import { getCharactersFromServer, saveCharacterToServer } from '@/lib/server-storage';
import { Character } from '@/lib/types';
import { getSessionUid } from '@/lib/session';

/**
 * ─── LANDMARK: CHARACTERS API (uid из сессии) ───────────────────────────────
 * Раньше uid приходил в query/body (`?userId=user-ivpdne`), то есть любой, кто
 * знал логин, мог прочитать чужие листы. Теперь uid берётся из подписанной
 * cookie, а `userId` из запроса игнорируется.
 */

// GET: Fetch all characters for the current user
export async function GET(request: Request) {
  const uid = getSessionUid(request);
  if (!uid) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  const characters = getCharactersFromServer(uid);
  return NextResponse.json(characters);
}

// POST: Create a new character for the current user
export async function POST(request: Request) {
  const uid = getSessionUid(request);
  if (!uid) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  const body = await request.json();

  const newCharacter: Character = {
    ...body,
    id: Date.now().toString(36) + Math.random().toString(36).substr(2),
    userId: uid,
  } as Character;

  saveCharacterToServer(uid, newCharacter);
  return NextResponse.json(newCharacter, { status: 201 });
}
