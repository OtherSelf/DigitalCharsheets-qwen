'use client';

import { useEffect, useState } from 'react';

/**
 * Заголовок сайта из `<data-dir>/settings/game-catalog.json` (через публичный
 * `/api/games`). Кэш на уровне модуля: шапка есть на каждой странице, лишние
 * запросы не нужны. `null` — переопределения нет, шапка показывает бренд.
 */
let cached: string | null | undefined;
let request: Promise<string | null> | null = null;

function fetchSiteTitle(): Promise<string | null> {
  if (request) return request;
  request = fetch('/api/games', { cache: 'no-store' })
    .then(async (res) => {
      if (!res.ok) return null;
      const data = (await res.json().catch(() => null)) as {
        siteTitle?: unknown;
      } | null;
      return typeof data?.siteTitle === 'string' && data.siteTitle.trim()
        ? data.siteTitle.trim()
        : null;
    })
    .catch(() => null);
  return request;
}

export function useSiteTitle(): string | null {
  const [title, setTitle] = useState<string | null>(cached ?? null);

  useEffect(() => {
    if (cached !== undefined) {
      setTitle(cached);
      return;
    }
    let active = true;
    void fetchSiteTitle().then((value) => {
      cached = value;
      if (active) setTitle(value);
    });
    return () => {
      active = false;
    };
  }, []);

  return title;
}
