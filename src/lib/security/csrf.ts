/**
 * ─── LANDMARK: CSRF ORIGIN GUARD ────────────────────────────────────────────
 * Мутации защищены проверкой `Origin` и `Sec-Fetch-Site`: браузер сам
 * добавляет их к fetch/XHR и форме, подделать из чужого origin нельзя.
 * `SameSite=Lax` — второй слой (cookie не уезжает с cross-site POST).
 *
 * Запросы без этих заголовков (curl, smoke, мобильный клиент) не блокируются:
 * CSRF — атака браузера, а не API-клиента. Double-submit токен не нужен:
 * он потребовал бы правки всех fetch-вызовов и сломал бы API.
 */

export interface CsrfGuardInput {
  origin: string | null;
  secFetchSite: string | null;
  host: string | null;
  forwardedProto: string | null;
}

/** Ожидаемый origin запроса: схема из прокси + Host, который он сохранил. */
function expectedOrigin(host: string, forwardedProto: string | null): string {
  const proto =
    forwardedProto?.split(',')[0]?.trim().toLowerCase() === 'https'
      ? 'https'
      : 'http';
  return `${proto}://${host}`;
}

/**
 * true — мутацию нужно отклонить как cross-site. Проверяются только запросы,
 * у которых есть хотя бы один из заголовков (то есть браузерные).
 */
export function csrfOriginRejected(input: CsrfGuardInput): boolean {
  const { origin, secFetchSite, host, forwardedProto } = input;
  if (!origin && !secFetchSite) return false;
  if (!host) return true;

  if (origin) {
    const expected = expectedOrigin(host, forwardedProto);
    if (origin !== expected) return true;
  }

  if (secFetchSite) {
    const site = secFetchSite.trim().toLowerCase();
    // `none` — инициация пользователем (адресная строка), не cross-site.
    if (site !== 'same-origin' && site !== 'none') return true;
  }

  return false;
}
