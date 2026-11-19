import { describe, expect, it } from 'vitest';

import {
  isFieldFilled as dh2Filled,
  isCreationFieldLocked as dh2Locked,
} from '@/games/dh2/field-policy';

/**
 * ─── LANDMARK: DH2 FIELD EDIT POLICY TESTS ───────────────────────────────
 * Двухуровневая политика: `creation-empty` поле открывается на выбор,
 * только пока пустое. Пустотой считаются undefined, пустая/пробельная строка
 * и пустой массив; ноль — уже значение. Заполнение только пишет поле, поэтому
 * проверяем именно предикат, а не пересчёт производных.
 *
 * Проверки 2e живут рядом с редакцией: своё правило редакция проверяет
 * сама, сравнения с dh1 в этом файле нет.
 */

describe('политика полей после создания', () => {
  it('незаполненные значения открывают выбор', () => {
    expect(dh2Filled(undefined)).toBe(false);
    expect(dh2Filled(null)).toBe(false);
    expect(dh2Filled('')).toBe(false);
    expect(dh2Filled('   \n ')).toBe(false);
    expect(dh2Filled([])).toBe(false);

    expect(dh2Locked('')).toBe(false);
    expect(dh2Locked(undefined)).toBe(false);
  });

  it('правило пустоты и значения одинаково для всех полей DH2', () => {
    // Таблица истинности вместо сравнения с соседней редакцией:
    // удаление dh1 не должно менять смысл проверки.
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
      expect(dh2Filled(value), String(value)).toBe(filled);
      expect(dh2Locked(value), String(value)).toBe(filled);
    }
  });

  it('заданное значение блокирует creation-поле', () => {
    expect(dh2Filled('Imperial World')).toBe(true);
    expect(dh2Filled('0')).toBe(true);
    expect(dh2Filled(0)).toBe(true);
    expect(dh2Filled(['disorder'])).toBe(true);

    expect(dh2Locked('Adept')).toBe(true);
  });
});
