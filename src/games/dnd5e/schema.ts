import { z } from 'zod';

import {
  combatResourceSchema,
  inventoryItemSchema,
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
  strength: z.string().optional(),
  dexterity: z.string().optional(),
  constitution: z.string().optional(),
  intelligence: z.string().optional(),
  wisdom: z.string().optional(),
  charisma: z.string().optional(),
});

const attunementItemSchema = z.looseObject({
  id: z.string(),
  description: z.string(),
  attuned: z.boolean(),
  notes: z.string().optional(),
});

const spellSchema = z.looseObject({
  id: z.string(),
  name: z.string(),
  level: z.number(),
  notes: z.string(),
});

const savingThrowSchema = z.looseObject({
  name: z.string(),
  proficient: z.boolean(),
  value: z.number(),
  manualModifier: z.number().optional(),
  notes: z.string().optional(),
});

const skillSchema = z.looseObject({
  name: z.string(),
  label: z.string(),
  proficient: z.boolean(),
  expertise: z.boolean(),
  value: z.number(),
  manualModifier: z.number().optional(),
  notes: z.string().optional(),
});

const attackSchema = z.looseObject({
  id: z.string(),
  name: z.string(),
  ability: z.union([abilitySchema, z.literal('none')]),
  useProficiencyBonus: z.boolean(),
  damageDice: z.string(),
  damageModifier: z.string(),
  notes: z.string().optional(),
});

const spellcastingEntrySchema = z.looseObject({
  id: z.string(),
  ability: z.union([abilitySchema, z.literal('none')]),
  attackBonus: z.string(),
  saveDC: z.number(),
  notes: z.string().optional(),
});

const actionOrFeatureSchema = z.looseObject({
  id: z.string(),
  name: z.string(),
  notes: z.string(),
});

const multiclassSchema = z.looseObject({
  class: z.string(),
  level: z.number(),
  isDisabled: z.boolean().optional(),
});

const companionSchema = z.looseObject({
  id: z.string(),
  name: z.string(),
  type: z.string(),
  size: z.string(),
  armorClass: z.number(),
  initiative: z.number(),
  speed: z.string(),
  proficiencyBonus: z.string(),
  stats: statBlockSchema,
  skills: z.array(skillSchema),
  hitPoints: z.object({ current: z.number(), max: z.number() }),
  actions: z.array(actionOrFeatureSchema),
  features: z.array(actionOrFeatureSchema),
  savingThrows: z.array(savingThrowSchema).optional(),
  hpTracking: z.string().optional(),
  hitPointsNotes: z.string().optional(),
  temporaryHitPoints: z.number().optional(),
  hitDice: z.string().optional(),
  hitDiceUsed: z.record(z.string(), z.number()).optional(),
  deathSaves: z
    .object({ successes: z.number(), failures: z.number() })
    .optional(),
  exhaustion: z.number().optional(),
  otherProficienciesAndLanguages: z.array(z.string()).optional(),
  attacks: z.array(attackSchema).optional(),
  combatResources: z.array(combatResourceSchema).optional(),
  spellcastingAbility: z.union([abilitySchema, z.literal('none')]).optional(),
  spellAttackBonus: z.string().optional(),
  spellSaveDifficulty: z.number().optional(),
  spellcastingEntries: z.array(spellcastingEntrySchema).optional(),
  spells: z.array(spellSchema).optional(),
  spellSlots: z
    .record(z.string(), z.object({ max: z.number(), current: z.number() }))
    .optional(),
  personalityTraits: z.array(z.string()).optional(),
  ideals: z.array(z.string()).optional(),
  bonds: z.array(z.string()).optional(),
  flaws: z.array(z.string()).optional(),
  featuresAndTraits: z.array(z.string()).optional(),
  equipment: z.array(inventoryItemSchema).optional(),
  attunementItems: z.array(attunementItemSchema).optional(),
  currency: z
    .object({
      cp: z.number(),
      sp: z.number(),
      gp: z.number(),
      pp: z.number(),
      ep: z.number(),
    })
    .optional(),
  inventory: z.array(inventoryItemSchema).optional(),
  age: z.string().optional(),
  eyes: z.string().optional(),
  skin: z.string().optional(),
  height: z.string().optional(),
  weight: z.string().optional(),
  hair: z.string().optional(),
  background: z.string().optional(),
  race: z.string().optional(),
  alignment: z.string().optional(),
  backstory: z.string().optional(),
  notes: z.string().optional(),
  statNotes: statNotesSchema.optional(),
  characterClass: z.string().optional(),
  level: z.number().optional(),
  experiencePoints: z.number().optional(),
  isMulticlass: z.boolean().optional(),
  multiclasses: z.array(multiclassSchema).optional(),
  divineBoons: z.array(z.string()).optional(),
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
  id: z.string(),
  name: z.string(),
  characterClass: z.string(),
  gameSystem: z.literal('Dungeons & Dragons'),
  systemId: z.literal('dnd5e').optional(),
  backstory: z.string(),
  notes: z.string(),
  questLog: z.array(questSchema),
  schemaVersion: z.number().int().optional(),
  /** Уровень 5e: 1–20, выше в правилах не бывает. */
  level: z.number().int().min(1).max(20),
  race: z.string(),
  background: z.string(),
  alignment: z.string(),
  experiencePoints: z.number(),
  isMulticlass: z.boolean().optional(),
  multiclasses: z.array(multiclassSchema).optional(),
  divineBoons: z.array(z.string()).optional(),
  inspiration: z.string(),
  allowInspirationHomeRule: z.boolean().optional(),
  allowDivineBoonsBeforeLevel20: z.boolean().optional(),
  customHouseRules: z
    .array(z.object({ name: z.string(), description: z.string() }))
    .optional(),
  proficiencyBonus: z.number(),
  age: z.string().optional(),
  eyes: z.string().optional(),
  skin: z.string().optional(),
  height: z.string().optional(),
  weight: z.string().optional(),
  hair: z.string().optional(),
  stats: statBlockSchema,
  statNotes: statNotesSchema.optional(),
  savingThrows: z.array(savingThrowSchema),
  skills: z.array(skillSchema),
  armorClass: z.number(),
  speed: z.number(),
  hitPoints: z.object({ current: z.number(), max: z.number() }),
  hpTracking: z.string().optional(),
  hitPointsNotes: z.string().optional(),
  temporaryHitPoints: z.number(),
  hitDice: z.string(),
  hitDiceUsed: z.record(z.string(), z.number()).optional(),
  deathSaves: z.object({ successes: z.number(), failures: z.number() }),
  exhaustion: z.number().optional(),
  otherProficienciesAndLanguages: z.array(z.string()),
  attacks: z.array(attackSchema),
  combatResources: z.array(combatResourceSchema).optional(),
  spellcastingAbility: z.union([abilitySchema, z.literal('none')]).optional(),
  spellAttackBonus: z.string().optional(),
  spellSaveDifficulty: z.number().optional(),
  spellcastingEntries: z.array(spellcastingEntrySchema).optional(),
  personalityTraits: z.array(z.string()),
  ideals: z.array(z.string()),
  bonds: z.array(z.string()),
  flaws: z.array(z.string()),
  featuresAndTraits: z.array(z.string()),
  equipment: z.array(inventoryItemSchema),
  attunementItems: z.array(attunementItemSchema).optional(),
  currency: z.object({
    cp: z.number(),
    sp: z.number(),
    gp: z.number(),
    pp: z.number(),
    ep: z.number(),
  }),
  inventory: z.array(inventoryItemSchema),
  spells: z.array(spellSchema),
  spellSlots: z
    .record(z.string(), z.object({ max: z.number(), current: z.number() }))
    .optional(),
  companions: z.array(companionSchema).optional(),
});
