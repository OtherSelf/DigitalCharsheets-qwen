'use client';

import { useEffect, useMemo, useState } from 'react';

import { resolveViewport, type ViewportFlags } from '@/lib/viewport';

/**
 * ─── LANDMARK: USE_VIEWPORT_FLAGS ───────────────────────────────────────────
 * Флаги раскладки для провайдеров листа (обычного и гостевого).
 *
 * Значение считается по `window.innerWidth`, а не через `matchMedia`, и первый
 * рендер отдаёт «десктоп»: сервер не знает ширину окна, поэтому синхронное
 * значение из медиа-запроса разошлось бы с серверной разметкой и дало
 * hydration-ошибку плюс другой первый кадр в снимках. После монтирования флаги
 * уточняются по фактической ширине и дальше обновляются на `resize` с
 * задержкой в один кадр.
 */
const SSR_FLAGS: ViewportFlags = {
  isSmallScreen: false,
  isTabletScreen: false,
};

export function useViewportFlags(): ViewportFlags {
  const [isSmallScreen, setIsSmallScreen] = useState(SSR_FLAGS.isSmallScreen);
  const [isTabletScreen, setIsTabletScreen] = useState(
    SSR_FLAGS.isTabletScreen,
  );

  useEffect(() => {
    const update = () => {
      const flags = resolveViewport(window.innerWidth);
      setIsSmallScreen(flags.isSmallScreen);
      setIsTabletScreen(flags.isTabletScreen);
    };
    update();
    window.addEventListener('resize', update);
    return () => window.removeEventListener('resize', update);
  }, []);

  // Два примитива вместо одного объекта: при `resize` React не перерисовывает
  // подписчиков, если значения не изменились (объект был бы всегда новым).
  return useMemo(
    () => ({ isSmallScreen, isTabletScreen }),
    [isSmallScreen, isTabletScreen],
  );
}
