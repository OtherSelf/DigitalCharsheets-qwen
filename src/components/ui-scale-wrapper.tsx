// src/components/ui-scale-wrapper.tsx
'use client';

import { useEffect, useRef, ReactNode } from 'react';
import { useUISettings } from '@/hooks/use-ui-settings';

export function UIScaleWrapper({ children }: { children: ReactNode }) {
  const { uiScale } = useUISettings();
  const wrapperRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const el = wrapperRef.current;
    if (!el) return;

    // 🎯 LANDMARK: EMPTY_SPACE_FIX
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
      className="flex flex-col bg-background overflow-hidden"
      style={{
        willChange: 'transform',
        transformOrigin: 'top left',
        width: '100vw',
        height: '100dvh',
        position: 'fixed',
        top: 0,
        left: 0,
        right: 0,
        bottom: 0,
      }}
    >
      {children}
    </div>
  );
}