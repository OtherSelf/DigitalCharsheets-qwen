import { z } from 'zod';

import {
  conditionsSchema,
  darkHeresyBaseFields,
  darkHeresyCoreStatNotesSchema,
  darkHeresyCoreStatsSchema,
  darkHeresyCoreStatUpgradesSchema,
  dh1CarrySchema,
  dh1CorruptionDetailsSchema,
  dh1IdentitySchema,
  dh1InsanityDetailsSchema,
  dh1ListEntrySchema,
  dh1PsySchema,
  fatigueSchema,
} from './schemas';
import type { DH1Character } from './types';

/**
 * ─── LANDMARK: DH1 CHARACTER SCHEMA ────────────────────────────────────────
 * Схема листа DH 1-й редакции: общая база + девять характеристик +
 * `fatigue1st`. Полей `influence`, `fatigue2nd` и `edition` нет — их не
 * должно быть и в данных после миграции v2.
 *
 * Блоки ниже опциональны: лист 1e разрешает ручной ввод, а legacy-файлы не
 * должны требовать миграции.
 */
export const dh1CharacterSchema: z.ZodType<DH1Character> = z.looseObject({
  ...darkHeresyBaseFields,
  systemId: z.literal('dh1').optional(),
  stats: darkHeresyCoreStatsSchema,
  statUpgrades: darkHeresyCoreStatUpgradesSchema,
  statNotes: darkHeresyCoreStatNotesSchema.optional(),
  fatigue1st: fatigueSchema,
  identity: dh1IdentitySchema.optional(),
  carry: dh1CarrySchema.optional(),
  traits: z.array(dh1ListEntrySchema).optional(),
  mutations: z.array(dh1ListEntrySchema).optional(),
  eliteAdvances: z.array(dh1ListEntrySchema).optional(),
  psy: dh1PsySchema.optional(),
  insanityDetails: dh1InsanityDetailsSchema.optional(),
  corruptionDetails: dh1CorruptionDetailsSchema.optional(),
  experienceLog: z
    .array(
      z.looseObject({
        id: z.string(),
        label: z.string(),
        cost: z.number(),
        createdAt: z.string(),
        kind: z.enum(['award']).optional(),
      }),
    )
    .optional(),
  conditions: conditionsSchema.optional(),
});
