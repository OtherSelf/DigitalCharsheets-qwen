import { NextResponse } from 'next/server';
import { getCharactersFromServer, saveCharactersToServer } from '@/lib/server-storage';
import { Character } from '@/lib/types';

// GET: Fetch all characters for a specific user
export async function GET(request: Request) {
  const { searchParams } = new URL(request.url);
  const userId = searchParams.get('userId');
  
  if (!userId) {
    return NextResponse.json({ error: 'userId is required' }, { status: 400 });
  }
  
  const characters = getCharactersFromServer(userId);
  return NextResponse.json(characters);
}

// POST: Create a new character for a specific user
export async function POST(request: Request) {
  const body = await request.json();
  const userId = body.userId;
  
  if (!userId) {
    return NextResponse.json({ error: 'userId is required' }, { status: 400 });
  }
  
  const characters = getCharactersFromServer(userId);
  
  const newCharacter: Character = {
    ...body,
    id: Date.now().toString(36) + Math.random().toString(36).substr(2),
    userId: userId,
  } as Character;

  characters.push(newCharacter);
  saveCharactersToServer(userId, characters);

  return NextResponse.json(newCharacter, { status: 201 });
}