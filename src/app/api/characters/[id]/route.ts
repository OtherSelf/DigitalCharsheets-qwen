import { NextResponse } from 'next/server';
import { getCharactersFromServer, saveCharactersToServer } from '@/lib/server-storage';

// PUT: Update an existing character
export async function PUT(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params;
  const body = await request.json();
  const userId = body.userId;
  
  if (!userId) {
    return NextResponse.json({ error: 'userId is required' }, { status: 400 });
  }
  
  const characters = getCharactersFromServer(userId);
  const index = characters.findIndex(c => c.id === id);
  
  if (index === -1) {
    return NextResponse.json({ error: 'Character not found' }, { status: 404 });
  }

  characters[index] = { ...characters[index], ...body };
  saveCharactersToServer(userId, characters);

  return NextResponse.json(characters[index]);
}

// DELETE: Remove a character
export async function DELETE(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params;
  const { searchParams } = new URL(request.url);
  const userId = searchParams.get('userId');
  
  if (!userId) {
    return NextResponse.json({ error: 'userId is required' }, { status: 400 });
  }
  
  const characters = getCharactersFromServer(userId);
  const filtered = characters.filter(c => c.id !== id);
  
  if (characters.length === filtered.length) {
    return NextResponse.json({ error: 'Character not found' }, { status: 404 });
  }

  saveCharactersToServer(userId, filtered);
  return NextResponse.json({ success: true });
}