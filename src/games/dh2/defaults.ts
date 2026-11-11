import { createDarkHeresyBaseDefaults } from '../dh-shared/defaults';
import {
  DARK_HERESY_CORE_STATS,
  type DarkHeresyCoreStatNotes,
  type DarkHeresyCoreStats,
  type DarkHeresyCoreStatUpgrades,
  type DarkHeresyStatUpgrade,
} from '../dh-shared/types';
import { readNumber, type DefaultsInput } from '../shared/defaults';
import type {
  DH2Character,
  DH2StatNotes,
  DH2Stats,
  DH2StatUpgrades,
} from './types';

/**
 * ─── LANDMARK: DH2 DEFAULTS ────────────────────────────────────────────────
 * Фабрика персонажа DH 2-й редакции: десять характеристик (включая
 * `influence`) и `fatigue2nd`. Никаких полей 1-й редакции.
 */

export type DH2CharacterDraft = Omit<DH2Character, 'id'>;

export function createDh2Defaults(
  input: DefaultsInput = {},
): DH2CharacterDraft {
  const base = createDarkHeresyBaseDefaults(input);
  const stats = {
    ...(Object.fromEntries(
      DARK_HERESY_CORE_STATS.map((stat) => [stat, readNumber(input, stat, 30)]),
    ) as DarkHeresyCoreStats),
    influence: readNumber(input, 'influence', 30),
  } satisfies DH2Stats;
  const statUpgrades = {
    ...(Object.fromEntries(
      DARK_HERESY_CORE_STATS.map((stat) => [
        stat,
        [false, false, false, false] as DarkHeresyStatUpgrade,
      ]),
    ) as DarkHeresyCoreStatUpgrades),
    influence: [false, false, false, false] as DarkHeresyStatUpgrade,
  } satisfies DH2StatUpgrades;
  const statNotes = {} as DarkHeresyCoreStatNotes;

  return {
    ...base,
    systemId: 'dh2',
    stats,
    statUpgrades,
    statNotes: statNotes satisfies DH2StatNotes,
    fatigue2nd: { current: readNumber(input, 'fatigue2nd', 0) },
  };
}
