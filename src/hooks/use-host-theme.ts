'use client';

import { useEffect, useState } from 'react';

/**
 * Использует ли игра палитру и шрифт ядра вместо `ui.theme` (настройка
 * админки в `game-catalog.json`). `/api/games` отдаёт флаг per edition.
 *
 * Пока ответа нет, считаем, что тема плагина включена: для обычных игр это
 * правда и не даёт мигания; выключенная тема — редкая админская настройка.
 */
export function useHostTheme(systemId?: string): boolean {
  const [useHostTheme, setUseHostTheme] = useState(false);

  useEffect(() => {
    if (!systemId) return;
    let active = true;

    void fetch('/api/games', { cache: 'no-store' })
      .then(async (response) => {
        if (!response.ok) return null;
        return (await response.json().catch(() => null)) as {
          games?: {
            editions?: { id: string; useHostTheme?: boolean }[];
          }[];
        } | null;
      })
      .then((data) => {
        if (!active) return;
        const edition = (data?.games ?? [])
          .flatMap((game) => game.editions ?? [])
          .find((candidate) => candidate.id === systemId);
        setUseHostTheme(Boolean(edition?.useHostTheme));
      })
      .catch(() => undefined);

    return () => {
      active = false;
    };
  }, [systemId]);

  return useHostTheme;
}
