import { describe, expect, it } from 'vitest';

import {
  isFieldFilled as dh1Filled,
  isCreationFieldLocked as dh1Locked,
} from '@/games/dh1/field-policy';

/**
 * ─── LANDMARK: DH1 FIELD EDIT POLICY TESTS ───────────────────────────────
 * Двухуровневая политика: `creation-empty` поле открывается на выбор,
 * только пока пустое. Пустотой считаются undefined, пустая/пробельная строка
 * и пустой массив; ноль — уже значение. Заполнение только пишет поле, поэтому
 * проверяем именно предикат, а не пересчёт производных.
 *
 * Проверки 1e живут рядом с редакцией: своё правило редакция проверяет
 * сама, сравнения с dh2 в этом файле нет.
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

  it('правило пустоты и значения одинаково для всех полей DH1', () => {
    // Таблица истинности вместо сравнения с соседней редакцией:
    // удаление dh2 не должно менять смысл проверки.
    const cases: [unknown, boolean][] = [
      [undefined, false],
      [null, false],
      ['', false],
      ['   ', false],
      [[], false],
      ['Adept', true],
      [0, true],
      ['0', true],
    ];
    for (const [value, filled] of cases) {
      expect(dh1Filled(value), String(value)).toBe(filled);
      expect(dh1Locked(value), String(value)).toBe(filled);
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
