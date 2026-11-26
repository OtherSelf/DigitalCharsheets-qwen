import { describe, expect, it } from 'vitest';

import {
  DESKTOP_MIN,
  MOBILE_MAX,
  resolveSheetPresentation,
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

/**
 * ─── LANDMARK: SHEET_PRESENTATION ───────────────────────────────────────────
 * Две оси раскладки: телефонная подача (рейл, одна секция) и плотность
 * (отступы, кегль, таблицы). Пока они были одной, тумблер «компактный вид» на
 * планшете и десктопе включал телефонную подачу — рейл и одну секцию вместо
 * всех панелей. Тест сторожит именно это разделение: `isPhoneView` следует
 * только за шириной, `isCompactView` — за шириной или предпочтением.
 */
describe('resolveSheetPresentation', () => {
  it.each([
    ['телефон без предпочтения', 393, false, true, true],
    ['телефон с предпочтением', 393, true, true, true],
    ['дробный телефон под зумом', 767.5, true, true, true],
    ['планшет без предпочтения', TABLET_MIN, false, false, false],
    ['планшет с предпочтением', 1024, true, false, true],
    ['планшет 1280 с предпочтением', 1280, true, false, true],
    ['десктоп без предпочтения', 1440, false, false, false],
    ['десктоп с предпочтением', 1440, true, false, true],
  ])(
    '%s: %s px',
    (_label, width, prefersCompact, isPhoneView, isCompactView) => {
      expect(
        resolveSheetPresentation(
          resolveViewport(width).isSmallScreen,
          prefersCompact,
        ),
      ).toEqual({ isPhoneView, isCompactView });
    },
  );

  it('на телефоне предпочтение ничего не меняет', () => {
    expect(
      resolveSheetPresentation(true, false),
      'телефон уже плотный',
    ).toEqual(resolveSheetPresentation(true, true));
  });

  it('предпочтение не включает телефонную подачу', () => {
    expect(resolveSheetPresentation(false, true).isPhoneView).toBe(false);
  });
});
