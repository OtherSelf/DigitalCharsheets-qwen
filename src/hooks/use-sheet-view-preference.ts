'use client';

import { useCallback, useMemo, useSyncExternalStore } from 'react';

import { SHEET_VIEW_COMPACT_KEY } from '@/lib/sheet-view';

/**
 * ─── LANDMARK: SHEET_VIEW_PREFERENCE ────────────────────────────────────────
 * Предпочтение «плотный вид» живёт в localStorage, а не в состоянии провайдера:
 * иначе включённый режим исчезал после перезагрузки, а на телефоне его нельзя
 * было выключить — кнопка там скрыта, и на планшет состояние возвращалось
 * «само».
 *
 * Первый кадр всегда «обычный» (`getServerSnapshot`): сервер не знает storage,
 * а синхронное чтение в рендере дало бы hydration-ошибку. Значение приходит в
 * первом `subscribe`, то есть сразу после монтирования — тот же приём, что у
 * `useViewportFlags` и `--ui-scale`.
 *
 * `storage`-событие держит вторую вкладку в согласии: режим — это настройка
 * интерфейса, а не сессионный флаг.
 */
const SERVER_PREFERS_COMPACT = false;

let prefersCompact = false;
let initialized = false;
let storageBound = false;
const listeners = new Set<() => void>();

function read(): boolean {
  try {
    return localStorage.getItem(SHEET_VIEW_COMPACT_KEY) === '1';
  } catch {
    // Приватный режим или запрет storage: режим живёт до перезагрузки.
    return false;
  }
}

function persist(next: boolean) {
  try {
    localStorage.setItem(SHEET_VIEW_COMPACT_KEY, next ? '1' : '0');
  } catch {
    /* storage недоступен - предпочтение останется в памяти */
  }
}

function emit() {
  listeners.forEach((listener) => listener());
}

function apply(next: boolean) {
  if (prefersCompact === next) return;
  prefersCompact = next;
  emit();
}

function onStorage(event: StorageEvent) {
  if (event.key !== SHEET_VIEW_COMPACT_KEY) return;
  apply(event.newValue === '1');
}

function init() {
  if (initialized || typeof window === 'undefined') return;
  initialized = true;
  prefersCompact = read();
  if (!storageBound) {
    storageBound = true;
    window.addEventListener('storage', onStorage);
  }
  emit();
}

function subscribe(listener: () => void) {
  listeners.add(listener);
  init();
  return () => {
    listeners.delete(listener);
  };
}

const getSnapshot = () => prefersCompact;
const getServerSnapshot = () => SERVER_PREFERS_COMPACT;

export function useSheetViewPreference() {
  const value = useSyncExternalStore(subscribe, getSnapshot, getServerSnapshot);
  const setPreference = useCallback((next: boolean) => {
    persist(next);
    apply(next);
  }, []);

  return useMemo(
    () => ({ prefersCompact: value, setPrefersCompact: setPreference }),
    [value, setPreference],
  );
}
