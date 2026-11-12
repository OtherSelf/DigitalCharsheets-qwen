// src/components/dynamic-favicon.tsx
'use client';

import { useEffect } from 'react';

/**
 * Иконка вкладки выбранной игры. Путь приходит из слота плагина
 * (`ui.favicon`): ядро больше не угадывает игру по словам в `gameSystem`.
 */
export function DynamicFavicon({ href }: { href?: string }) {
  useEffect(() => {
    const iconHref = href || '/favicon-default.png';

    // LANDMARK: AGGRESSIVE DOM UPDATE
    // 1. Remove ALL existing icon links to prevent browser caching conflicts
    const existingLinks = document.querySelectorAll("link[rel*='icon']");
    existingLinks.forEach((link) => link.remove());

    // 2. Create a brand new link element
    const link = document.createElement('link');
    link.rel = 'shortcut icon';

    // CRITICAL: If your files are actually .ico, change 'image/png' to 'image/x-icon'
    // AND change the filenames above to end in .ico
    link.type = 'image/png';
    link.href = `${iconHref}?v=${Date.now()}`;

    document.head.appendChild(link);

    console.log('[FAVICON] Applied new href:', link.href);
  }, [href]);

  return null;
}
