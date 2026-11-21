// src/components/dynamic-favicon.tsx
'use client';

import { useEffect } from 'react';

/**
 * ─── LANDMARK: DYNAMIC_FAVICON ──────────────────────────────────────────────
 * Иконка вкладки выбранной игры. Путь приходит из слота плагина
 * (`ui.favicon`): ядро не угадывает игру по словам в `gameSystem`.
 *
 * Узел один и живёт вне React: компонент только обновляет `href` собственной
 * ссылки. Удалять чужие `link[rel*=icon]` нельзя — их рендерит Next из
 * `app/favicon.ico`, а React владеет этими узлами: после удаления следующий
 * переход по SPA падал с `removeChild of null`.
 */
const DEFAULT_ICON = '/favicon-default.png';
const LINK_ID = 'dynamic-favicon';

/** Ссылка на иконку, которой владеет только этот компонент. */
function iconLink(): HTMLLinkElement {
  const existing = document.getElementById(LINK_ID);
  if (existing instanceof HTMLLinkElement) return existing;

  const link = document.createElement('link');
  link.id = LINK_ID;
  link.rel = 'icon';
  document.head.appendChild(link);
  return link;
}

export function DynamicFavicon({ href }: { href?: string }) {
  useEffect(() => {
    const link = iconLink();
    link.type = 'image/png';
    // Кэш-баст: браузер держит иконку по URL, смена игры должна её обновить.
    link.href = `${href || DEFAULT_ICON}?v=${Date.now()}`;

    return () => {
      // Ушли со страницы игры — возвращаем иконку ядра, не удаляя узел.
      document.getElementById(LINK_ID)?.setAttribute('href', DEFAULT_ICON);
    };
  }, [href]);

  return null;
}
