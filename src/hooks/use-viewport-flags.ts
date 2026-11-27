'use client';

import { useEffect, useMemo, useState } from 'react';

import { resolveViewport, type ViewportFlags } from '@/lib/viewport';

import { useUISettings } from './use-ui-settings';

/**
 * ─── LANDMARK: USE_VIEWPORT_FLAGS ───────────────────────────────────────────
 * Флаги раскладки для провайдеров листа (обычного и гостевого).
 *
 * Значение считается по `window.innerWidth`, а не через `matchMedia`, и первый
 * рендер отдаёт «десктоп»: сервер не знает ширину окна, поэтому синхронное
 * значение из медиа-запроса разошлось бы с серверной разметкой и дало
 * hydration-ошибку плюс другой первый кадр в снимках. После монтирования флаги
 * уточняются по фактической ширине и дальше обновляются на `resize`.
 *
 * ─── LANDMARK: EFFECTIVE_VIEWPORT ───
 * Ширина для раскладки — не `innerWidth`, а `innerWidth / uiScale`. Оболочка
 * приложения сжимается трансформом и раскладывается в `100/scale vw`, поэтому
 * при «Масштабе интерфейса» 150% реального места для контента остаётся 2/3
 * окна. Раньше флаги и медиа-запросы продолжали видеть 1440 и включали
 * десктопную сетку в 960 px — панели сжимались до 260 px, таблицы уезжали в
 * внутренний скролл. Теперь флаги следуют за фактическим местом, а CSS-полосы
 * листов переведены на контейнерные запросы той же ширины.
 */
const SSR_FLAGS: ViewportFlags = {
  isSmallScreen: false,
  isTabletScreen: false,
};

export function useViewportFlags(): ViewportFlags {
  const { uiScale } = useUISettings();
  // `null` — окно ещё не измерено; до этого отдаём серверные «десктоп»-флаги.
  const [width, setWidth] = useState<number | null>(null);

  useEffect(() => {
    const update = () => setWidth(window.innerWidth);
    update();
    window.addEventListener('resize', update);
    return () => window.removeEventListener('resize', update);
  }, []);

  return useMemo(() => {
    if (width === null) return SSR_FLAGS;
    // Дробную ширину делим как есть: порог 768 сравнивается с эффективной
    // шириной, иначе под масштабом граница уезжала бы на несколько пикселей.
    return resolveViewport(width / uiScale);
  }, [width, uiScale]);
}
