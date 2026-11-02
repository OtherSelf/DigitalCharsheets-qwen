import { NextResponse } from 'next/server';
import { updateCharacterOnServer, deleteCharacterFromServer, getCharactersFromServer } from '@/lib/server-storage';

// PUT: Update a character
export async function PUT(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params;

  // keepalive-запрос при уходе со страницы может прийти без тела —
  // это не повод для 500 со стектрейсом, отвечаем понятным 400.
  let body: Record<string, unknown>;
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: 'Invalid or empty JSON body' }, { status: 400 });
  }

  const userId = body.userId;

  if (!userId) {
    return NextResponse.json({ error: 'userId is required' }, { status: 400 });
  }

  const updated = updateCharacterOnServer(userId as string, id, body as any);
  if (!updated) {
    return NextResponse.json({ error: 'Character not found' }, { status: 404 });
  }

  return NextResponse.json(updated);
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

  const deleted = deleteCharacterFromServer(userId, id);
  if (!deleted) {
    return NextResponse.json({ error: 'Character not found' }, { status: 404 });
  }

  return NextResponse.json({ success: true });
}