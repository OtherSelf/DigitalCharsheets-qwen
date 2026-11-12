'use client';

import { useEffect, useState } from 'react';

import { getLoadedGameUiSlots, loadGameUiSlots } from '@/games/registry';
import type { GameUiSlots } from '@/games/types';

/**
 * ─── LANDMARK: USE_GAME_UI_SLOTS ───────────────────────────────────────────
 * Ленивая загрузка UI-слотов плагина по `systemId` (этап 3). Пока чанк не
 * приехал (или если он упал), хост рисует нейтральные fallback-варианты:
 * шапка, карточка и сайдбар остаются рабочими.
 */
export function useGameUiSlots(
  systemId: string | undefined,
): GameUiSlots<any> | undefined {
  const [slots, setSlots] = useState<GameUiSlots<any> | undefined>(() =>
    systemId ? getLoadedGameUiSlots(systemId) : undefined,
  );

  useEffect(() => {
    if (!systemId) {
      setSlots(undefined);
      return;
    }
    const cached = getLoadedGameUiSlots(systemId);
    if (cached) {
      setSlots(cached);
      return;
    }
    let active = true;
    loadGameUiSlots(systemId)?.then((loaded) => {
      if (active) setSlots(loaded);
    });
    return () => {
      active = false;
    };
  }, [systemId]);

  return slots;
}
