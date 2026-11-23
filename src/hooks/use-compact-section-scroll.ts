'use client';

import { useEffect } from 'react';

/**
 * ─── LANDMARK: SCROLL_ONLY_INSIDE_MAIN ─────────────────────────────────────
 * Прокрутка к секции компактного листа. Скроллим ТОЛЬКО контейнер контента,
 * а не `scrollIntoView()`: тот двигает всех прокручиваемых предков, включая
 * корень документа; при масштабе интерфейса ≠ 100% у корня есть «излишек»
 * высоты, и он уезжал вместе с шапкой и левым меню. Здесь корень не участвует
 * вообще: считаем смещение секции внутри `<main>` и скроллим его. Делим на
 * эффективный масштаб (у оболочки `transform: scale()`), потому что
 * `getBoundingClientRect()` возвращает визуальные пиксели, а `scrollTop` —
 * layout-пиксели.
 *
 * `request` — счётчик повторного тапа по уже выбранному пункту: состояние
 * секции не меняется, но вернуть пользователя к ней всё равно нужно.
 */
export function useCompactSectionScroll(
  activeSection: string,
  enabled: boolean,
  request = 0,
): void {
  useEffect(() => {
    if (!enabled) return;

    // Прокрутка откладывается на кадр: смена секции в том же коммите меняет
    // высоту листа, и до пересчёта раскладки `scrollTop` ещё держит прежнее
    // значение (браузер обрезает его лениво).
    const frame = requestAnimationFrame(() => {
      const element = document.getElementById(activeSection);
      const scroller = element?.closest('main');
      if (!element || !(scroller instanceof HTMLElement)) {
        // Контракт плагина: id пункта CompactNav обязан совпадать с id секции.
        // Молчаливый выход делал нарушение невидимым.
        if (process.env.NODE_ENV !== 'production') {
          console.warn(
            `[sheet] секция «${activeSection}» из CompactNav не найдена в DOM`,
          );
        }
        return;
      }

      const scrollerRect = scroller.getBoundingClientRect();
      const elementRect = element.getBoundingClientRect();
      const scale =
        scroller.clientHeight > 0
          ? scrollerRect.height / scroller.clientHeight
          : 1;
      const max = scroller.scrollHeight - scroller.clientHeight;
      const padding =
        Number.parseFloat(getComputedStyle(scroller).paddingTop) || 0;
      const top =
        scroller.scrollTop +
        (elementRect.top - scrollerRect.top) / (scale || 1) -
        padding;

      scroller.scrollTo({
        top: Math.min(Math.max(top, 0), Math.max(max, 0)),
        behavior: 'smooth',
      });
    });

    return () => cancelAnimationFrame(frame);
  }, [activeSection, enabled, request]);
}
