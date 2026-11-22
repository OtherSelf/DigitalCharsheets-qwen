import { z } from 'zod';

import {
  FIELD_LIMITS,
  idString,
  listOf,
  noteString,
  shortString,
} from '../shared/limits';
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
  weaponSkill: noteString().optional(),
  ballisticSkill: noteString().optional(),
  strength: noteString().optional(),
  toughness: noteString().optional(),
  agility: noteString().optional(),
  intelligence: noteString().optional(),
  perception: noteString().optional(),
  willpower: noteString().optional(),
  fellowship: noteString().optional(),
};

export const darkHeresyCoreStatNotesSchema: z.ZodType<DarkHeresyCoreStatNotes> =
  z.looseObject(darkHeresyCoreStatNotesFields);

export const fatigueSchema = z.looseObject({
  current: z.number().int().min(0).max(FIELD_LIMITS.pool),
  notes: noteString().optional(),
});

const skillSchema: z.ZodType<Skill> = z.looseObject({
  id: idString(),
  name: z.string().max(FIELD_LIMITS.name),
  notes: noteString(),
  type: z.enum(['basic', 'advanced']),
  training: z.looseObject({
    skilled: z.boolean(),
    plus10: z.boolean(),
    plus20: z.boolean(),
    plus30: z.boolean(),
  }),
});

const talentSchema: z.ZodType<Talent> = z.looseObject({
  id: idString(),
  name: z.string().max(FIELD_LIMITS.name),
  notes: noteString().optional(),
  description: z.string().max(FIELD_LIMITS.long).optional(),
});

const armorPieceSchema = z.looseObject({
  ap: z.number().int().min(0).max(FIELD_LIMITS.small),
  type: shortString(),
  mods: shortString(),
  quality: shortString(),
  weight: shortString().optional(),
  notes: noteString().optional(),
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
  id: idString(),
  name: z.string().max(FIELD_LIMITS.name),
  type: shortString(),
  range: shortString(),
  penetration: shortString(),
  damage: shortString(),
  traits: shortString(),
  weight: shortString().optional(),
  equipped: z.boolean().optional(),
  notes: noteString().optional(),
});

const rangedWeaponSchema = z.looseObject({
  id: idString(),
  name: z.string().max(FIELD_LIMITS.name),
  type: shortString(),
  range: shortString(),
  rof: shortString(),
  damage: shortString(),
  penetration: shortString().optional(),
  clip: z.number().int().min(0).max(FIELD_LIMITS.pool),
  clipSize: z.number().int().min(0).max(FIELD_LIMITS.pool),
  reload: shortString(),
  traits: shortString(),
  weight: shortString().optional(),
  equipped: z.boolean().optional(),
  notes: noteString().optional(),
});

const equipmentSchema = z.looseObject({
  armor: armorSchema,
  weapons: z.looseObject({
    melee: listOf(meleeWeaponSchema, 200),
    ranged: listOf(rangedWeaponSchema, 200),
  }),
  armorWeight: shortString().optional(),
});

/**
 * Блоки DH1, добавленные аддитивно: все опциональные, поэтому
 * legacy-листы проходят без миграции. Поля — свободные строки/числа, потому
 * что лист официально допускает ручной ввод.
 */
const listEntrySchema = z.looseObject({
  id: idString(),
  name: z.string().max(FIELD_LIMITS.name),
  notes: noteString().optional(),
});

const psyPowerSchema = z.looseObject({
  id: idString(),
  name: z.string().max(FIELD_LIMITS.name),
  threshold: shortString().optional(),
  notes: noteString().optional(),
});

// looseObject: старые JSON несут identity.playerName — он не поле листа, но
// парс не должен падать и не должен терять остальную идентичность.
export const dh1IdentitySchema = z.looseObject({
  gender: z.enum(GENDER_CODES).optional(),
  build: shortString().optional(),
  handedness: shortString().optional(),
});

export const dh1CarrySchema = z.looseObject({
  totalCarriedWeight: shortString().optional(),
  carry: shortString().optional(),
  lift: shortString().optional(),
  push: shortString().optional(),
});

export const dh1PsySchema = z.looseObject({
  rating: z.number().int().min(0).max(10).optional(),
  discipline: shortString().optional(),
  powers: listOf(psyPowerSchema, 100).optional(),
  testedAgainst: shortString().optional(),
});

export const dh1InsanityDetailsSchema = z.looseObject({
  degree: shortString().optional(),
  traumaModifier: shortString().optional(),
  disorders: noteString().optional(),
  severity: shortString().optional(),
});

export const dh1CorruptionDetailsSchema = z.looseObject({
  degree: shortString().optional(),
  test: shortString().optional(),
  defilements: noteString().optional(),
});

export const dh1ListEntrySchema = listEntrySchema;

const resourceSchema = z.looseObject({
  id: idString(),
  description: shortString(),
  current: z.number().int().min(0).max(FIELD_LIMITS.pool),
  max: z.number().int().min(0).max(FIELD_LIMITS.pool),
  notes: noteString().optional(),
});

/**
 * Поля, одинаковые у dh1 и dh2. Не содержит `systemId`, характеристик,
 * апгрейдов и усталости — их добавляет схема редакции.
 */
export const darkHeresyBaseFields = {
  id: idString(),
  name: z.string().max(FIELD_LIMITS.name),
  characterClass: shortString(),
  gameSystem: z.literal('Dark Heresy'),
  backstory: z.string().max(FIELD_LIMITS.long),
  notes: z.string().max(FIELD_LIMITS.long),
  questLog: listOf(questSchema),
  schemaVersion: z.number().int().optional(),
  homeWorld: homeWorldSchema,
  worldVariant: shortString(),
  careerPath: careerPathSchema,
  rank: shortString(),
  divination: shortString(),
  divinationEffect: shortString(),
  quirk: shortString(),
  height: shortString(),
  weight: shortString(),
  age: shortString(),
  skinColor: shortString(),
  hairColor: shortString(),
  eyeColor: shortString(),
  experience: z.number().int().min(0).max(FIELD_LIMITS.experience),
  totalExpSpent: z.number().int().min(0).max(FIELD_LIMITS.experience),
  alternatePath: shortString().nullable(),
  advancedPath: shortString().nullable(),
  wounds: z.looseObject({
    current: z.number().int().min(0).max(FIELD_LIMITS.pool),
    max: z.number().int().min(0).max(FIELD_LIMITS.pool),
    notes: noteString().optional(),
  }),
  fatePoints: z.looseObject({
    current: z.number().int().min(0).max(FIELD_LIMITS.pool),
    max: z.number().int().min(0).max(FIELD_LIMITS.pool),
    notes: noteString().optional(),
  }),
  insanityPoints: z.looseObject({
    total: z.number().int().min(0).max(FIELD_LIMITS.pool),
    notes: noteString().optional(),
  }),
  corruptionPoints: z.looseObject({
    total: z.number().int().min(0).max(FIELD_LIMITS.pool),
    notes: noteString().optional(),
  }),
  wealth: z.looseObject({
    throneGelt: z.number().int().min(0).max(FIELD_LIMITS.money),
    monthlyIncome: z.number().int().min(0).max(FIELD_LIMITS.money),
    notes: noteString().optional(),
  }),
  movement: z.looseObject({
    walkHalf: z.number().int().min(0).max(FIELD_LIMITS.pool),
    walkFull: z.number().int().min(0).max(FIELD_LIMITS.pool),
    charge: z.number().int().min(0).max(FIELD_LIMITS.pool),
    run: z.number().int().min(0).max(FIELD_LIMITS.pool),
  }),
  equipment: equipmentSchema,
  inventory: listOf(inventoryItemSchema),
  skills: listOf(skillSchema),
  talents: listOf(talentSchema),
  criticalConditions: listOf(
    z.looseObject({
      id: idString(),
      name: z.string().max(FIELD_LIMITS.name),
      notes: noteString().optional(),
    }),
    100,
  ),
  customHouseRules: listOf(
    z.object({
      name: z.string().max(FIELD_LIMITS.name),
      description: z.string().max(FIELD_LIMITS.note),
    }),
    100,
  ).optional(),
  customResources: listOf(resourceSchema, 100).optional(),
};

export const conditionEntrySchema = z.looseObject({
  id: idString(),
  kind: z.enum(['disorder', 'corruption', 'mutation', 'rudiment']),
  name: z.string().max(FIELD_LIMITS.name),
  severity: shortString().optional(),
  effect: noteString().optional(),
  notes: noteString().optional(),
  source: z.enum(['manual', 'divination', 'legacy']).optional(),
});

export const conditionsSchema = listOf(conditionEntrySchema, 500);
