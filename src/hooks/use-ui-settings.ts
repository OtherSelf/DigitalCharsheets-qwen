// src/hooks/use-ui-settings.ts
'use client';

import { useSyncExternalStore } from 'react';

// 🎯 LANDMARK: UI_SETTINGS_LIMITS
const MIN_TEXT_SCALE = 0.67; // 8pt floor relative to the 12pt (16px) default
const MAX_TEXT_SCALE = 2.0;
const MIN_UI_SCALE = 0.5;
const MAX_UI_SCALE = 1.5;

const TEXT_KEY = 'ui-text-scale';
const UI_KEY = 'ui-scale';
const LEGACY_FONT_PX_KEY = 'ui-font-size'; // from the first implementation

type UISettingsState = {
  textScale: number;
  uiScale: number;
  isLoaded: boolean;
};

const SERVER_STATE: UISettingsState = { textScale: 1, uiScale: 1, isLoaded: false };

let state: UISettingsState = SERVER_STATE;
let initialized = false;
const listeners = new Set<() => void>();

const clamp = (v: number, min: number, max: number) => Math.min(Math.max(v, min), max);
const round2 = (v: number) => Math.round(v * 100) / 100;

function applyToDocument() {
  if (typeof document === 'undefined') return;
  const root = document.documentElement;
  root.style.setProperty('--text-scale', String(state.textScale));
  root.style.setProperty('--ui-scale', String(state.uiScale));
  // Clean up leftovers from the first implementation, if any.
  root.style.removeProperty('zoom');
  root.style.removeProperty('font-size');
  root.style.removeProperty('min-height');
  document.body.style.removeProperty('min-height');
}

function setState(patch: Partial<UISettingsState>) {
  state = { ...state, ...patch };
  applyToDocument();
  listeners.forEach((l) => l());
}

function persist(key: string, value: number) {
  try {
    localStorage.setItem(key, String(value));
  } catch {
    /* storage unavailable - ignore */
  }
}

function readNumber(key: string): number | null {
  try {
    const raw = localStorage.getItem(key);
    if (!raw) return null;
    const n = parseFloat(raw);
    return Number.isFinite(n) ? n : null;
  } catch {
    return null;
  }
}

function init() {
  if (initialized || typeof window === 'undefined') return;
  initialized = true;

  let textScale = 1;
  let uiScale = 1;

  const savedText = readNumber(TEXT_KEY);
  if (savedText !== null) {
    textScale = clamp(savedText, MIN_TEXT_SCALE, MAX_TEXT_SCALE);
  } else {
    const legacyPx = readNumber(LEGACY_FONT_PX_KEY);
    if (legacyPx !== null) textScale = clamp(legacyPx / 16, MIN_TEXT_SCALE, MAX_TEXT_SCALE);
  }

  const savedUi = readNumber(UI_KEY);
  if (savedUi !== null) uiScale = clamp(savedUi, MIN_UI_SCALE, MAX_UI_SCALE);

  setState({ textScale: round2(textScale), uiScale: round2(uiScale), isLoaded: true });
}

function subscribe(listener: () => void) {
  listeners.add(listener);
  init();
  return () => {
    listeners.delete(listener);
  };
}

const getSnapshot = () => state;
const getServerSnapshot = () => SERVER_STATE;

export function updateTextScale(value: number) {
  const next = round2(clamp(value, MIN_TEXT_SCALE, MAX_TEXT_SCALE));
  persist(TEXT_KEY, next);
  setState({ textScale: next });
}

export function updateUiScale(value: number) {
  const next = round2(clamp(value, MIN_UI_SCALE, MAX_UI_SCALE));
  persist(UI_KEY, next);
  setState({ uiScale: next });
}

export function resetSettings() {
  updateTextScale(1);
  updateUiScale(1);
}

export function useUISettings() {
  const snapshot = useSyncExternalStore(subscribe, getSnapshot, getServerSnapshot);

  return {
    textScale: snapshot.textScale,
    uiScale: snapshot.uiScale,
    isLoaded: snapshot.isLoaded,
    updateTextScale,
    updateUiScale,
    resetSettings,
    minTextScale: MIN_TEXT_SCALE,
    maxTextScale: MAX_TEXT_SCALE,
    minUiScale: MIN_UI_SCALE,
    maxUiScale: MAX_UI_SCALE,
  };
}