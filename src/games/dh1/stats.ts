import {
  DARK_HERESY_CORE_STATS,
  type DarkHeresyCoreStat,
  type DarkHeresyStatUpgrade,
  type DH1Character,
} from './types';

/**
 * ─── LANDMARK: DH1 STAT VIEW ───────────────────────────────────────────────
 * Словарь характеристик 1-й редакции: девять полей без `influence`.
 */
export type DarkHeresyStatKey = DarkHeresyCoreStat | 'influence';
export type DarkHeresyCharacterLike = DH1Character;

export const ALL_DARK_HERESY_STATS: readonly DarkHeresyStatKey[] =
  DARK_HERESY_CORE_STATS;

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
  _allowInfluence: boolean,
): Partial<Record<DarkHeresyStatKey, T>> {
  const result: Partial<Record<DarkHeresyStatKey, T>> = {};
  for (const key of ALL_DARK_HERESY_STATS) result[key] = record[key];
  return result;
}
