import { NextResponse } from 'next/server';

import { getGameModule } from '@/games/registry';
import {
  prepareNewCharacter,
  sanitizeCharacterPayload,
} from '@/lib/character-payload';
import {
  requireModuleAccess,
  resolveRequestedSystemId,
} from '@/lib/module-access';
import { readJsonObject } from '@/lib/security/payload';
import {
  getCharactersFromServer,
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

// Список листов текущего пользователя; uid — только из сессии.
export async function GET(request: Request) {
  const uid = getSessionUid(request);
  if (!uid) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  const characters = getCharactersFromServer(uid);
  return NextResponse.json(characters);
}

// Создание листа: владелец — из сессии, доступ к редакции — по роли.
export async function POST(request: Request) {
  const parsedBody = await readJsonObject(request);
  if (!parsedBody.ok) {
    return NextResponse.json(
      { success: false, error: parsedBody.error, reason: parsedBody.reason },
      { status: parsedBody.status },
    );
  }
  const body = parsedBody.body;

  const access = requireModuleAccess(request, resolveRequestedSystemId(body));
  if (!access.ok) {
    return NextResponse.json(
      { success: false, error: access.error, reason: access.reason },
      { status: access.status },
    );
  }

  const gameModule = getGameModule(access.systemId);
  if (!gameModule) {
    return NextResponse.json(
      {
        success: false,
        error: 'Не удалось определить игру/редакцию персонажа.',
        reason: 'unknown_system',
      },
      { status: 400 },
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
    return NextResponse.json(
      {
        success: false,
        error: 'Character data does not match the game schema.',
        reason: 'invalid_payload',
        issues: prepared.issues,
      },
      { status: 400 },
    );
  }

  const character = prepared.character as unknown as Character;
  saveCharacterToServer(access.uid, character);
  return NextResponse.json(character, { status: 201 });
}
