import { describe, expect, it } from 'vitest';

import { clampThrones, collectMonthlyIncome } from '@/games/dh1/wealth';

/**
 * ─── LANDMARK: DH1 WEALTH TESTS ───────────────────────────────────────────
 * Кнопка «Получить зарплату» — чистая операция над капиталом. Проверяем
 * границы: отрицательный/дробный/нечисловой ввод не должен уменьшать или
 * ломать капитал, а выплата не выходит за верхний предел поля.
 */
describe('DH1: капитал и зарплата', () => {
  it('приводит ввод к целым тронам и не пропускает отрицательные', () => {
    expect(clampThrones('75')).toBe(75);
    expect(clampThrones('75.9')).toBe(75);
    expect(clampThrones(-10)).toBe(0);
    expect(clampThrones('')).toBe(0);
    expect(clampThrones('abc')).toBe(0);
    expect(clampThrones(Number.NaN)).toBe(0);
  });

  it('выплата прибавляет доход к капиталу', () => {
    expect(
      collectMonthlyIncome({
        throneGelt: 50,
        monthlyIncome: 10,
        notes: 'stipend',
      }),
    ).toEqual({ throneGelt: 60, monthlyIncome: 10, notes: 'stipend' });
  });

  it('повторная выплата снова прибавляет доход', () => {
    const once = collectMonthlyIncome({ throneGelt: 50, monthlyIncome: 10 });
    expect(collectMonthlyIncome(once).throneGelt).toBe(70);
  });

  it('не выходит за верхний предел и не делает капитал отрицательным', () => {
    expect(
      collectMonthlyIncome({
        throneGelt: 1_000_000_000,
        monthlyIncome: 10,
      }).throneGelt,
    ).toBe(1_000_000_000);
    expect(
      collectMonthlyIncome({ throneGelt: -5, monthlyIncome: 10 }).throneGelt,
    ).toBe(10);
  });
});
