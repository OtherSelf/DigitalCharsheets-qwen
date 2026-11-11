import { createDarkHeresyBaseDefaults } from '../dh-shared/defaults';
import {
  DARK_HERESY_CORE_STATS,
  type DarkHeresyCoreStats,
  type DarkHeresyCoreStatUpgrades,
  type DarkHeresyStatUpgrade,
} from '../dh-shared/types';
import { readNumber, type DefaultsInput } from '../shared/defaults';
import type { DH1Character } from './types';

/**
 * ─── LANDMARK: DH1 DEFAULTS ────────────────────────────────────────────────
 * Фабрика персонажа DH 1-й редакции: девять характеристик и `fatigue1st`.
 * Никаких полей 2-й редакции — тип и схема этого не допускают.
 */

export type DH1CharacterDraft = Omit<DH1Character, 'id'>;

export function createDh1Defaults(
  input: DefaultsInput = {},
): DH1CharacterDraft {
  const base = createDarkHeresyBaseDefaults(input);
  const stats = Object.fromEntries(
    DARK_HERESY_CORE_STATS.map((stat) => [stat, readNumber(input, stat, 30)]),
  ) as DarkHeresyCoreStats;
  const statUpgrades = Object.fromEntries(
    DARK_HERESY_CORE_STATS.map((stat) => [
      stat,
      [false, false, false, false] as DarkHeresyStatUpgrade,
    ]),
  ) as DarkHeresyCoreStatUpgrades;

  return {
    ...base,
    systemId: 'dh1',
    stats,
    statUpgrades,
    statNotes: {},
    fatigue1st: { current: readNumber(input, 'fatigue1st', 0) },
  };
}
