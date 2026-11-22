import { describe, expect, it } from 'vitest';

import { deepEqual } from '@/lib/deep-equal';

describe('deepEqual', () => {
  it('сравнивает примитивы и массивы', () => {
    expect(deepEqual(1, 1)).toBe(true);
    expect(deepEqual('a', 'b')).toBe(false);
    expect(deepEqual([1, [2]], [1, [2]])).toBe(true);
    expect(deepEqual([1, 2], [2, 1])).toBe(false);
  });

  it('сравнивает вложенные plain-object по ключам и значениям', () => {
    expect(deepEqual({ a: { b: 1 } }, { a: { b: 1 } })).toBe(true);
    expect(deepEqual({ a: { b: 1 } }, { a: { b: 2 } })).toBe(false);
    expect(deepEqual({ a: 1 }, { a: 1, b: undefined })).toBe(false);
  });

  it('не считает структурно равными не-plain объекты', () => {
    const date = new Date('2026-01-01T00:00:00.000Z');
    expect(deepEqual(date, new Date(date))).toBe(false);
    expect(deepEqual(date, date)).toBe(true);
    expect(deepEqual({}, date)).toBe(false);
  });
});
