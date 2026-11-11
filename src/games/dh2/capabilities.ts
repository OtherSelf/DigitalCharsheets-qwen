/**
 * ─── LANDMARK: DH2 CAPABILITIES ────────────────────────────────────────────
 * Возможности 2-й редакции зафиксированы в модуле: `influence`, колонка
 * `+30`, усталость — `fatigue2nd`. Никакого переключателя редакций:
 * модуль обслуживает только dh2.
 */
export interface DarkHeresyCapabilitySource {
  systemId?: string;
}

export interface DarkHeresyCapabilities {
  readonly edition: 'dh2';
  readonly influence: true;
  readonly plus30: true;
  readonly fatigueField: 'fatigue2nd';
}

export function getDarkHeresyCapabilities(
  _character?: DarkHeresyCapabilitySource,
): DarkHeresyCapabilities {
  return {
    edition: 'dh2',
    influence: true,
    plus30: true,
    fatigueField: 'fatigue2nd',
  };
}

export const DH2_CAPABILITIES = getDarkHeresyCapabilities();
