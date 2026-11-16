import { describe, expect, it } from 'vitest';

import {
  isFieldFilled as dh1Filled,
  isCreationFieldLocked as dh1Locked,
} from '@/games/dh1/field-policy';
import {
  isFieldFilled as dh2Filled,
  isCreationFieldLocked as dh2Locked,
} from '@/games/dh2/field-policy';

/**
 * ─── LANDMARK: FIELD EDIT POLICY TESTS ─────────────────────────────────────
 * Двухуровневая политика (D4): `creation-empty` поле открывается на выбор,
 * только пока пустое. Пустотой считаются undefined, пустая/пробельная строка
 * и пустой массив; ноль — уже значение. Заполнение только пишет поле, поэтому
 * проверяем именно предикат, а не пересчёт производных (D15).
 */
describe('политика полей после создания', () => {
  it('незаполненные значения открывают выбор', () => {
    expect(dh1Filled(undefined)).toBe(false);
    expect(dh1Filled(null)).toBe(false);
    expect(dh1Filled('')).toBe(false);
    expect(dh1Filled('   \n ')).toBe(false);
    expect(dh1Filled([])).toBe(false);

    expect(dh1Locked('')).toBe(false);
    expect(dh1Locked(undefined)).toBe(false);
  });

  it('копии правила в dh1 и dh2 ведут себя одинаково', () => {
    for (const value of [undefined, null, '', '   ', [], 'Adept', 0, '0']) {
      expect(dh2Filled(value)).toBe(dh1Filled(value));
      expect(dh2Locked(value)).toBe(dh1Locked(value));
    }
  });

  it('заданное значение блокирует creation-поле', () => {
    expect(dh1Filled('Imperial World')).toBe(true);
    expect(dh1Filled('0')).toBe(true);
    expect(dh1Filled(0)).toBe(true);
    expect(dh1Filled(['disorder'])).toBe(true);

    expect(dh1Locked('Adept')).toBe(true);
  });
});
