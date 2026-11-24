import crypto from 'node:crypto';

import { NextResponse } from 'next/server';

import { getGameModule } from '@/games/registry';
import { jsonError } from '@/lib/api/respond';
import { applyCharacterOrder } from '@/lib/character-order';
import {
  prepareNewCharacter,
  sanitizeCharacterPayload,
} from '@/lib/character-payload';
import {
  requireModuleAccess,
  resolveRequestedSystemId,
} from '@/lib/module-access';
import { QuotaExceededError } from '@/lib/quotas';
import { readJsonObject } from '@/lib/security/payload';
import { getStoredUser } from '@/lib/server-auth';
import {
  getCharactersFromServer,
  getCharacterSummariesFromServer,
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
 * POST проверяет видимость редакции для роли (user не может создать
 * test/hidden даже прямым запросом; tester — test; admin — любую) и валидирует
 * тело схемой модуля (`module.schema`): лишние поля отбрасываются, неверная
 * структура даёт `400` со списком полей, тело больше 1 МБ — `413`.
 */

/**
 * Список листов текущего пользователя; uid — только из сессии.
 *
 * `?view=summary` — аддитивный режим для карточек: только id/name/systemId/
 * updatedAt, без полного листа. Без параметра ответ прежний.
 *
 * ETag считается по тем же байтам, что уходят клиенту, поэтому повторный GET
 * с `If-None-Match` получает 304 и не скачивает список. `private, no-cache`
 * разрешает браузеру хранить копию, но требует ревалидации; HTML и /share
 * остаются `no-store` (LANDMARK: HTML_MUST_REVALIDATE).
 */
export async function GET(request: Request) {
  const uid = await getSessionUid(request);
  if (!uid) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  const { searchParams } = new URL(request.url);
  const summaryView = searchParams.get('view') === 'summary';
  // Порядок карточек — из профиля: неизвестные id игнорируются, новые листы
  // идут после заданных. Для `?view=summary` действует то же правило.
  const profile = await getStoredUser(uid);
  const order = profile?.characterOrder;
  const data = summaryView
    ? applyCharacterOrder(await getCharacterSummariesFromServer(uid), order)
    : applyCharacterOrder(await getCharactersFromServer(uid), order);
  const body = JSON.stringify(data);
  const etag = `"${crypto
    .createHash('sha256')
    .update(body)
    .digest('base64url')
    .slice(0, 27)}"`;
  const headers = {
    'Cache-Control': 'private, no-cache',
    ETag: etag,
  };

  const ifNoneMatch = request.headers.get('if-none-match');
  if (
    ifNoneMatch &&
    ifNoneMatch
      .split(',')
      .map((value) => value.trim())
      .includes(etag)
  ) {
    return new NextResponse(null, { status: 304, headers });
  }

  return new NextResponse(body, {
    status: 200,
    headers: { ...headers, 'Content-Type': 'application/json' },
  });
}

// Создание листа: владелец — из сессии, доступ к редакции — по роли.
export async function POST(request: Request) {
  const parsedBody = await readJsonObject(request);
  if (!parsedBody.ok) {
    return jsonError(parsedBody.status, parsedBody.error, parsedBody.reason);
  }
  const body = parsedBody.body;

  const access = await requireModuleAccess(
    request,
    resolveRequestedSystemId(body),
  );
  if (!access.ok) {
    return jsonError(access.status, access.error, access.reason);
  }

  const gameModule = getGameModule(access.systemId);
  if (!gameModule) {
    return jsonError(
      400,
      'Не удалось определить игру/редакцию персонажа.',
      'unknown_system',
    );
  }

  // Служебные поля (id/userId/systemId/__*) и ключи вне схемы модуля в файл не
  // попадают: сервер сам выдаёт id и владельца.
  const { data } = sanitizeCharacterPayload(gameModule, body);

  // Недостающие поля заполняет сама редакция (`createDefaults`): клиент может
  // прислать частичный лист (черновик), а на диске должен лежать полный по
  // схеме, иначе рендер упадёт на первом же отсутствующем поле.
  const prepared = prepareNewCharacter(gameModule, data, {
    systemId: access.systemId,
    id: Date.now().toString(36) + Math.random().toString(36).substr(2),
    userId: access.uid,
  });
  if (!prepared.ok) {
    return jsonError(
      400,
      'Character data does not match the game schema.',
      'invalid_payload',
      undefined,
      { issues: prepared.issues },
    );
  }

  const character = prepared.character as unknown as Character;
  try {
    await saveCharacterToServer(access.uid, character);
  } catch (error) {
    if (error instanceof QuotaExceededError) {
      return jsonError(409, error.message, 'quota_exceeded', undefined, {
        limit: error.reason,
        sheets: error.usage.sheets,
        bytes: error.usage.bytes,
      });
    }
    throw error;
  }
  return NextResponse.json(character, { status: 201 });
}
