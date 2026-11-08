import { NextResponse } from 'next/server';
import {
  updateCharacterOnServer,
  deleteCharacterFromServer,
  type WriteToken,
} from '@/lib/server-storage';
import { getSessionUid } from '@/lib/session';

/**
 * ─── LANDMARK: PUT /api/characters/[id] ─────────────────────────────────────
 * Клиент шлёт частичный патч листа. В теле, кроме данных, приходят служебные
 * поля:
 *   • `__page`  — идентификатор загрузки страницы;
 *   • `__seq`   — монотонный номер правки внутри этой загрузки.
 *
 * Пользователь определяется сессионной cookie, а не телом запроса. Поле
 * `userId` из старых клиентов игнорируется и в файл не попадает.
 *
 * `__page`/`__seq` позволяют отбросить запоздавшую запись: при уходе со
 * страницы keepalive-досылка со свежим снимком и обычный PUT со старыми
 * данными могут прийти в любом порядке, и раньше «побеждал» тот, кто пришёл
 * последним, а не тот, кто сделан последним.
 *
 * Коды ответа:
 *   200 — записано (в т.ч. если запись отброшена как устаревшая);
 *   400 — битое тело;
 *   401 — нет/просрочена сессия;
 *   404 — листа нет;
 *   500 — ошибка чтения/записи файла (клиент повторит: 5xx ретраится).
 */
export async function PUT(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params;

  const uid = getSessionUid(request);
  if (!uid) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  // keepalive-запрос при уходе со страницы может прийти без тела —
  // это не повод для 500 со стектрейсом, отвечаем понятным 400.
  let body: Record<string, unknown>;
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: 'Invalid or empty JSON body' }, { status: 400 });
  }

  const rawPage = body.__page;
  const rawSeq = body.__seq;
  const writeToken: WriteToken | undefined =
    typeof rawPage === 'string' && rawPage.length > 0 && typeof rawSeq === 'number'
      ? { page: rawPage, seq: rawSeq }
      : undefined;

  // Служебные поля не должны попадать в файл листа. `userId` прилетает от
  // старых клиентов — тоже выбрасываем: владелец берётся из сессии.
  const { __page: _page, __seq: _seq, userId: _ignoredUserId, ...patch } = body;

  let updated;
  try {
    updated = updateCharacterOnServer(uid, id, patch as any, { writeToken });
  } catch (error) {
    console.error(`Failed to write character ${id} for ${uid}:`, error);
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

  const uid = getSessionUid(request);
  if (!uid) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  const deleted = deleteCharacterFromServer(uid, id);
  if (!deleted) {
    return NextResponse.json({ error: 'Character not found' }, { status: 404 });
  }

  return NextResponse.json({ success: true });
}
