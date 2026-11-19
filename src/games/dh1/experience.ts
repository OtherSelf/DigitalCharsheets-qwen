import type { ExperienceLogRow } from '@/games/plugin-host';

import type { DH1ExperienceEntry } from './types';

/**
 * Адаптер журнала DH1: записи уже хранят готовую подпись (`label`), поэтому
 * остаётся только привести их к общему виду правого Sheet.
 */
export function dh1ExperienceRows(
  entries: readonly DH1ExperienceEntry[] | undefined,
): ExperienceLogRow[] {
  return (entries ?? []).map(({ id, label, cost, createdAt }) => ({
    id,
    label,
    cost,
    createdAt,
  }));
}
