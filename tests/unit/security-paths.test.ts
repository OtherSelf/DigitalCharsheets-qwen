import os from 'node:os';
import path from 'node:path';

import { describe, expect, it } from 'vitest';

import {
  isSafeId,
  MAX_SAFE_ID_LENGTH,
  resolveCharacterFile,
  resolveInside,
} from '@/lib/security/paths';

/**
 * Границы путей: id листа и uid приходят из запроса, поэтому до любого
 * обращения к диску они должны отсекаться. Вынесено из security.test.ts,
 * чтобы файл не превышал лимит раскладки.
 */

describe('валидация путей (SEC-3, SEC-3b)', () => {
  const base = path.join(os.tmpdir(), 'dcs-paths', 'users', 'u', 'characters');

  it('isSafeId принимает только буквы, цифры, «_» и «-»', () => {
    expect(isSafeId('char-a_1')).toBe(true);
    expect(isSafeId('0')).toBe(true);
    expect(isSafeId('a'.repeat(MAX_SAFE_ID_LENGTH))).toBe(true);

    expect(isSafeId('a'.repeat(MAX_SAFE_ID_LENGTH + 1))).toBe(false);
    expect(isSafeId('')).toBe(false);
    expect(isSafeId('../user')).toBe(false);
    expect(isSafeId('..')).toBe(false);
    expect(isSafeId('..%2Fuser')).toBe(false);
    expect(isSafeId('/etc/passwd')).toBe(false);
    expect(isSafeId('a/b')).toBe(false);
    expect(isSafeId('a\\b')).toBe(false);
    expect(isSafeId('a.b')).toBe(false);
    expect(isSafeId('лист')).toBe(false);
    expect(isSafeId(null)).toBe(false);
    expect(isSafeId(42)).toBe(false);
  });

  it('resolveInside не выпускает из базового каталога', () => {
    expect(resolveInside(base, 'ok.json')).toBe(path.join(base, 'ok.json'));
    expect(resolveInside(base, '../user.json')).toBeNull();
    expect(resolveInside(base, '../../other/user.json')).toBeNull();
    expect(resolveInside(base, 'sub/../../user.json')).toBeNull();
    expect(resolveInside(base, '/etc/passwd')).toBeNull();
    expect(resolveInside(base, '..')).toBeNull();
    expect(resolveInside(base, '.')).toBeNull();
  });

  it('resolveCharacterFile собирает «<id>.json» и отсекает traversal', () => {
    expect(resolveCharacterFile(base, 'abc')).toBe(path.join(base, 'abc.json'));
    for (const bad of [
      '../user',
      '../../557e8400-e29b-41d4-a716-446655440000/user',
      '..%2Fuser',
      '',
      'a/b',
      'a.b',
    ]) {
      expect({ id: bad, path: resolveCharacterFile(base, bad) }).toEqual({
        id: bad,
        path: null,
      });
    }
  });
});
