/**
 * ─── LANDMARK: CSP ─────────────────────────────────────────────────────────
 * Политика собирается в одном месте: `proxy.ts` добавляет nonce на запрос,
 * тесты проверяют директивы. `style-src 'unsafe-inline'` остаётся осознанно:
 * в коде есть inline-атрибуты стилей (включая global-error), а nonce на
 * style-атрибуты не распространяется.
 */
export interface CspOptions {
  /** nonce для script-src; без него остаётся 'unsafe-inline'. */
  nonce?: string;
  isDev: boolean;
}

export function buildContentSecurityPolicy({
  nonce,
  isDev,
}: CspOptions): string {
  const scriptSrc = nonce
    ? `script-src 'self' 'nonce-${nonce}' 'strict-dynamic'${isDev ? " 'unsafe-eval'" : ''}`
    : `script-src 'self' 'unsafe-inline'${isDev ? " 'unsafe-eval'" : ''}`;

  return [
    "default-src 'self'",
    scriptSrc,
    "style-src 'self' 'unsafe-inline'",
    "img-src 'self' data: blob: https://placehold.co https://images.unsplash.com https://picsum.photos",
    "font-src 'self' data:",
    ["connect-src 'self'", isDev ? 'ws: wss:' : ''].filter(Boolean).join(' '),
    "media-src 'self' blob: data:",
    "object-src 'none'",
    "base-uri 'self'",
    "form-action 'self'",
    "frame-ancestors 'none'",
  ].join('; ');
}
