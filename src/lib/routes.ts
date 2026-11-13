/**
 * ─── LANDMARK: UI ROUTES ────────────────────────────────────────────────────
 * Адреса страниц, на которые ссылается больше одного места. Лист персонажа
 * живёт в `/character/<id>`: отдельное пространство имён не перехватывает
 * любые односегментные пути (раньше `[id]` стоял в корне) и оставляет место
 * для вложенных маршрутов и будущего списка.
 *
 * Собирать URL через функцию, а не шаблонной строкой по месту: переезд
 * маршрута должен быть правкой одной константы, а не поиском по всему `src`.
 */

export const CHARACTERS_ROUTE = '/character';
export const SHARE_ROUTE = '/share';

/** URL листа персонажа по его id. */
export function characterPath(characterId: string): string {
  return `${CHARACTERS_ROUTE}/${encodeURIComponent(characterId)}`;
}

/** URL гостевой ссылки по токену; id листа в адрес не попадает. */
export function sharePath(token: string): string {
  return `${SHARE_ROUTE}/${encodeURIComponent(token)}`;
}

/** URL истории изменений листа. */
export function historyPath(characterId: string): string {
  return `${characterPath(characterId)}/history`;
}
