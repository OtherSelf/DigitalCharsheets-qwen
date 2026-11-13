import { getCharacterFromServer } from './server-storage';
import { resolveShareToken } from './shares';
import type { Character } from './types';

/**
 * ─── LANDMARK: SHARED CHARACTER ─────────────────────────────────────────────
 * Гостевой лист готовит сервер: токен → запись реестра → лист с диска. В
 * HTML/RSC не должно попасть ничего, кроме данных самого листа: `userId` и
 * служебные `__*` вычищаются рекурсивно (они могут лежать и во вложенных
 * объектах старых файлов).
 *
 * Функция серверная: `shares.ts` читает data-dir и профиль владельца.
 */
function stripPrivateFields(value: unknown): unknown {
  if (Array.isArray(value)) {
    return value.map((item) => stripPrivateFields(item));
  }
  if (value !== null && typeof value === 'object') {
    const result: Record<string, unknown> = {};
    for (const [key, child] of Object.entries(
      value as Record<string, unknown>,
    )) {
      if (key === 'userId' || key.startsWith('__')) continue;
      result[key] = stripPrivateFields(child);
    }
    return result;
  }
  return value;
}

/** Копия листа без uid владельца и служебных полей; исходный объект не меняется. */
export function sanitizeCharacterForShare(character: Character): Character {
  return stripPrivateFields(character) as Character;
}

/**
 * Резолв гостевой ссылки: токен → uid/characterId → нормализованный лист.
 * `null` — ссылка недействительна или листа больше нет; страница отвечает
 * единым 404, не подтверждая, что токен когда-то существовал.
 */
export function resolveSharedCharacter(token: string): Character | null {
  const share = resolveShareToken(token);
  if (!share) return null;

  const character = getCharacterFromServer(share.uid, share.characterId);
  if (!character) return null;

  return sanitizeCharacterForShare(character);
}
