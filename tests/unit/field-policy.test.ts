import { describe, expect, it } from 'vitest';

import {
  isCreationFieldLocked,
  isFieldFilled,
} from '@/games/shared/field-policy';

/**
 * ─── LANDMARK: FIELD EDIT POLICY TESTS ─────────────────────────────────────
 * Двухуровневая политика (D4): `creation-empty` поле открывается на выбор,
 * только пока пустое. Пустотой считаются undefined, пустая/пробельная строка
 * и пустой массив; ноль — уже значение. Заполнение только пишет поле, поэтому
 * проверяем именно предикат, а не пересчёт производных (D15).
 */
describe('политика полей после создания', () => {
  it('незаполненные значения открывают выбор', () => {
    expect(isFieldFilled(undefined)).toBe(false);
    expect(isFieldFilled(null)).toBe(false);
    expect(isFieldFilled('')).toBe(false);
    expect(isFieldFilled('   \n ')).toBe(false);
    expect(isFieldFilled([])).toBe(false);

    expect(isCreationFieldLocked('')).toBe(false);
    expect(isCreationFieldLocked(undefined)).toBe(false);
  });

  it('заданное значение блокирует creation-поле', () => {
    expect(isFieldFilled('Imperial World')).toBe(true);
    expect(isFieldFilled('0')).toBe(true);
    expect(isFieldFilled(0)).toBe(true);
    expect(isFieldFilled(['disorder'])).toBe(true);

    expect(isCreationFieldLocked('Adept')).toBe(true);
  });
});
