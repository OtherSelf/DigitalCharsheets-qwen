// src/components/ui-scale-wrapper.tsx
'use client';

import { ReactNode, useEffect, useRef } from 'react';

import { useUISettings } from '@/hooks/use-ui-settings';

export function UIScaleWrapper({ children }: { children: ReactNode }) {
  const { uiScale } = useUISettings();
  const wrapperRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const el = wrapperRef.current;
    if (!el) return;

    // LANDMARK: EMPTY_SPACE_FIX
    const inverse = 100 / uiScale;
    el.style.transformOrigin = 'top left';
    el.style.transform = `scale(${uiScale})`;
    el.style.width = `${inverse}vw`;
    el.style.height = `${inverse}dvh`;
  }, [uiScale]);

  return (
    <div
      ref={wrapperRef}
      data-ui-scale-wrapper=""
      className="flex flex-col bg-background"
      style={{
        /*
          LANDMARK: APP_SHELL_OUT_OF_FLOW
          Оболочка приложения вынесена из потока документа (`position: fixed;
          inset: 0`). Причина: при масштабе интерфейса ≠ 100% она
          раскладывается в 1/scale раз больше вьюпорта, и если она остаётся
          в потоке, у `body` появляется прокручиваемый «излишек» — ровно тот,
          из-за которого при `scrollIntoView()` (переход между секциями)
          уезжали шапка и левое меню. `overflow: clip` на html/body это
          лечит не во всех случаях: Radix при открытии диалога ставит
          `body { overflow: hidden }` инлайном и перебивает `clip` — тогда
          корень снова становится программно прокручиваемым.

          Fixed-элемент не участвует в расчёте прокручиваемого overflow
          документа, поэтому сдвинуть корень (и утащить за ним шапку с
          меню) становится физически нечем. Прокрутка контента остаётся
          там, где и была — внутри `<main>`.
        */
        position: 'fixed',
        inset: 0,
        willChange: 'transform',
        transformOrigin: 'top left',
        width: '100vw',
        height: '100dvh',
      }}
    >
      {children}
    </div>
  );
}
