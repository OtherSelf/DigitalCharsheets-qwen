import { Character } from './types';

/**
 * ─── LANDMARK: GUEST DRAFT / PENDING UPDATE ────────────────────────────────
 * Гость, который ещё не вошёл, не пишет на сервер: его черновик персонажа
 * (`pending_character`) и правка демо-листа (`pending_update`) лежат в
 * sessionStorage. Здесь — разбор этих записей и решение, к какому листу их
 * вообще можно применить, чтобы это можно было проверить без React.
 *
 * Почему так: `pending_update` помнит id листа, который видел гость (у демо это
 * литералы `demo-dnd-1` / `demo-dh-1`). Если применить его слепо, после входа
 * уходил PUT на несуществующий лист — 404 и тост «не сохранено», а при
 * совпадении id правка молча ложилась поверх реального персонажа.
 */

export const PENDING_CHARACTER_KEY = 'pending_character';
export const PENDING_UPDATE_KEY = 'pending_update';

/** Черновик персонажа: всё, что собрала форма, — без серверных полей. */
export type DraftCharacter = Omit<Character, 'id' | 'userId'>;

export interface PendingUpdate {
  id: string;
  data: Partial<Character>;
}

const isPlainObject = (value: unknown): value is Record<string, unknown> =>
  typeof value === 'object' && value !== null && !Array.isArray(value);

/** Битый или пустой черновик — это отсутствие черновика, а не падение. */
export function parsePendingCharacter(
  raw: string | null,
): DraftCharacter | null {
  if (!raw) return null;
  try {
    const value: unknown = JSON.parse(raw);
    if (!isPlainObject(value)) return null;
    return value as DraftCharacter;
  } catch {
    return null;
  }
}

/** Разбор правки: нужны непустой id и объект данных, иначе правка отбрасывается. */
export function parsePendingUpdate(raw: string | null): PendingUpdate | null {
  if (!raw) return null;
  try {
    const value: unknown = JSON.parse(raw);
    if (!isPlainObject(value)) return null;
    const { id, data } = value;
    if (typeof id !== 'string' || id.length === 0) return null;
    if (!isPlainObject(data)) return null;
    return { id, data: data as Partial<Character> };
  } catch {
    return null;
  }
}

/**
 * Правку можно применить только к листу, который реально есть в аккаунте.
 * Демо-лист и любой устаревший id отбрасываются: файла с таким id нет,
 * и запись превратилась бы в 404.
 */
export function resolvePendingUpdate(
  raw: string | null,
  characters: ReadonlyArray<Pick<Character, 'id'>>,
): PendingUpdate | null {
  const update = parsePendingUpdate(raw);
  if (!update) return null;
  return characters.some((character) => character.id === update.id)
    ? update
    : null;
}
