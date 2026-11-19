/**
 * ─── LANDMARK: DH1 CAPABILITIES ────────────────────────────────────────────
 * Возможности 1-й редакции зафиксированы в модуле: без колонки `+30`,
 * усталость — `fatigue1st`. Никакого переключателя редакций: модуль
 * обслуживает только dh1, поэтому `influence` здесь нет.
 */
export interface DarkHeresyCapabilities {
  readonly edition: 'dh1';
  readonly plus30: false;
  readonly fatigueField: 'fatigue1st';
}

export function getDarkHeresyCapabilities(): DarkHeresyCapabilities {
  return {
    edition: 'dh1',
    plus30: false,
    fatigueField: 'fatigue1st',
  };
}
