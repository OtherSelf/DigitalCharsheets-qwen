import { NextResponse } from 'next/server';
import { getCharactersFromServer } from '@/lib/server-storage';

// GET: Export all characters for a user as a downloadable JSON
export async function GET(request: Request) {
  const { searchParams } = new URL(request.url);
  const userId = searchParams.get('userId');
  const characterId = searchParams.get('characterId');

  if (!userId) {
    return NextResponse.json({ error: 'userId is required' }, { status: 400 });
  }

  const characters = getCharactersFromServer(userId);

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