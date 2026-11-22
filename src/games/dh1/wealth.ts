import { FIELD_LIMITS } from '@/games/shared/limits';

/**
 * ─── LANDMARK: DH1 WEALTH ──────────────────────────────────────────────────
 * Деньги DH1 — целые троны. Ввод из `<input type="number">` приходит строкой,
 * поэтому значение приводится к конечному целому в допустимом диапазоне:
 * отрицательный капитал и `NaN` не должны попадать ни в состояние формы, ни
 * в патч листа.
 */
export interface Dh1Wealth {
  throneGelt: number;
  monthlyIncome: number;
  notes?: string;
}

/** Безопасно привести ввод к целым тронам 0…FIELD_LIMITS.money. */
export function clampThrones(value: unknown): number {
  const parsed =
    typeof value === 'number'
      ? value
      : typeof value === 'string' && value.trim() !== ''
        ? Number(value)
        : 0;
  if (!Number.isFinite(parsed)) return 0;
  return Math.min(FIELD_LIMITS.money, Math.max(0, Math.trunc(parsed)));
}

/** Новая зарплата: прибавить месячный доход к текущему капиталу. */
export function collectMonthlyIncome(wealth: Dh1Wealth): Dh1Wealth {
  const current = clampThrones(wealth.throneGelt);
  const income = clampThrones(wealth.monthlyIncome);
  return {
    ...wealth,
    throneGelt: Math.min(FIELD_LIMITS.money, current + income),
    monthlyIncome: income,
  };
}
