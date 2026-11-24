import { isSafeId } from './security/paths';

/**
 * ─── LANDMARK: CHARACTER ORDER ─────────────────────────────────────────────
 * Пользовательский порядок карточек персонажей. Живёт в профиле
 * (`user.json#characterOrder`), а не в листах: лист и экспорт остаются
 * неизменными, а `rev`/`If-Match` из плана DATA не затрагиваются.
 *
 * Массив — только подсказка сортировки: неизвестные и новые id не теряются,
 * они просто идут после заданных в прежнем порядке (по mtime, «свежие сверху»).
 */

/** Больше пятисот карточек один человек вряд ли переставляет вручную. */
export const CHARACTER_ORDER_MAX = 500;

/**
 * Привести значение из профиля/запроса к безопасному списку id: только
 * `[A-Za-z0-9_-]`, без дублей, с лимитом. `undefined` — значение не массив
 * (его нельзя трактовать как «порядок»).
 */
export function normalizeCharacterOrder(value: unknown): string[] | undefined {
  if (!Array.isArray(value)) return undefined;
  const seen = new Set<string>();
  const result: string[] = [];
  for (const item of value) {
    if (!isSafeId(item) || seen.has(item)) continue;
    seen.add(item);
    result.push(item);
    if (result.length >= CHARACTER_ORDER_MAX) break;
  }
  return result;
}

/**
 * Порядок для выдачи: известные id — как задал пользователь, остальные — в
 * конце, сохраняя исходный порядок списка.
 */
export function applyCharacterOrder<T extends { id: string }>(
  list: readonly T[],
  order: readonly string[] | undefined,
): T[] {
  if (!order || order.length === 0) return [...list];

  const position = new Map(order.map((id, index) => [id, index]));
  const known: T[] = [];
  const rest: T[] = [];
  for (const item of list) {
    if (position.has(item.id)) known.push(item);
    else rest.push(item);
  }

  known.sort((a, b) => (position.get(a.id) ?? 0) - (position.get(b.id) ?? 0));
  return [...known, ...rest];
}
