/**
 * ─── LANDMARK: DH1 CAPABILITIES ────────────────────────────────────────────
 * Возможности 1-й редакции зафиксированы в модуле: без `influence`, без
 * колонки `+30`, усталость — `fatigue1st`. Никакого переключателя редакций:
 * модуль обслуживает только dh1.
 */
export interface DarkHeresyCapabilitySource {
  systemId?: string;
}

export interface DarkHeresyCapabilities {
  readonly edition: 'dh1';
  readonly influence: false;
  readonly plus30: false;
  readonly fatigueField: 'fatigue1st';
}

export function getDarkHeresyCapabilities(
  _character?: DarkHeresyCapabilitySource,
): DarkHeresyCapabilities {
  return {
    edition: 'dh1',
    influence: false,
    plus30: false,
    fatigueField: 'fatigue1st',
  };
}

export const DH1_CAPABILITIES = getDarkHeresyCapabilities();
