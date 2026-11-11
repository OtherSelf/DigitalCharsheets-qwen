import type {
  CharacterBase,
  CombatResource,
  InventoryItem,
} from '../shared/types';

/**
 * ─── LANDMARK: DND5E TYPES ─────────────────────────────────────────────────
 * Типы листа D&D 5e. Перенесены из `src/lib/types.ts` без изменения формы:
 * на время перехода (`schemaVersion` 1) `gameSystem` остаётся обязательным,
 * а `systemId` добавляется миграцией v2 (📌 D4).
 *
 * Модуль D&D отвечает за схему, дефолты, форму, лист, словари, экспорт и
 * миграции; ядро работает через `src/games/registry.ts`.
 */

export interface AttunementItem {
  id: string;
  description: string;
  attuned: boolean;
  notes?: string;
}

export interface Spell {
  id: string;
  name: string;
  level: number;
  notes: string;
}

export interface DnDSavingThrow {
  name: string;
  proficient: boolean;
  value: number;
  manualModifier?: number;
  notes?: string;
}

export interface DnDSkill {
  name: string;
  label: string;
  proficient: boolean;
  expertise: boolean;
  value: number;
  manualModifier?: number;
  notes?: string;
}

export interface DnDAttack {
  id: string;
  name: string;
  ability: DnDAbility | 'none';
  useProficiencyBonus: boolean;
  damageDice: string;
  damageModifier: string;
  notes?: string;
}

export interface SpellcastingEntry {
  id: string;
  ability: DnDAbility | 'none';
  attackBonus: string;
  saveDC: number;
  notes?: string;
}

export interface DnDActionOrFeature {
  id: string;
  name: string;
  notes: string;
}

export interface DnDCompanion {
  id: string;
  name: string;
  type: string;
  size: string;
  armorClass: number;
  initiative: number;
  speed: string;
  proficiencyBonus: string;
  stats: {
    strength: number;
    dexterity: number;
    constitution: number;
    intelligence: number;
    wisdom: number;
    charisma: number;
  };
  skills: DnDSkill[];
  hitPoints: { current: number; max: number };
  actions: DnDActionOrFeature[];
  features: DnDActionOrFeature[];

  // Full NPC support
  savingThrows?: DnDSavingThrow[];
  hpTracking?: string;
  hitPointsNotes?: string;
  temporaryHitPoints?: number;
  hitDice?: string;
  hitDiceUsed?: Record<string, number>;
  deathSaves?: { successes: number; failures: number };
  exhaustion?: number;
  otherProficienciesAndLanguages?: string[];
  attacks?: DnDAttack[];
  combatResources?: CombatResource[];
  spellcastingAbility?: DnDAbility | 'none';
  spellAttackBonus?: string;
  spellSaveDifficulty?: number;
  spellcastingEntries?: SpellcastingEntry[];
  spells?: Spell[];
  spellSlots?: Record<number, { max: number; current: number }>;
  personalityTraits?: string[];
  ideals?: string[];
  bonds?: string[];
  flaws?: string[];
  featuresAndTraits?: string[];
  equipment?: InventoryItem[];
  attunementItems?: AttunementItem[];
  currency?: { cp: number; sp: number; gp: number; pp: number; ep: number };
  inventory?: InventoryItem[];
  age?: string;
  eyes?: string;
  skin?: string;
  height?: string;
  weight?: string;
  hair?: string;
  background?: string;
  race?: string;
  alignment?: string;
  backstory?: string;
  notes?: string;
  statNotes?: {
    strength?: string;
    dexterity?: string;
    constitution?: string;
    intelligence?: string;
    wisdom?: string;
    charisma?: string;
  };

  // Progression fields
  characterClass?: string;
  level?: number;
  experiencePoints?: number;
  isMulticlass?: boolean;
  multiclasses?: DnDMulticlass[];
  divineBoons?: string[];
  allowDivineBoonsBeforeLevel20?: boolean;

  // Visibility toggles
  showStats?: boolean;
  showCombat?: boolean;
  showAttacks?: boolean;
  showInventory?: boolean;
  showSpells?: boolean;
  showNarrative?: boolean;
  showInfo?: boolean;
  showProgression?: boolean;
  showDivineBoons?: boolean;
  showHitDice?: boolean;
}

export interface DnDMulticlass {
  class: string;
  level: number;
  isDisabled?: boolean; // Added to preserve progress when XP is lowered
}

export type DnDAbility =
  | 'strength'
  | 'dexterity'
  | 'constitution'
  | 'intelligence'
  | 'wisdom'
  | 'charisma';

export interface DnD5eCharacter extends CharacterBase {
  systemId?: 'dnd5e';
  gameSystem: 'Dungeons & Dragons';
  level: number;
  race: string;
  background: string;
  alignment: string;
  experiencePoints: number;
  isMulticlass?: boolean;
  multiclasses?: DnDMulticlass[];
  divineBoons?: string[];
  inspiration: string;
  allowInspirationHomeRule?: boolean;
  allowDivineBoonsBeforeLevel20?: boolean;
  customHouseRules?: { name: string; description: string }[];
  proficiencyBonus: number;
  age?: string;
  eyes?: string;
  skin?: string;
  height?: string;
  weight?: string;
  hair?: string;
  stats: {
    strength: number;
    dexterity: number;
    constitution: number;
    intelligence: number;
    wisdom: number;
    charisma: number;
  };
  statNotes?: {
    strength?: string;
    dexterity?: string;
    constitution?: string;
    intelligence?: string;
    wisdom?: string;
    charisma?: string;
  };
  savingThrows: DnDSavingThrow[];
  skills: DnDSkill[];
  armorClass: number;
  speed: number;
  hitPoints: {
    current: number;
    max: number;
  };
  hpTracking?: string;
  hitPointsNotes?: string;
  temporaryHitPoints: number;
  hitDice: string;
  hitDiceUsed?: Record<string, number>;
  deathSaves: {
    successes: number;
    failures: number;
  };
  exhaustion?: number;
  otherProficienciesAndLanguages: string[];
  attacks: DnDAttack[];
  combatResources?: CombatResource[];
  spellcastingAbility?: DnDAbility | 'none';
  spellAttackBonus?: string;
  spellSaveDifficulty?: number;
  spellcastingEntries?: SpellcastingEntry[];
  personalityTraits: string[];
  ideals: string[];
  bonds: string[];
  flaws: string[];
  featuresAndTraits: string[];
  equipment: InventoryItem[];
  attunementItems?: AttunementItem[];
  currency: {
    cp: number;
    sp: number;
    gp: number;
    pp: number;
    ep: number;
  };
  inventory: InventoryItem[];
  spells: Spell[];
  spellSlots?: Record<number, { max: number; current: number }>;
  companions?: DnDCompanion[];
}
