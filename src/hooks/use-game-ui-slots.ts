'use client';

import { useEffect, useState } from 'react';

import {
  getLoadedGameUiSlots,
  listGameModules,
  loadGameUiSlots,
} from '@/games/registry';
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

/**
 * Слоты всех зарегистрированных плагинов (страницы-«хабы» вроде массового
 * редактора, которым нужны таблицы каждой игры). Возвращает карту `systemId`
 * → слоты; отсутствующие записи означают «ещё грузится»/«слот не задан».
 */
export function useAllGameUiSlots(): Record<string, GameUiSlots<any>> {
  const [slots, setSlots] = useState<Record<string, GameUiSlots<any>>>(() => {
    const initial: Record<string, GameUiSlots<any>> = {};
    for (const gameModule of listGameModules()) {
      const cached = getLoadedGameUiSlots(gameModule.id);
      if (cached) initial[gameModule.id] = cached;
    }
    return initial;
  });

  useEffect(() => {
    let active = true;
    const modules = listGameModules();
    void Promise.all(
      modules.map(async (gameModule) => {
        const loaded =
          getLoadedGameUiSlots(gameModule.id) ??
          (await loadGameUiSlots(gameModule.id));
        return [gameModule.id, loaded ?? {}] as const;
      }),
    ).then((entries) => {
      if (active) setSlots(Object.fromEntries(entries));
    });
    return () => {
      active = false;
    };
  }, []);

  return slots;
}
