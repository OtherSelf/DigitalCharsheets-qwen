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

/** Текущий путь вкладки (`pathname` + `search`) — для возврата после входа. */
export function currentPathname(): string | null {
  if (typeof window === 'undefined') return null;
  return `${window.location.pathname}${window.location.search}`;
}

/**
 * Вход с возвратом: `/login?next=<путь>`. Гость, открывший ссылку на лист,
 * после входа попадает обратно на лист, а не на главную. Небезопасный или
 * ведущий на сам `/login` путь отбрасывается — иначе получился бы цикл.
 */
export function loginPath(next?: string | null): string {
  const target = safeInternalPath(next, '');
  if (!target || target.startsWith('/login')) return '/login';
  return `/login?next=${encodeURIComponent(target)}`;
}

/**
 * Безопасный внутренний путь для `?from=`: только один ведущий `/`, без
 * `//host` и обратных слэшей (браузер может нормализовать их в `/`).
 */
export function safeInternalPath(
  value: string | null | undefined,
  fallback = '/',
): string {
  if (!value) return fallback;
  if (!value.startsWith('/') || value.startsWith('//')) return fallback;
  if (value.includes('\\')) return fallback;
  return value;
}
