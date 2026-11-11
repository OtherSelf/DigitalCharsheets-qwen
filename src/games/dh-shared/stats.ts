import type { DH1Character } from '../dh1/types';
import type { DH2Character } from '../dh2/types';
import {
  DARK_HERESY_CORE_STATS,
  type DarkHeresyCoreStat,
  type DarkHeresyStatUpgrade,
} from './types';

/**
 * ─── LANDMARK: DH STAT VIEW ────────────────────────────────────────────────
 * Общие компоненты DH рисуют обе редакции, поэтому работают с одним словарём
 * характеристик (девять + `influence`). При сохранении ключи, которых нет в
 * редакции, отфильтровываются: dh1 никогда не получает `influence`.
 */
export type DarkHeresyStatKey = DarkHeresyCoreStat | 'influence';
export type DarkHeresyCharacterLike = DH1Character | DH2Character;

export const ALL_DARK_HERESY_STATS: readonly DarkHeresyStatKey[] = [
  ...DARK_HERESY_CORE_STATS,
  'influence',
];

export const EMPTY_STAT_UPGRADE: DarkHeresyStatUpgrade = [
  false,
  false,
  false,
  false,
];

export function statRecord<T>(
  character: DarkHeresyCharacterLike,
  field: 'stats' | 'statUpgrades' | 'statNotes',
  fallback: T,
): Record<DarkHeresyStatKey, T> {
  const source = (character[field] ?? {}) as Record<string, T | undefined>;
  const result = {} as Record<DarkHeresyStatKey, T>;
  for (const key of ALL_DARK_HERESY_STATS) {
    result[key] = (source[key] ?? fallback) as T;
  }
  return result;
}

export function pickAllowedStats<T>(
  record: Record<DarkHeresyStatKey, T>,
  allowInfluence: boolean,
): Partial<Record<DarkHeresyStatKey, T>> {
  const keys = allowInfluence ? ALL_DARK_HERESY_STATS : DARK_HERESY_CORE_STATS;
  const result: Partial<Record<DarkHeresyStatKey, T>> = {};
  for (const key of keys) result[key] = record[key];
  return result;
}
