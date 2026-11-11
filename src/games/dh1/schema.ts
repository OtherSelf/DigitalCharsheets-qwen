import { z } from 'zod';

import {
  darkHeresyBaseFields,
  darkHeresyCoreStatNotesSchema,
  darkHeresyCoreStatsSchema,
  darkHeresyCoreStatUpgradesSchema,
  fatigueSchema,
} from '../dh-shared/schemas';
import type { DH1Character } from './types';

/**
 * ─── LANDMARK: DH1 CHARACTER SCHEMA ────────────────────────────────────────
 * Схема листа DH 1-й редакции: общая база + девять характеристик +
 * `fatigue1st`. Полей `influence`, `fatigue2nd` и `edition` нет — их не
 * должно быть и в данных после миграции v2.
 */
export const dh1CharacterSchema: z.ZodType<DH1Character> = z.looseObject({
  ...darkHeresyBaseFields,
  systemId: z.literal('dh1').optional(),
  stats: darkHeresyCoreStatsSchema,
  statUpgrades: darkHeresyCoreStatUpgradesSchema,
  statNotes: darkHeresyCoreStatNotesSchema.optional(),
  fatigue1st: fatigueSchema,
});
