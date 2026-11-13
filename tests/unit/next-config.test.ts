import { describe, expect, it } from 'vitest';

import nextConfig from '../../next.config';

/**
 * Регрессия Next 16: dev-сервер блокирует cross-origin запросы к dev-ресурсам
 * (/_next/hmr) и без явного allowedDevOrigins страницы за реверс-прокси
 * перестают гидратироваться. Полный сценарий проверяет `npm run test:dev`
 * (scripts/dev-smoke.mjs), а этот тест в быстром гейте ловит случайное
 * удаление/сужение списка.
 */
describe('next.config: allowedDevOrigins для стендов за реверс-прокси', () => {
  const origins = nextConfig.allowedDevOrigins ?? [];

  it('разрешает домены дев- и прод-стенда', () => {
    expect(origins).toEqual(
      expect.arrayContaining(['dcs-dev.thfree.space', 'dcs.thfree.space']),
    );
  });

  it('разрешает локальную разработку', () => {
    expect(origins).toEqual(expect.arrayContaining(['localhost', '127.0.0.1']));
  });
});

/**
 * SEC-11: браузерные границы. CSP/anti-frame/nosniff не зависят от серверного
 * кода, поэтому их случайное удаление должен ловить быстрый гейт, а не только
 * ручная проверка заголовков на стенде.
 */
describe('next.config: заголовки безопасности (SEC-11)', () => {
  const getHeaders = async () => {
    const headers = await nextConfig.headers?.();
    expect(headers).toBeTruthy();
    const entry = headers!.find((item) => item.source === '/:path*');
    expect(entry, 'нет правила для /:path*').toBeTruthy();
    return new Map(entry!.headers.map((h) => [h.key, h.value]));
  };

  it('отдаёт CSP, anti-frame, nosniff и Referrer-Policy', async () => {
    const headers = await getHeaders();

    const csp = headers.get('Content-Security-Policy') ?? '';
    expect(csp).toContain("default-src 'self'");
    expect(csp).toContain("frame-ancestors 'none'");
    expect(csp).toContain("object-src 'none'");
    expect(headers.get('X-Frame-Options')).toBe('DENY');
    expect(headers.get('X-Content-Type-Options')).toBe('nosniff');
    expect(headers.get('Referrer-Policy')).toBe(
      'strict-origin-when-cross-origin',
    );
    expect(headers.get('Permissions-Policy')).toMatch(/camera=\(\)/);
  });

  it('CSP не запрещает собственные скрипты и стили Next', async () => {
    const csp = (await getHeaders()).get('Content-Security-Policy') ?? '';
    // Без этих директив приложение не гидратируется и теряет вёрстку.
    expect(csp).toMatch(/script-src [^;]*'self'/);
    expect(csp).toMatch(/style-src [^;]*'self'/);
    expect(csp).toMatch(/style-src [^;]*'unsafe-inline'/);
  });

  it('выключает X-Powered-By и image optimizer', () => {
    expect(nextConfig.poweredByHeader).toBe(false);
    // Оптимизатор без `next/image` — лишний открытый эндпоинт наружу.
    expect(nextConfig.images).toEqual({ unoptimized: true });
  });
});
