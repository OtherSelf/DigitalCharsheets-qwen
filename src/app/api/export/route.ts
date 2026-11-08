import { NextResponse } from 'next/server';
import { getCharactersFromServer } from '@/lib/server-storage';
import { getSessionUid } from '@/lib/session';

// GET: Export characters of the current user as downloadable JSON
export async function GET(request: Request) {
  const uid = getSessionUid(request);
  if (!uid) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  const { searchParams } = new URL(request.url);
  const characterId = searchParams.get('characterId');

  const characters = getCharactersFromServer(uid);

  if (characterId) {
    // Export single character
    const character = characters.find(c => c.id === characterId);
    if (!character) {
      return NextResponse.json({ error: 'Character not found' }, { status: 404 });
    }
    return NextResponse.json(character);
  }

  // Export all characters
  return NextResponse.json(characters);
}
