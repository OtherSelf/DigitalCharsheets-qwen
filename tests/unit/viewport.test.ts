import { describe, expect, it } from 'vitest';

import {
  DESKTOP_MIN,
  MOBILE_MAX,
  resolveViewport,
  TABLET_MIN,
} from '@/lib/viewport';

/**
 * Границы порогов раскладки. Тест сторожит именно числа: по ним решается,
 * показывать ли компактный лист (телефон) и включать ли планшетные правила
 * CSS у DH. Ошибка на единицу здесь стоит пересъёмки мобильных эталонов,
 * поэтому проверяются обе стороны каждой границы и дробная ширина под
 * масштабом браузера.
 */
const cases: Array<
  [label: string, width: number, small: boolean, tablet: boolean]
> = [
  ['узкий телефон', 320, true, false],
  ['малый телефон', 360, true, false],
  ['Pixel 7', 412, true, false],
  ['последняя ширина телефона', MOBILE_MAX, true, false],
  ['дробная ширина под зумом', 767.5, true, false],
  ['первая ширина планшета', TABLET_MIN, false, true],
  ['планшет 1024', 1024, false, true],
  ['планшет 1280', 1280, false, true],
  ['последняя ширина планшета', DESKTOP_MIN - 1, false, true],
  ['первая ширина десктопа', DESKTOP_MIN, false, false],
  ['десктоп 1440', 1440, false, false],
];

describe('resolveViewport', () => {
  it.each(cases)('%s: %s px', (_label, width, small, tablet) => {
    expect(resolveViewport(width)).toEqual({
      isSmallScreen: small,
      isTabletScreen: tablet,
    });
  });

  it('держит пороги согласованными между собой', () => {
    expect(MOBILE_MAX + 1).toBe(TABLET_MIN);
    expect(TABLET_MIN).toBeLessThan(DESKTOP_MIN);
  });

  it('до десктопа режим ровно один', () => {
    for (let width = 1; width < DESKTOP_MIN; width += 1) {
      const { isSmallScreen, isTabletScreen } = resolveViewport(width);
      expect(
        Number(isSmallScreen) + Number(isTabletScreen),
        `ширина ${width}`,
      ).toBe(1);
    }
  });
});
