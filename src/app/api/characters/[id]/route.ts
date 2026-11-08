import { NextResponse } from 'next/server';
import {
  updateCharacterOnServer,
  deleteCharacterFromServer,
  type WriteToken,
} from '@/lib/server-storage';

/**
 * ─── LANDMARK: PUT /api/characters/[id] ─────────────────────────────────────
 * Клиент шлёт частичный патч листа. В теле, кроме данных, приходят служебные
 * поля:
 *   • `userId`  — в какой каталог писать (не часть персонажа);
 *   • `__page`  — идентификатор загрузки страницы;
 *   • `__seq`   — монотонный номер правки внутри этой загрузки.
 *
 * `__page`/`__seq` позволяют отбросить запоздавшую запись: при уходе со
 * страницы keepalive-досылка со свежим снимком и обычный PUT со старыми
 * данными могут прийти в любом порядке, и раньше «побеждал» тот, кто пришёл
 * последним, а не тот, кто сделан последним.
 *
 * Коды ответа:
 *   200 — записано (в т.ч. если запись отброшена как устаревшая);
 *   400 — нет userId или битое тело;
 *   404 — листа нет;
 *   500 — ошибка чтения/записи файла (клиент повторит: 5xx ретраится).
 */
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

  if (!userId || typeof userId !== 'string') {
    return NextResponse.json({ error: 'userId is required' }, { status: 400 });
  }

  const rawPage = body.__page;
  const rawSeq = body.__seq;
  const writeToken: WriteToken | undefined =
    typeof rawPage === 'string' && rawPage.length > 0 && typeof rawSeq === 'number'
      ? { page: rawPage, seq: rawSeq }
      : undefined;

  // Служебные поля не должны попадать в файл листа.
  const { __page: _page, __seq: _seq, ...patch } = body;

  let updated;
  try {
    updated = updateCharacterOnServer(userId, id, patch as any, { writeToken });
  } catch (error) {
    console.error(`Failed to write character ${id} for ${userId}:`, error);
    return NextResponse.json({ error: 'Failed to write character' }, { status: 500 });
  }

  if (!updated) {
    return NextResponse.json({ error: 'Character not found' }, { status: 404 });
  }

  return NextResponse.json(updated);
}

// DELETE: Remove a character file
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
