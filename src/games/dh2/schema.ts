import { z } from 'zod';

import {
  darkHeresyBaseFields,
  darkHeresyCoreStatNotesFields,
  darkHeresyCoreStatsFields,
  darkHeresyCoreStatUpgradesFields,
  darkHeresyStatUpgradeSchema,
  fatigueSchema,
} from '../dh-shared/schemas';
import type { DH2Character } from './types';

/**
 * ─── LANDMARK: DH2 CHARACTER SCHEMA ────────────────────────────────────────
 * Схема листа DH 2-й редакции: общая база + десятая характеристика
 * `influence` + `fatigue2nd`. Полей `fatigue1st` и `edition` нет.
 */
export const dh2CharacterSchema: z.ZodType<DH2Character> = z.looseObject({
  ...darkHeresyBaseFields,
  systemId: z.literal('dh2').optional(),
  stats: z.looseObject({
    ...darkHeresyCoreStatsFields,
    influence: z.number(),
  }),
  statUpgrades: z.looseObject({
    ...darkHeresyCoreStatUpgradesFields,
    influence: darkHeresyStatUpgradeSchema,
  }),
  statNotes: z
    .looseObject({
      ...darkHeresyCoreStatNotesFields,
      influence: z.string().optional(),
    })
    .optional(),
  fatigue2nd: fatigueSchema,
});
