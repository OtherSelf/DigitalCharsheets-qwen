import { NextResponse } from 'next/server';

import { getCharacterModule } from '@/games/character-system';
import { validateCharacterPatch } from '@/lib/character-payload';
import { QuotaExceededError } from '@/lib/quotas';
import { isSafeId } from '@/lib/security/paths';
import { readJsonObject } from '@/lib/security/payload';
import {
  getCharacterFromServer,
  trashCharacterFromServer,
  updateCharacterOnServer,
  type WriteToken,
} from '@/lib/server-storage';
import { getSessionUid } from '@/lib/session';
import type { Character } from '@/lib/types';

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
 * `id` из URL — внешнее значение, из которого строится путь файла, поэтому он
 * проверяется до любых обращений к диску: `..%2Fuser` и подобное — `400`, а не
 * запись в чужой профиль.
 *
 * Патч валидируется схемой редакции поверх текущего листа
 * ([`src/lib/character-payload.ts`](../../../../lib/character-payload.ts)):
 * служебные поля и ключи вне схемы отбрасываются, неверная структура даёт
 * `400` со списком полей, тело больше 1 МБ — `413`.
 *
 * `__page`/`__seq` позволяют отбросить запоздавшую запись: при уходе со
 * страницы keepalive-досылка со свежим снимком и обычный PUT со старыми
 * данными могут прийти в любом порядке, и раньше «побеждал» тот, кто пришёл
 * последним, а не тот, кто сделан последним.
 *
 * Коды ответа:
 *   200 — записано (в т.ч. если запись отброшена как устаревшая);
 *   400 — битое тело, недопустимый id или данные не по схеме;
 *   401 — нет/просрочена сессия;
 *   404 — листа нет;
 *   413 — тело больше лимита;
 *   500 — ошибка чтения/записи файла (клиент повторит: 5xx ретраится).
 */
export async function PUT(
  request: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  const { id } = await params;

  const uid = await getSessionUid(request);
  if (!uid) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  if (!isSafeId(id)) {
    return NextResponse.json(
      { error: 'Invalid character id', reason: 'invalid_id' },
      { status: 400 },
    );
  }

  // keepalive-запрос при уходе со страницы может прийти без тела —
  // это не повод для 500 со стектрейсом, отвечаем понятным 400.
  const parsedBody = await readJsonObject(request);
  if (!parsedBody.ok) {
    return NextResponse.json(
      {
        error: parsedBody.error,
        reason: parsedBody.reason,
      },
      { status: parsedBody.status },
    );
  }
  const body = parsedBody.body;

  const rawPage = body.__page;
  const rawSeq = body.__seq;
  const writeToken: WriteToken | undefined =
    typeof rawPage === 'string' &&
    rawPage.length > 0 &&
    typeof rawSeq === 'number'
      ? { page: rawPage, seq: rawSeq }
      : undefined;

  // Служебные поля не должны попадать в файл листа. `userId` прилетает от
  // старых клиентов — тоже выбрасываем: владелец берётся из сессии.
  const { __page: _page, __seq: _seq, userId: _ignoredUserId, ...patch } = body;

  const current = await getCharacterFromServer(uid, id);
  if (!current) {
    return NextResponse.json({ error: 'Character not found' }, { status: 404 });
  }

  const gameModule = getCharacterModule(
    current as unknown as Record<string, string>,
  );
  if (!gameModule) {
    return NextResponse.json(
      { error: 'Unknown game module for this sheet', reason: 'unknown_system' },
      { status: 400 },
    );
  }

  const validatedPatch = validateCharacterPatch(
    gameModule,
    current as unknown as Record<string, unknown>,
    patch,
  );
  if (!validatedPatch.ok) {
    return NextResponse.json(
      {
        error: 'Character data does not match the game schema.',
        reason: 'invalid_payload',
        issues: validatedPatch.issues,
      },
      { status: 400 },
    );
  }

  let updated;
  try {
    updated = await updateCharacterOnServer(
      uid,
      id,
      validatedPatch.data as Partial<Character>,
      { writeToken },
    );
  } catch (error) {
    if (error instanceof QuotaExceededError) {
      return NextResponse.json(
        {
          error: error.message,
          reason: 'quota_exceeded',
          limit: error.reason,
          sheets: error.usage.sheets,
          bytes: error.usage.bytes,
        },
        { status: 409 },
      );
    }
    console.error(`Failed to write character ${id} for ${uid}:`, error);
    return NextResponse.json(
      { error: 'Failed to write character' },
      { status: 500 },
    );
  }

  if (!updated) {
    return NextResponse.json({ error: 'Character not found' }, { status: 404 });
  }

  return NextResponse.json(updated);
}

// DELETE: перенести лист в корзину; окончательное удаление — trash/archive API.
export async function DELETE(
  request: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  const { id } = await params;

  const uid = await getSessionUid(request);
  if (!uid) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  if (!isSafeId(id)) {
    return NextResponse.json(
      { error: 'Invalid character id', reason: 'invalid_id' },
      { status: 400 },
    );
  }

  const trashed = await trashCharacterFromServer(uid, id);
  if (!trashed) {
    return NextResponse.json({ error: 'Character not found' }, { status: 404 });
  }

  return NextResponse.json({
    success: true,
    trashed: true,
    id: trashed.id,
    deletedAt: trashed.deletedAt,
    expiresAt: trashed.expiresAt,
  });
}
