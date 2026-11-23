import { z } from 'zod';

import {
  FIELD_LIMITS,
  idString,
  listOf,
  noteString,
  shortString,
} from '../shared/limits';
import {
  combatResourceSchema,
  inventoryItemSchema,
  noteTabsSchema,
  questSchema,
} from '../shared/schemas';
import type { DnD5eCharacter } from './types';

/**
 * ─── LANDMARK: DND5E CHARACTER SCHEMA ──────────────────────────────────────
 * Полная zod-схема листа D&D 5e. Аннотация `ZodType<DnD5eCharacter>`
 * заставляет TypeScript сверять схему с типом: если поле разъедется,
 * `tsc --noEmit` упадёт на этом файле, а не в рантайме импорта.
 */

const abilitySchema = z.enum([
  'strength',
  'dexterity',
  'constitution',
  'intelligence',
  'wisdom',
  'charisma',
]);

/**
 * Характеристика 5e: 1–30 (эпические дары упираются в 30). Раньше диапазона не
 * было, и `stats.strength: 999` сохранялось в файл.
 */
const abilityScoreSchema = z.number().int().min(1).max(30);

const statBlockSchema = z.looseObject({
  strength: abilityScoreSchema,
  dexterity: abilityScoreSchema,
  constitution: abilityScoreSchema,
  intelligence: abilityScoreSchema,
  wisdom: abilityScoreSchema,
  charisma: abilityScoreSchema,
});

const statNotesSchema = z.looseObject({
  strength: noteString().optional(),
  dexterity: noteString().optional(),
  constitution: noteString().optional(),
  intelligence: noteString().optional(),
  wisdom: noteString().optional(),
  charisma: noteString().optional(),
});

const attunementItemSchema = z.looseObject({
  id: idString(),
  description: z.string().max(FIELD_LIMITS.name),
  attuned: z.boolean(),
  notes: noteString().optional(),
});

const spellSchema = z.looseObject({
  id: idString(),
  name: z.string().max(FIELD_LIMITS.name),
  level: z.number().int().min(0).max(9),
  notes: noteString(),
});

const savingThrowSchema = z.looseObject({
  name: shortString(),
  proficient: z.boolean(),
  value: z.number().int().min(-100).max(100),
  manualModifier: z.number().int().min(-100).max(100).optional(),
  notes: noteString().optional(),
});

const skillSchema = z.looseObject({
  name: shortString(),
  label: shortString(),
  proficient: z.boolean(),
  expertise: z.boolean(),
  value: z.number().int().min(-100).max(100),
  manualModifier: z.number().int().min(-100).max(100).optional(),
  notes: noteString().optional(),
});

const attackSchema = z.looseObject({
  id: idString(),
  name: z.string().max(FIELD_LIMITS.name),
  ability: z.union([abilitySchema, z.literal('none')]),
  useProficiencyBonus: z.boolean(),
  damageDice: shortString(),
  damageModifier: shortString(),
  notes: noteString().optional(),
});

const spellcastingEntrySchema = z.looseObject({
  id: idString(),
  ability: z.union([abilitySchema, z.literal('none')]),
  attackBonus: shortString(),
  saveDC: z.number().int().min(0).max(100),
  notes: noteString().optional(),
});

const actionOrFeatureSchema = z.looseObject({
  id: idString(),
  name: z.string().max(FIELD_LIMITS.name),
  notes: noteString(),
});

const multiclassSchema = z.looseObject({
  class: shortString(),
  level: z.number().int().min(1).max(20),
  isDisabled: z.boolean().optional(),
});

const companionSchema = z.looseObject({
  id: idString(),
  name: z.string().max(FIELD_LIMITS.name),
  type: shortString(),
  size: shortString(),
  armorClass: z.number().int().min(0).max(100),
  initiative: z.number().int().min(-100).max(100),
  speed: shortString(),
  proficiencyBonus: shortString(),
  stats: statBlockSchema,
  skills: listOf(skillSchema, 100),
  hitPoints: z.object({
    current: z.number().int().min(-FIELD_LIMITS.pool).max(FIELD_LIMITS.pool),
    max: z.number().int().min(0).max(FIELD_LIMITS.pool),
  }),
  actions: listOf(actionOrFeatureSchema, 200),
  features: listOf(actionOrFeatureSchema, 200),
  savingThrows: listOf(savingThrowSchema, 20).optional(),
  hpTracking: shortString().optional(),
  hitPointsNotes: noteString().optional(),
  temporaryHitPoints: z.number().int().min(0).max(FIELD_LIMITS.pool).optional(),
  hitDice: shortString().optional(),
  hitDiceUsed: z
    .record(z.string().max(20), z.number().int().min(0).max(20))
    .optional(),
  deathSaves: z
    .object({
      successes: z.number().int().min(0).max(3),
      failures: z.number().int().min(0).max(3),
    })
    .optional(),
  exhaustion: z.number().int().min(0).max(6).optional(),
  otherProficienciesAndLanguages: listOf(noteString(), 100).optional(),
  attacks: listOf(attackSchema, 200).optional(),
  combatResources: listOf(combatResourceSchema, 100).optional(),
  spellcastingAbility: z.union([abilitySchema, z.literal('none')]).optional(),
  spellAttackBonus: shortString().optional(),
  spellSaveDifficulty: z.number().int().min(0).max(100).optional(),
  spellcastingEntries: listOf(spellcastingEntrySchema, 20).optional(),
  spells: listOf(spellSchema, 500).optional(),
  spellSlots: z
    .record(
      z.string().max(20),
      z.object({
        max: z.number().int().min(0).max(99),
        current: z.number().int().min(0).max(99),
      }),
    )
    .optional(),
  personalityTraits: listOf(noteString(), 100).optional(),
  ideals: listOf(noteString(), 100).optional(),
  bonds: listOf(noteString(), 100).optional(),
  flaws: listOf(noteString(), 100).optional(),
  featuresAndTraits: listOf(noteString(), 200).optional(),
  equipment: listOf(inventoryItemSchema, 500).optional(),
  attunementItems: listOf(attunementItemSchema, 100).optional(),
  currency: z
    .object({
      cp: z.number().int().min(0).max(FIELD_LIMITS.money),
      sp: z.number().int().min(0).max(FIELD_LIMITS.money),
      gp: z.number().int().min(0).max(FIELD_LIMITS.money),
      pp: z.number().int().min(0).max(FIELD_LIMITS.money),
      ep: z.number().int().min(0).max(FIELD_LIMITS.money),
    })
    .optional(),
  inventory: listOf(inventoryItemSchema, 500).optional(),
  age: shortString().optional(),
  eyes: shortString().optional(),
  skin: shortString().optional(),
  height: shortString().optional(),
  weight: shortString().optional(),
  hair: shortString().optional(),
  background: shortString().optional(),
  race: shortString().optional(),
  alignment: shortString().optional(),
  backstory: z.string().max(FIELD_LIMITS.long).optional(),
  notes: z.string().max(FIELD_LIMITS.long).optional(),
  statNotes: statNotesSchema.optional(),
  characterClass: shortString().optional(),
  level: z.number().int().min(1).max(20).optional(),
  experiencePoints: z
    .number()
    .int()
    .min(0)
    .max(FIELD_LIMITS.experience)
    .optional(),
  isMulticlass: z.boolean().optional(),
  multiclasses: listOf(multiclassSchema, 20).optional(),
  divineBoons: listOf(shortString(), 100).optional(),
  allowDivineBoonsBeforeLevel20: z.boolean().optional(),
  showStats: z.boolean().optional(),
  showCombat: z.boolean().optional(),
  showAttacks: z.boolean().optional(),
  showInventory: z.boolean().optional(),
  showSpells: z.boolean().optional(),
  showNarrative: z.boolean().optional(),
  showInfo: z.boolean().optional(),
  showProgression: z.boolean().optional(),
  showDivineBoons: z.boolean().optional(),
  showHitDice: z.boolean().optional(),
});

export const dnd5eCharacterSchema: z.ZodType<DnD5eCharacter> = z.looseObject({
  id: idString(),
  name: z.string().max(FIELD_LIMITS.name),
  characterClass: shortString(),
  gameSystem: z.literal('Dungeons & Dragons'),
  systemId: z.literal('dnd5e').optional(),
  backstory: z.string().max(FIELD_LIMITS.long),
  notes: z.string().max(FIELD_LIMITS.long),
  noteTabs: noteTabsSchema.optional(),
  questLog: listOf(questSchema),
  schemaVersion: z.number().int().optional(),
  /** Уровень 5e: 1–20, выше в правилах не бывает. */
  level: z.number().int().min(1).max(20),
  race: shortString(),
  background: shortString(),
  alignment: shortString(),
  experiencePoints: z.number().int().min(0).max(FIELD_LIMITS.experience),
  isMulticlass: z.boolean().optional(),
  multiclasses: listOf(multiclassSchema, 20).optional(),
  divineBoons: listOf(shortString(), 100).optional(),
  inspiration: shortString(),
  allowInspirationHomeRule: z.boolean().optional(),
  allowDivineBoonsBeforeLevel20: z.boolean().optional(),
  customHouseRules: listOf(
    z.object({
      name: z.string().max(FIELD_LIMITS.name),
      description: z.string().max(FIELD_LIMITS.note),
    }),
    100,
  ).optional(),
  proficiencyBonus: z.number().int().min(0).max(20),
  age: shortString().optional(),
  eyes: shortString().optional(),
  skin: shortString().optional(),
  height: shortString().optional(),
  weight: shortString().optional(),
  hair: shortString().optional(),
  stats: statBlockSchema,
  statNotes: statNotesSchema.optional(),
  savingThrows: listOf(savingThrowSchema, 20),
  skills: listOf(skillSchema, 100),
  armorClass: z.number().int().min(0).max(100),
  speed: z.number().int().min(0).max(1000),
  hitPoints: z.object({
    current: z.number().int().min(-FIELD_LIMITS.pool).max(FIELD_LIMITS.pool),
    max: z.number().int().min(0).max(FIELD_LIMITS.pool),
  }),
  hpTracking: shortString().optional(),
  hitPointsNotes: noteString().optional(),
  temporaryHitPoints: z.number().int().min(0).max(FIELD_LIMITS.pool),
  hitDice: shortString(),
  hitDiceUsed: z
    .record(z.string().max(20), z.number().int().min(0).max(20))
    .optional(),
  deathSaves: z.object({
    successes: z.number().int().min(0).max(3),
    failures: z.number().int().min(0).max(3),
  }),
  exhaustion: z.number().int().min(0).max(6).optional(),
  otherProficienciesAndLanguages: listOf(noteString(), 100),
  attacks: listOf(attackSchema, 200),
  combatResources: listOf(combatResourceSchema, 100).optional(),
  spellcastingAbility: z.union([abilitySchema, z.literal('none')]).optional(),
  spellAttackBonus: shortString().optional(),
  spellSaveDifficulty: z.number().int().min(0).max(100).optional(),
  spellcastingEntries: listOf(spellcastingEntrySchema, 20).optional(),
  personalityTraits: listOf(noteString(), 100),
  ideals: listOf(noteString(), 100),
  bonds: listOf(noteString(), 100),
  flaws: listOf(noteString(), 100),
  featuresAndTraits: listOf(noteString(), 200),
  equipment: listOf(inventoryItemSchema, 500),
  attunementItems: listOf(attunementItemSchema, 100).optional(),
  currency: z.object({
    cp: z.number().int().min(0).max(FIELD_LIMITS.money),
    sp: z.number().int().min(0).max(FIELD_LIMITS.money),
    gp: z.number().int().min(0).max(FIELD_LIMITS.money),
    pp: z.number().int().min(0).max(FIELD_LIMITS.money),
    ep: z.number().int().min(0).max(FIELD_LIMITS.money),
  }),
  inventory: listOf(inventoryItemSchema, 500),
  spells: listOf(spellSchema, 500),
  spellSlots: z
    .record(
      z.string().max(20),
      z.object({
        max: z.number().int().min(0).max(99),
        current: z.number().int().min(0).max(99),
      }),
    )
    .optional(),
  companions: listOf(companionSchema, 50).optional(),
});
