import { z } from 'zod';

import {
  FIELD_LIMITS,
  idString,
  listOf,
  noteString,
  shortString,
} from '../shared/limits';
import {
  inventoryItemSchema,
  noteTabsSchema,
  questSchema,
} from '../shared/schemas';
import {
  DARK_HERESY_CORE_STATS,
  GENDER_CODES,
  type ConditionKind,
  type Skill,
  type Talent,
} from './types';

/**
 * ─── LANDMARK: DARK_HERESY BASE SCHEMAS ───────────────────────────────────
 * Базовая схема листа Dark Heresy внутри модуля. `darkHeresyBaseFields` —
 * набор полей, из которого схема редакции собирает свой лист.
 */

const upgradeSchema = z.tuple([
  z.boolean(),
  z.boolean(),
  z.boolean(),
  z.boolean(),
  z.boolean(),
]);

/** Поля характеристик; `influence` добавляет только dh2. */
/**
 * Характеристика Dark Heresy: 0–100 (правило d100). Влияние
 * (`influence`) измеряется теми же пределами.
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

/** Схема одного апгрейда (+5/+10/+15/+20) — нужна dh2 для `influence`. */
export const darkHeresyStatUpgradeSchema = upgradeSchema;

export const fatigueSchema = z.looseObject({
  current: z.number().int().min(0).max(FIELD_LIMITS.pool),
  notes: noteString().optional(),
});

/**
 * Характеристика умения: девять базовых плюс `influence` (ресурс 2e вместо
 * богатства). Неизвестный код не валит импорт — поле просто не заполнено.
 */
const DH2_SKILL_CHARACTERISTICS = [
  ...DARK_HERESY_CORE_STATS,
  'influence',
] as const;

const skillCharacteristicSchema = z
  .enum(DH2_SKILL_CHARACTERISTICS)
  .optional()
  .catch(undefined);

const skillSchema: z.ZodType<Skill> = z.looseObject({
  id: idString(),
  name: z.string().max(FIELD_LIMITS.name),
  notes: noteString(),
  type: z.enum(['basic', 'advanced']),
  characteristic: skillCharacteristicSchema,
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
  equipped: z.boolean().optional(),
  notes: noteString().optional(),
});

const rangedWeaponSchema = z.looseObject({
  id: idString(),
  name: z.string().max(FIELD_LIMITS.name),
  type: shortString(),
  range: shortString(),
  penetration: shortString().optional(),
  rof: shortString(),
  damage: shortString(),
  clip: z.number().int().min(0).max(FIELD_LIMITS.pool),
  clipSize: z.number().int().min(0).max(FIELD_LIMITS.pool),
  reload: shortString(),
  traits: shortString(),
  equipped: z.boolean().optional(),
  notes: noteString().optional(),
});

const equipmentSchema = z.looseObject({
  armor: armorSchema,
  weapons: z.looseObject({
    melee: listOf(meleeWeaponSchema, 200),
    ranged: listOf(rangedWeaponSchema, 200),
  }),
});

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
  noteTabs: noteTabsSchema.optional(),
  questLog: listOf(questSchema),
  schemaVersion: z.number().int().optional(),
  homeWorld: shortString(),
  background: shortString(),
  role: shortString(),
  divination: shortString(),
  gender: z.enum(GENDER_CODES),
  aptitudes: z.looseObject({
    profile: listOf(shortString(), 100),
    chosen: z.record(z.string().max(200), shortString()),
    extra: listOf(shortString(), 100),
  }),
  eliteAdvances: listOf(shortString(), 100),
  psy: z.looseObject({
    rating: z.number().int().min(0).max(10),
    disciplines: listOf(shortString(), 100),
    powers: listOf(shortString(), 100),
  }),
  experienceLog: listOf(
    z.looseObject({
      id: idString(),
      kind: z.enum([
        'characteristic',
        'skill',
        'talent',
        'psychic-power',
        'psy-rating',
        'elite-advance',
        'other',
        'award',
      ]),
      ref: shortString(),
      cost: z.number().int().min(0).max(FIELD_LIMITS.experience),
      createdAt: z.string().max(64),
    }),
    1000,
  ),
  height: shortString(),
  weight: shortString(),
  age: shortString(),
  skinColor: shortString(),
  hairColor: shortString(),
  eyeColor: shortString(),
  experience: z.number().int().min(0).max(FIELD_LIMITS.experience),
  totalExpSpent: z.number().int().min(0).max(FIELD_LIMITS.experience),
  wounds: z
    .looseObject({
      // Тяжёлые ранения уводят вунды в минус до -max. Границы проверяются
      // вместе: `-max` зависит от `max`, поэтому одного `min()` мало.
      current: z.number().int().min(-FIELD_LIMITS.pool).max(FIELD_LIMITS.pool),
      max: z.number().int().min(0).max(FIELD_LIMITS.pool),
      notes: noteString().optional(),
    })
    .refine(
      (value) => value.current >= -value.max && value.current <= value.max,
      { message: 'Wounds must be between -max and max.' },
    ),
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

/**
 * Тип состояния. Известные значения объявляет редакция (`CONDITION_KINDS` в
 * секции), но незнакомое значение не отбрасываем: лист более новой версии
 * или другой редакции не должен терять записи при импорте. Подпись для
 * незнакомого типа — сам код.
 *
 * Схема — строка, а не `z.custom`: из неё строится JSON Schema для
 * `/api/docs`, а custom-тип в JSON Schema не представим.
 */
const conditionKindSchema = z
  .string()
  .min(1)
  .max(32) as unknown as z.ZodType<ConditionKind>;

export const conditionEntrySchema = z.looseObject({
  id: idString(),
  kind: conditionKindSchema,
  name: z.string().max(FIELD_LIMITS.name),
  severity: shortString().optional(),
  effect: noteString().optional(),
  notes: noteString().optional(),
  source: z.enum(['manual', 'divination', 'legacy']).optional(),
});

export const conditionsSchema = listOf(conditionEntrySchema, 500);
