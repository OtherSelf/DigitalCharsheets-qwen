import { describe, expect, it } from 'vitest';

import { clientIpFromRequest, rateLimitKey } from '@/lib/security/rate-limit';

describe('IP клиента и ключ лимитера', () => {
  it('складывает ключ из действия, последнего IP и нормализованного логина', () => {
    const request = new Request('http://localhost/api/auth', {
      method: 'POST',
      headers: { 'x-forwarded-for': '203.0.113.7, 10.0.0.1' },
    });

    // Последний адрес дописывает прокси; первый клиент подделывает.
    expect(clientIpFromRequest(request)).toBe('10.0.0.1');
    expect(rateLimitKey('login', request, '  Hero@Example.com ')).toBe(
      'login:10.0.0.1:hero@example.com',
    );

    const realIp = new Request('http://localhost/api/auth', {
      headers: { 'x-real-ip': '198.51.100.9' },
    });
    expect(clientIpFromRequest(realIp)).toBe('198.51.100.9');

    const anonymous = new Request('http://localhost/api/auth');
    expect(clientIpFromRequest(anonymous)).toBe('unknown');
    expect(rateLimitKey('exists', anonymous)).toBe('exists:unknown:');
  });

  it('ротация клиентской части XFF не меняет ключ, пока последний хоп фиксирован', () => {
    const keys = new Set<string>();
    for (let i = 1; i <= 12; i += 1) {
      const request = new Request('http://localhost/api/auth', {
        headers: {
          'x-forwarded-for': `203.0.113.${i}, 198.51.100.7`,
        },
      });
      keys.add(clientIpFromRequest(request));
    }
    expect([...keys]).toEqual(['198.51.100.7']);
  });

  it('битый последний адрес не откатывается к клиентскому значению слева', () => {
    const forged = new Request('http://localhost/api/auth', {
      headers: { 'x-forwarded-for': '203.0.113.9, not-an-ip' },
    });
    expect(clientIpFromRequest(forged)).toBe('unknown');

    const ipv6 = new Request('http://localhost/api/auth', {
      headers: { 'x-forwarded-for': '2001:db8::1' },
    });
    expect(clientIpFromRequest(ipv6)).toBe('2001:db8::1');

    const bracketed = new Request('http://localhost/api/auth', {
      headers: { 'x-forwarded-for': '[2001:db8::2]' },
    });
    expect(clientIpFromRequest(bracketed)).toBe('2001:db8::2');

    const brokenRealIp = new Request('http://localhost/api/auth', {
      headers: { 'x-real-ip': 'not-an-ip' },
    });
    expect(clientIpFromRequest(brokenRealIp)).toBe('unknown');
  });
});
