// src/lib/viewport.ts

/**
 * ─── LANDMARK: VIEWPORT_THRESHOLDS ──────────────────────────────────────────
 * Единственное место в коде, где объявлены числа порогов раскладки. Копии
 * расходились: правка одного порога оставляла второй, и в одном кадре
 * компоненты получали разные флаги. Здесь числа берут и провайдер листа, и
 * мобильные хелперы; CSS-медиа сверяются с ними тестом границ, но остаются
 * на своём языке (у Tailwind `md:` = 768 px).
 *
 * Правила, которые задают числа:
 *   • `< 768` — телефон: лист рисуется компактным React-режимом
 *     (одна секция + иконочный рейл), CSS-адаптива листа нет;
 *   • `768..1299` — планшетная полоса: у листов DH включаются правила из
 *     `sheet.module.css`, подписи в шапке сжимаются;
 *   • `>= 1300` — десктоп.
 */
export const MOBILE_MAX = 767;
export const TABLET_MIN = 768;
export const DESKTOP_MIN = 1300;

export interface ViewportFlags {
  isSmallScreen: boolean;
  isTabletScreen: boolean;
}

/**
 * ─── LANDMARK: SHEET_PRESENTATION ───────────────────────────────────────────
 * Две независимые оси раскладки листа. Пока они были одной (`isCompactView`),
 * тумблер «компактный вид» на планшете и десктопе включал телефонную подачу:
 * рейл и одну секцию вместо всех панелей.
 *
 *   • `isPhoneView` — телефонная подача: рейл секций, одна секция на экран,
 *     закреплённые полосы и якоря в них. Только настоящий телефон;
 *   • `isCompactView` — компактная раскладка: одна колонка, панели друг под
 *     другом на всю ширину. На телефоне она включена всегда, на планшете и
 *     десктопе — по кнопке в шапке, и никогда не прячет секции и не рисует
 *     рейл.
 */
export interface SheetPresentation {
  isPhoneView: boolean;
  isCompactView: boolean;
}

/** Компакт = «одна колонка»: он не следует за плотностью шрифта и отступов. */
export function resolveSheetPresentation(
  isSmallScreen: boolean,
  prefersCompact: boolean,
): SheetPresentation {
  return {
    isPhoneView: isSmallScreen,
    isCompactView: isSmallScreen || prefersCompact,
  };
}

/**
 * Флаги раскладки по ширине вьюпорта в CSS-пикселях.
 *
 * Сравнение идёт с `TABLET_MIN`, а не с `MOBILE_MAX`: под масштабом браузера
 * `innerWidth` бывает дробным (767.5), и такое окно должно оставаться
 * телефоном, а не «ни телефоном, ни планшетом».
 *
 * Десктоп — это «ни маленький, ни планшетный»: отдельный флаг не нужен, а
 * лишнее поле пришлось бы синхронизировать во всех потребителях.
 */
export function resolveViewport(width: number): ViewportFlags {
  const isSmallScreen = width < TABLET_MIN;
  return {
    isSmallScreen,
    isTabletScreen: !isSmallScreen && width < DESKTOP_MIN,
  };
}
