import { z } from 'zod';

import { listOf, noteString, shortString } from '../shared/limits';
import {
  conditionsSchema,
  darkHeresyBaseFields,
  darkHeresyCoreStatNotesFields,
  darkHeresyCoreStatsFields,
  darkHeresyCoreStatUpgradesFields,
  darkHeresyStatUpgradeSchema,
  fatigueSchema,
} from './schemas';
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
    influence: z.number().int().min(0).max(100),
  }),
  statUpgrades: z.looseObject({
    ...darkHeresyCoreStatUpgradesFields,
    influence: darkHeresyStatUpgradeSchema,
  }),
  statNotes: z
    .looseObject({
      ...darkHeresyCoreStatNotesFields,
      influence: noteString().optional(),
    })
    .optional(),
  startingChoices: z
    .looseObject({
      roleTalent: shortString().optional(),
      skills: listOf(shortString(), 100),
      talents: listOf(shortString(), 100),
    })
    .optional(),
  fatigue2nd: fatigueSchema,
  divinationText: z
    .looseObject({ en: noteString().optional(), ru: noteString().optional() })
    .optional(),
  divinationEffectText: z
    .looseObject({ en: noteString().optional(), ru: noteString().optional() })
    .optional(),
  conditions: conditionsSchema.optional(),
});
