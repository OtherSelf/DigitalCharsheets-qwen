// src/lib/page-reload.ts

import { AUTO_RELOAD_COOLDOWN_MS } from './build-guard';

/**
 * ─── LANDMARK: PAGE RELOAD GUARD ────────────────────────────────────────────
 * Один cooldown авто-перезагрузки на вкладку для всех точек, которые могут её
 * перезагрузить: сторож новой сборки, границы ошибок и `window`-слушатели.
 *
 * Метка лежит в `sessionStorage`: перезагрузка через `location.reload()`
 * сохраняет её, поэтому «почини и перезагрузи» в каждом месте не превращается
 * в собственный цикл. Если хранилище недоступно (приватный режим, SSR) —
 * перезагружаемся один раз и не притворяемся, что помним.
 */
export const PAGE_RELOAD_KEY = 'dcs:page-reload-at';

/**
 * Пауза между восстановлениями после ошибки загрузки чанка. Короче общего
 * cooldown: перезагрузка при свежем деплое почти всегда лечит вкладку, а
 * десять минут запрета (норма для сторожа сборки) в dev превращаются в
 * «залипло на ошибке» — сервер как раз компилируется. Одна перезагрузка в
 * минуту худший случай и остаётся, петли нет.
 */
export const CHUNK_RECOVERY_COOLDOWN_MS = 60_000;

export interface ReloadStorage {
  getItem(key: string): string | null;
  setItem(key: string, value: string): void;
}

function sessionStore(): ReloadStorage | null {
  if (typeof window === 'undefined') return null;
  try {
    return window.sessionStorage;
  } catch {
    return null;
  }
}

export function readLastReloadAt(
  storage: ReloadStorage | null = sessionStore(),
): number | null {
  if (!storage) return null;

  try {
    const raw = storage.getItem(PAGE_RELOAD_KEY);
    if (raw === null) return null;
    const value = Number(raw);
    return Number.isFinite(value) ? value : null;
  } catch {
    return null;
  }
}

export function rememberReload(
  now: number,
  storage: ReloadStorage | null = sessionStore(),
): void {
  if (!storage) return;

  try {
    storage.setItem(PAGE_RELOAD_KEY, String(now));
  } catch {
    // Не записали — в худшем случае перезагрузимся ещё раз, данные не теряем.
  }
}

/** Можно ли перезагружаться самому: cooldown истёк или перезагрузок ещё не было. */
export function canAutoReload(
  now: number,
  lastReloadAt: number | null,
  cooldownMs: number = AUTO_RELOAD_COOLDOWN_MS,
): boolean {
  if (lastReloadAt === null) return true;
  return now - lastReloadAt >= cooldownMs;
}
