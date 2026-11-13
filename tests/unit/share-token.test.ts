import { describe, expect, it } from 'vitest';

import {
  generateShareToken,
  hashShareToken,
  isShareToken,
  SHARE_TOKEN_BYTES,
  SHARE_TOKEN_LENGTH,
} from '@/lib/shares';

describe('share token helpers', () => {
  it('генерирует уникальные токены нужной длины', () => {
    const tokens = new Set<string>();
    for (let index = 0; index < 100; index += 1) {
      const token = generateShareToken();
      expect(token).toHaveLength(SHARE_TOKEN_LENGTH);
      expect(isShareToken(token)).toBe(true);
      tokens.add(token);
    }
    expect(tokens.size).toBe(100);
    expect(SHARE_TOKEN_BYTES).toBe(32);
  });

  it('отвергает токены неверной формы', () => {
    expect(isShareToken('')).toBe(false);
    expect(isShareToken('a'.repeat(SHARE_TOKEN_LENGTH - 1))).toBe(false);
    expect(isShareToken('a'.repeat(SHARE_TOKEN_LENGTH + 1))).toBe(false);
    expect(isShareToken(`${'a'.repeat(42)}=`)).toBe(false);
    expect(isShareToken(`${'a'.repeat(42)} `)).toBe(false);
    expect(isShareToken('a'.repeat(42) + '.')).toBe(false);
    expect(isShareToken(null)).toBe(false);
    expect(isShareToken(123)).toBe(false);
    expect(isShareToken({ token: 'a'.repeat(43) })).toBe(false);
  });

  it('хэширует токен детерминированно и по-разному', () => {
    const first = generateShareToken();
    const second = generateShareToken();

    const firstHash = hashShareToken(first);

    expect(firstHash).toMatch(/^[0-9a-f]{64}$/);
    expect(hashShareToken(first)).toBe(firstHash);
    expect(hashShareToken(second)).not.toBe(firstHash);
  });
});
