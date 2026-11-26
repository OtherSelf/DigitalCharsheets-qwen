import { describe, expect, it } from 'vitest';

import { loginPath, safeInternalPath } from '@/lib/routes';

describe('safeInternalPath', () => {
  it('пропускает внутренние пути', () => {
    expect(safeInternalPath('/character/abc')).toBe('/character/abc');
    expect(safeInternalPath('/settings?from=/')).toBe('/settings?from=/');
  });

  it('не пускает protocol-relative и обратные слэши', () => {
    expect(safeInternalPath('//evil.example')).toBe('/');
    expect(safeInternalPath('/\\evil.example')).toBe('/');
    expect(safeInternalPath('https://evil.example')).toBe('/');
    expect(safeInternalPath(null)).toBe('/');
  });
});

describe('loginPath', () => {
  it('добавляет next для внутреннего пути', () => {
    expect(loginPath('/character/abc')).toBe('/login?next=%2Fcharacter%2Fabc');
    expect(loginPath('/character/abc?tab=notes')).toBe(
      '/login?next=%2Fcharacter%2Fabc%3Ftab%3Dnotes',
    );
  });

  it('без next отдаёт обычный вход', () => {
    expect(loginPath(null)).toBe('/login');
    expect(loginPath(undefined)).toBe('/login');
    expect(loginPath('')).toBe('/login');
  });

  it('чужой адрес и сам вход не становятся next', () => {
    expect(loginPath('https://evil.example/x')).toBe('/login');
    expect(loginPath('//evil.example/x')).toBe('/login');
    expect(loginPath('/login?next=/x')).toBe('/login');
  });
});
