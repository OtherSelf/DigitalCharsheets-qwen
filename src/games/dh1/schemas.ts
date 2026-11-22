import { z } from 'zod';

import { inventoryItemSchema, questSchema } from '../shared/schemas';
import {
  GENDER_CODES,
  type DarkHeresyCoreStatNotes,
  type DarkHeresyCoreStats,
  type DarkHeresyCoreStatUpgrades,
  type Skill,
  type Talent,
} from './types';

/**
 * ─── LANDMARK: DARK_HERESY BASE SCHEMAS ───────────────────────────────────
 * Базовая схема листа Dark Heresy внутри модуля. `darkHeresyBaseFields` —
 * набор полей, из которого схема редакции собирает свой лист.
 */

const homeWorldSchema = z.union([
  z.enum([
    'Feral World',
    'Hive World',
    'Imperial World',
    'Void Born',
    'Forge World',
    'Schola Progenium',
    'Noble Born',
    'Mind-Cleared',
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
/**
 * Характеристика Dark Heresy: 0–100. Ступень повышения даёт +5, поэтому база
 * выше 100 в правилах не встречается; диапазон нужен, чтобы мусор (`999`) не
 * доезжал до файла.
 */
const coreStatSchema = z.number().int().min(0).max(100);

export const darkHeresyCoreStatsFields = {
  weaponSkill: coreStatSchema,
  ballisticSkill: coreStatSchema,
  strength: coreStatSchema,
  toughness: coreStatSchema,
  agility: coreStatSchema,
  intelligence: coreStatSchema,
  perception: coreStatSchema,
  willpower: coreStatSchema,
  fellowship: coreStatSchema,
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
  weight: z.string().optional(),
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
  weight: z.string().optional(),
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
  penetration: z.string().optional(),
  clip: z.number(),
  clipSize: z.number(),
  reload: z.string(),
  traits: z.string(),
  weight: z.string().optional(),
  equipped: z.boolean().optional(),
  notes: z.string().optional(),
});

const equipmentSchema = z.looseObject({
  armor: armorSchema,
  weapons: z.looseObject({
    melee: z.array(meleeWeaponSchema),
    ranged: z.array(rangedWeaponSchema),
  }),
  armorWeight: z.string().optional(),
});

/**
 * Блоки DH1, добавленные аддитивно: все опциональные, поэтому
 * legacy-листы проходят без миграции. Поля — свободные строки/числа, потому
 * что лист официально допускает ручной ввод.
 */
const listEntrySchema = z.looseObject({
  id: z.string(),
  name: z.string(),
  notes: z.string().optional(),
});

const psyPowerSchema = z.looseObject({
  id: z.string(),
  name: z.string(),
  threshold: z.string().optional(),
  notes: z.string().optional(),
});

// looseObject: старые JSON несут identity.playerName — он не поле листа, но
// парс не должен падать и не должен терять остальную идентичность.
export const dh1IdentitySchema = z.looseObject({
  gender: z.enum(GENDER_CODES).optional(),
  build: z.string().optional(),
  handedness: z.string().optional(),
});

export const dh1CarrySchema = z.looseObject({
  totalCarriedWeight: z.string().optional(),
  carry: z.string().optional(),
  lift: z.string().optional(),
  push: z.string().optional(),
});

export const dh1PsySchema = z.looseObject({
  rating: z.number().optional(),
  discipline: z.string().optional(),
  powers: z.array(psyPowerSchema).optional(),
  testedAgainst: z.string().optional(),
});

export const dh1InsanityDetailsSchema = z.looseObject({
  degree: z.string().optional(),
  traumaModifier: z.string().optional(),
  disorders: z.string().optional(),
  severity: z.string().optional(),
});

export const dh1CorruptionDetailsSchema = z.looseObject({
  degree: z.string().optional(),
  test: z.string().optional(),
  defilements: z.string().optional(),
});

export const dh1ListEntrySchema = listEntrySchema;

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

export const conditionEntrySchema = z.looseObject({
  id: z.string().min(1),
  kind: z.enum(['disorder', 'corruption', 'mutation', 'rudiment']),
  name: z.string(),
  severity: z.string().optional(),
  effect: z.string().optional(),
  notes: z.string().optional(),
  source: z.enum(['manual', 'divination', 'legacy']).optional(),
});

export const conditionsSchema = z.array(conditionEntrySchema);
