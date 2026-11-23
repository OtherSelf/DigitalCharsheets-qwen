import { describe, expect, it } from 'vitest';

import { buildContentSecurityPolicy } from '@/lib/security/csp';

describe('CSP', () => {
  it('статическая политика сохраняет unsafe-inline (замеренный fallback)', () => {
    const csp = buildContentSecurityPolicy({ isDev: false });
    expect(csp).toMatch(/script-src 'self' 'unsafe-inline'/);
    expect(csp).not.toContain('nonce-');
    expect(csp).toContain("frame-ancestors 'none'");
    expect(csp).toContain("object-src 'none'");
  });

  it('nonce-вариант убирает unsafe-inline из script-src', () => {
    const csp = buildContentSecurityPolicy({ nonce: 'abc123', isDev: false });
    expect(csp).toContain("script-src 'self' 'nonce-abc123' 'strict-dynamic'");
    expect(csp).not.toMatch(/script-src[^;]*'unsafe-inline'/);
    expect(csp).toContain("style-src 'self' 'unsafe-inline'");
  });

  it('unsafe-eval только в dev', () => {
    expect(buildContentSecurityPolicy({ nonce: 'n', isDev: true })).toContain(
      "'unsafe-eval'",
    );
    expect(
      buildContentSecurityPolicy({ nonce: 'n', isDev: false }),
    ).not.toContain("'unsafe-eval'");
  });
});
