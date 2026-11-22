import { NextResponse } from 'next/server';

import { isSafeId } from '@/lib/security/paths';
import { getCharacterFromServer } from '@/lib/server-storage';
import { getSessionUid } from '@/lib/session';
import type { Character } from '@/lib/types';

/** API-ответы с приватными данными не кэшируются. */
export const NO_STORE = { 'Cache-Control': 'no-store' } as const;

/** Единый конверт ошибки: `success:false`, текст и машинная причина. */
export function jsonError(
  status: number,
  message: string,
  reason?: string,
  headers?: Record<string, string>,
  extra?: Record<string, unknown>,
): NextResponse {
  return NextResponse.json(
    {
      success: false,
      error: message,
      ...(reason ? { reason } : {}),
      ...extra,
    },
    { status, headers: headers ? { ...NO_STORE, ...headers } : NO_STORE },
  );
}

export function unauthorized(): NextResponse {
  return jsonError(401, 'Unauthorized.', 'unauthorized');
}

export function invalidCharacterId(): NextResponse {
  return jsonError(400, 'Invalid character id.', 'invalid_id');
}

export function characterNotFound(): NextResponse {
  return jsonError(404, 'Character not found.', 'not_found');
}

/** Проверить сессию и безопасный id листа; дальше — обработчик. */
export async function withOwner(
  request: Request,
  params: Promise<{ id: string }>,
  handler: (context: { uid: string; id: string }) => Promise<Response>,
): Promise<Response> {
  const { id } = await params;
  const uid = await getSessionUid(request);
  if (!uid) return unauthorized();
  if (!isSafeId(id)) return invalidCharacterId();
  return handler({ uid, id });
}

/** То же плюс проверка, что лист существует и принадлежит сессии. */
export async function withOwnedCharacter(
  request: Request,
  params: Promise<{ id: string }>,
  handler: (context: {
    uid: string;
    id: string;
    character: Character;
  }) => Promise<Response>,
): Promise<Response> {
  return withOwner(request, params, async ({ uid, id }) => {
    const character = await getCharacterFromServer(uid, id);
    if (!character) return characterNotFound();
    return handler({ uid, id, character });
  });
}
