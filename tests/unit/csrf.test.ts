import { NextRequest } from 'next/server';

import { describe, expect, it } from 'vitest';

import { csrfOriginRejected } from '@/lib/security/csrf';
import { proxy } from '@/proxy';

describe('CSRF: проверка Origin и Sec-Fetch-Site', () => {
  const base = {
    host: 'dcs.example.com',
    forwardedProto: 'https',
  };

  it('пропускает не-браузерные запросы без заголовков', () => {
    expect(
      csrfOriginRejected({ ...base, origin: null, secFetchSite: null }),
    ).toBe(false);
  });

  it('пропускает same-origin', () => {
    expect(
      csrfOriginRejected({
        ...base,
        origin: 'https://dcs.example.com',
        secFetchSite: 'same-origin',
      }),
    ).toBe(false);
    expect(
      csrfOriginRejected({
        ...base,
        origin: null,
        secFetchSite: 'same-origin',
      }),
    ).toBe(false);
  });

  it('отклоняет чужой Origin, `null` и другой протокол', () => {
    expect(
      csrfOriginRejected({
        ...base,
        origin: 'https://evil.example',
        secFetchSite: null,
      }),
    ).toBe(true);
    expect(
      csrfOriginRejected({ ...base, origin: 'null', secFetchSite: null }),
    ).toBe(true);
    expect(
      csrfOriginRejected({
        ...base,
        origin: 'http://dcs.example.com',
        secFetchSite: null,
      }),
    ).toBe(true);
  });

  it('отклоняет cross-site и same-site, пропускает навигацию `none`', () => {
    expect(
      csrfOriginRejected({
        ...base,
        origin: null,
        secFetchSite: 'cross-site',
      }),
    ).toBe(true);
    expect(
      csrfOriginRejected({
        ...base,
        origin: null,
        secFetchSite: 'same-site',
      }),
    ).toBe(true);
    expect(
      csrfOriginRejected({ ...base, origin: null, secFetchSite: 'none' }),
    ).toBe(false);
  });
});

describe('proxy: CSRF на /api/*', () => {
  const request = (method: string, headers: Record<string, string> = {}) =>
    new NextRequest('http://localhost/api/characters', {
      method,
      headers,
    });

  it('мутация с чужим Origin → 403 csrf_origin', async () => {
    const response = proxy(
      request('POST', {
        origin: 'https://evil.example',
        host: 'localhost',
      }),
    );
    expect(response.status).toBe(403);
    const body = await response.json();
    expect(body.reason).toBe('csrf_origin');
  });

  it('мутация same-origin → пропуск', async () => {
    const response = proxy(
      request('POST', {
        origin: 'http://localhost',
        host: 'localhost',
        'sec-fetch-site': 'same-origin',
      }),
    );
    // NextResponse.next() — заголовок x-middleware-next.
    expect(response.headers.get('x-middleware-next')).toBe('1');
  });

  it('GET не проверяется, даже с чужим Origin', () => {
    const response = proxy(
      request('GET', { origin: 'https://evil.example', host: 'localhost' }),
    );
    expect(response.headers.get('x-middleware-next')).toBe('1');
  });
});
