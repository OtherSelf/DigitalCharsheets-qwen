import { z } from 'zod';

import { inventoryItemSchema, questSchema } from '../shared/schemas';
import type {
  DarkHeresyBase,
  DarkHeresyCoreStatNotes,
  DarkHeresyCoreStats,
  DarkHeresyCoreStatUpgrades,
  Skill,
  Talent,
} from './types';

/**
 * ─── LANDMARK: DH SHARED SCHEMAS ───────────────────────────────────────────
 * Схемы общей части Dark Heresy. `darkHeresyBaseFields` — набор полей, из
 * которого dh1/dh2 собирают свои схемы; редакционные отличия добавляются в
 * `src/games/dh1/schema.ts` и `src/games/dh2/schema.ts`.
 */

const homeWorldSchema = z.union([
  z.enum([
    'Feral World',
    'Hive World',
    'Imperial World',
    'Void Born',
    'Forge World',
  ]),
  z.literal(''),
]);
const careerPathSchema = z.union([
  z.enum([
    'Adept',
    'Arbitrator',
    'Assassin',
    'Cleric',
    'Guardsman',
    'Imperial Psyker',
    'Scum',
    'Tech-Priest',
  ]),
  z.literal(''),
]);

const upgradeSchema = z.tuple([
  z.boolean(),
  z.boolean(),
  z.boolean(),
  z.boolean(),
]);

/** Поля характеристик; `influence` добавляет только dh2. */
export const darkHeresyCoreStatsFields = {
  weaponSkill: z.number(),
  ballisticSkill: z.number(),
  strength: z.number(),
  toughness: z.number(),
  agility: z.number(),
  intelligence: z.number(),
  perception: z.number(),
  willpower: z.number(),
  fellowship: z.number(),
};

export const darkHeresyCoreStatsSchema: z.ZodType<DarkHeresyCoreStats> =
  z.looseObject(darkHeresyCoreStatsFields);

/** Поля апгрейдов; `influence` добавляет только dh2. */
export const darkHeresyCoreStatUpgradesFields = {
  weaponSkill: upgradeSchema,
  ballisticSkill: upgradeSchema,
  strength: upgradeSchema,
  toughness: upgradeSchema,
  agility: upgradeSchema,
  intelligence: upgradeSchema,
  perception: upgradeSchema,
  willpower: upgradeSchema,
  fellowship: upgradeSchema,
};

export const darkHeresyCoreStatUpgradesSchema: z.ZodType<DarkHeresyCoreStatUpgrades> =
  z.looseObject(darkHeresyCoreStatUpgradesFields);

/** Поля заметок к характеристикам; `influence` добавляет только dh2. */
export const darkHeresyCoreStatNotesFields = {
  weaponSkill: z.string().optional(),
  ballisticSkill: z.string().optional(),
  strength: z.string().optional(),
  toughness: z.string().optional(),
  agility: z.string().optional(),
  intelligence: z.string().optional(),
  perception: z.string().optional(),
  willpower: z.string().optional(),
  fellowship: z.string().optional(),
};

export const darkHeresyCoreStatNotesSchema: z.ZodType<DarkHeresyCoreStatNotes> =
  z.looseObject(darkHeresyCoreStatNotesFields);

/** Схема одного апгрейда (+5/+10/+15/+20) — нужна dh2 для `influence`. */
export const darkHeresyStatUpgradeSchema = upgradeSchema;

export const fatigueSchema = z.looseObject({
  current: z.number(),
  notes: z.string().optional(),
});

const skillSchema: z.ZodType<Skill> = z.looseObject({
  id: z.string(),
  name: z.string(),
  notes: z.string(),
  type: z.enum(['basic', 'advanced']),
  training: z.looseObject({
    skilled: z.boolean(),
    plus10: z.boolean(),
    plus20: z.boolean(),
    plus30: z.boolean(),
  }),
});

const talentSchema: z.ZodType<Talent> = z.looseObject({
  id: z.string(),
  name: z.string(),
  notes: z.string().optional(),
  description: z.string().optional(),
});

const armorPieceSchema = z.looseObject({
  ap: z.number(),
  type: z.string(),
  mods: z.string(),
  quality: z.string(),
});

const bodyPartSchema = z.enum([
  'Head',
  'Right arm',
  'Body',
  'Left arm',
  'Right leg',
  'Left leg',
]);

const armorSchema = z.record(bodyPartSchema, armorPieceSchema.nullable());

const meleeWeaponSchema = z.looseObject({
  id: z.string(),
  name: z.string(),
  type: z.string(),
  range: z.string(),
  penetration: z.string(),
  damage: z.string(),
  traits: z.string(),
  equipped: z.boolean().optional(),
  notes: z.string().optional(),
});

const rangedWeaponSchema = z.looseObject({
  id: z.string(),
  name: z.string(),
  type: z.string(),
  range: z.string(),
  rof: z.string(),
  damage: z.string(),
  clip: z.number(),
  clipSize: z.number(),
  reload: z.string(),
  traits: z.string(),
  equipped: z.boolean().optional(),
  notes: z.string().optional(),
});

const equipmentSchema = z.looseObject({
  armor: armorSchema,
  weapons: z.looseObject({
    melee: z.array(meleeWeaponSchema),
    ranged: z.array(rangedWeaponSchema),
  }),
});

const resourceSchema = z.looseObject({
  id: z.string(),
  description: z.string(),
  current: z.number(),
  max: z.number(),
  notes: z.string().optional(),
});

/**
 * Поля, одинаковые у dh1 и dh2. Не содержит `systemId`, характеристик,
 * апгрейдов и усталости — их добавляет схема редакции.
 */
export const darkHeresyBaseFields = {
  id: z.string(),
  name: z.string(),
  characterClass: z.string(),
  gameSystem: z.literal('Dark Heresy'),
  backstory: z.string(),
  notes: z.string(),
  questLog: z.array(questSchema),
  schemaVersion: z.number().int().optional(),
  homeWorld: homeWorldSchema,
  worldVariant: z.string(),
  careerPath: careerPathSchema,
  rank: z.string(),
  divination: z.string(),
  divinationEffect: z.string(),
  quirk: z.string(),
  height: z.string(),
  weight: z.string(),
  age: z.string(),
  skinColor: z.string(),
  hairColor: z.string(),
  eyeColor: z.string(),
  experience: z.number(),
  totalExpSpent: z.number(),
  alternatePath: z.string().nullable(),
  advancedPath: z.string().nullable(),
  wounds: z.looseObject({
    current: z.number(),
    max: z.number(),
    notes: z.string().optional(),
  }),
  fatePoints: z.looseObject({
    current: z.number(),
    max: z.number(),
    notes: z.string().optional(),
  }),
  insanityPoints: z.looseObject({
    total: z.number(),
    notes: z.string().optional(),
  }),
  corruptionPoints: z.looseObject({
    total: z.number(),
    notes: z.string().optional(),
  }),
  wealth: z.looseObject({
    throneGelt: z.number(),
    monthlyIncome: z.number(),
    notes: z.string().optional(),
  }),
  movement: z.looseObject({
    walkHalf: z.number(),
    walkFull: z.number(),
    charge: z.number(),
    run: z.number(),
  }),
  equipment: equipmentSchema,
  inventory: z.array(inventoryItemSchema),
  skills: z.array(skillSchema),
  talents: z.array(talentSchema),
  criticalConditions: z.array(
    z.looseObject({
      id: z.string(),
      name: z.string(),
      notes: z.string().optional(),
    }),
  ),
  customHouseRules: z
    .array(z.object({ name: z.string(), description: z.string() }))
    .optional(),
  customResources: z.array(resourceSchema).optional(),
};

export const darkHeresyBaseSchema: z.ZodType<DarkHeresyBase> =
  z.looseObject(darkHeresyBaseFields);
