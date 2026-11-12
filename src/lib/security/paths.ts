import path from 'path';

/**
 * ─── LANDMARK: PATH SAFETY ──────────────────────────────────────────────────
 * id листа приходит из URL (`/api/characters/[id]`), а попадает в путь
 * `<data-dir>/users/<uid>/characters/<id>.json`. Без проверки `..%2Fuser` давал
 * `users/<uid>/user.json`, а `..%2F..%2F<uid>%2Fuser` — чужой профиль, то есть
 * подмену `passwordHash` и захват аккаунта.
 *
 * Поэтому любой внешний id проходит две независимые проверки:
 *   1) безопасный алфавит и длина — `isSafeId`;
 *   2) результат `path.resolve` обязан остаться внутри базового каталога —
 *      `resolveInside` (ловит и платформенные варианты разделителей, и
 *      абсолютные пути).
 *
 * Функции возвращают `null`/`false` вместо исключений: роут должен ответить
 * `400`, а не `500`, и до файловой системы дойти не должен.
 */

/** Разрешённые символы id: буквы, цифры, `_`, `-`. */
const SAFE_ID_RE = /^[A-Za-z0-9_-]{1,64}$/;

export const MAX_SAFE_ID_LENGTH = 64;

/**
 * Безопасен ли id для использования как имя файла.
 * `path.basename` — вторая, независимая от regex проверка: если шаблон
 * когда-нибудь ослабят, `..` и разделители всё равно отсекутся.
 */
export function isSafeId(value: unknown): value is string {
  if (typeof value !== 'string') return false;
  if (!SAFE_ID_RE.test(value)) return false;
  return path.basename(value) === value;
}

/**
 * Собрать путь `<baseDir>/<fileName>` и убедиться, что он не выходит из
 * `baseDir`. Возвращает `null`, если выход за границу произошёл.
 */
export function resolveInside(
  baseDir: string,
  fileName: string,
): string | null {
  const base = path.resolve(baseDir);
  const resolved = path.resolve(base, fileName);
  if (resolved === base) return null;
  const prefix = base.endsWith(path.sep) ? base : `${base}${path.sep}`;
  return resolved.startsWith(prefix) ? resolved : null;
}

/**
 * Путь к файлу листа: `null`, если id не безопасен или путь выходит из
 * каталога листов. Единственная точка, где id превращается в путь на диске.
 */
export function resolveCharacterFile(
  charactersDir: string,
  characterId: unknown,
): string | null {
  if (!isSafeId(characterId)) return null;
  return resolveInside(charactersDir, `${characterId}.json`);
}
