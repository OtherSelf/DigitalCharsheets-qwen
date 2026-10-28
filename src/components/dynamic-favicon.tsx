// src/components/dynamic-favicon.tsx
'use client';

import { useEffect } from 'react';

export function DynamicFavicon({ gameSystem = 'default' }: { gameSystem?: string }) {
  useEffect(() => {
    console.log('🎯 [FAVICON] Updating for:', gameSystem);

    let iconHref = '/favicon-default.png';
    const gs = (gameSystem || '').toLowerCase();
    
    if (gs.includes('dungeon') || gs.includes('dnd')) {
      iconHref = '/favicon-dnd.png';
    } else if (gs.includes('heresy') || gs.includes('dark')) {
      iconHref = '/favicon-dh.png';
    }

    // 🎯 LANDMARK: AGGRESSIVE DOM UPDATE
    // 1. Remove ALL existing icon links to prevent browser caching conflicts
    const existingLinks = document.querySelectorAll("link[rel*='icon']");
    existingLinks.forEach(link => link.remove());

    // 2. Create a brand new link element
    const link = document.createElement('link');
    link.rel = 'shortcut icon';
    
    // 🎯 CRITICAL: If your files are actually .ico, change 'image/png' to 'image/x-icon' 
    // AND change the filenames above to end in .ico
    link.type = 'image/png'; 
    link.href = `${iconHref}?v=${Date.now()}`;
    
    document.head.appendChild(link);
    
    console.log('🎯 [FAVICON] Applied new href:', link.href);

  }, [gameSystem]);

  return null;
}