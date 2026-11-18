import { statTotal as sumStat } from '@/games/shared/dh-stats';

import {
  DARK_HERESY_CORE_STATS,
  type DarkHeresyCoreStat,
  type DarkHeresyStatUpgrade,
  type DH2Character,
} from './types';

/**
 * ─── LANDMARK: DH2 STAT VIEW ───────────────────────────────────────────────
 * Словарь характеристик 2-й редакции: девять полей + `influence`.
 */
export type DarkHeresyStatKey = DarkHeresyCoreStat | 'influence';
export type DarkHeresyCharacterLike = DH2Character;

export const ALL_DARK_HERESY_STATS: readonly DarkHeresyStatKey[] = [
  ...DARK_HERESY_CORE_STATS,
  'influence',
];

export const EMPTY_STAT_UPGRADE: DarkHeresyStatUpgrade = [
  false,
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

/**
 * Итог характеристики с покупками: база + 5 за каждую ступень.
 *
 * Арифметика — в `shared/dh-stats.ts` (одна на обе редакции), здесь только
 * удобный доступ по ключу персонажа.
 */
export function statTotal(
  character: Pick<DH2Character, 'stats' | 'statUpgrades'>,
  key: DarkHeresyStatKey,
): number {
  return sumStat(
    character.stats?.[key],
    character.statUpgrades?.[key] ?? EMPTY_STAT_UPGRADE,
  );
}
