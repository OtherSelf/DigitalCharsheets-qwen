'use client';
export type GameSystem = 'Dungeons & Dragons' | 'Dark Heresy';

export const DarkHeresyHomeWorlds = ["Feral World", "Hive World", "Imperial World", "Void Born"] as const;
export type DarkHeresyHomeWorld = typeof DarkHeresyHomeWorlds[number];
export const DarkHeresyCareerPaths = ["Adept", "Arbitrator", "Assassin", "Cleric", "Guardsman", "Imperial Psyker", "Scum", "Tech-Priest"] as const;
export type DarkHeresyCareerPath = typeof DarkHeresyCareerPaths[number];

export interface InventoryItem {
  id: string;
  name: string;
  status: 'default' | 'lost';
  notes?: string;
}

export interface AttunementItem {
  id: string;
  description: string;
  attuned: boolean;
  notes?: string;
}

export interface CombatResource {
  id: string;
  description: string;
  current: number;
  max: number;
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
  notes?: string;
}

export interface DnDSkill {
  name: string;
  label: string;
  proficient: boolean;
  expertise: boolean;
  value: number;
  notes?: string;
}

export interface Skill {
  id:string;
  name: string;
  notes: string;
  type: 'basic' | 'advanced';
  training: {
    skilled: boolean;
    plus10: boolean;
    plus20: boolean;
  };
}

export interface Talent {
    id: string;
    name: string;
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
  hitPoints: {
    current: number;
    max: number;
  };
  actions: DnDActionOrFeature[];
  features: DnDActionOrFeature[];
}

export interface ArmorPiece {
  ap: number;
  type: string;
  mods: string;
  quality: string;
}

export type BodyPart = 'Head' | 'Right arm' | 'Body' | 'Left arm' | 'Right leg' | 'Left leg';

export type Armor = Record<BodyPart, ArmorPiece | null>;

export interface MeleeWeapon {
  id: string;
  name: string;
  type: string;
  range: string;
  penetration: string;
  damage: string;
  traits: string;
  equipped?: boolean;
  notes?: string;
}

export interface RangedWeapon {
  id: string;
  name: string;
  type: string;
  range: string;
  rof: string;
  damage: string;
  clip: number;
  clipSize: number;
  reload: string;
  traits: string;
  equipped?: boolean;
  notes?: string;
}

export interface DarkHeresyWeapons {
    melee: MeleeWeapon[];
    ranged: RangedWeapon[];
}

export interface DarkHeresyEquipment {
    armor: Armor;
    weapons: DarkHeresyWeapons;
}

export interface QuestObjective {
  id: string;
  text: string;
  completed: boolean;
}

export interface Quest {
  id: string;
  title: string;
  status: 'active' | 'completed';
  description: string;
  createdAt: string;
  updatedAt: string;
  // New UX fields (optional for backward compatibility)
  priority?: 'main' | 'side' | 'personal';
  notes?: string;
  rewards?: string;
  npcs?: string;
  locations?: string;
  objectives?: QuestObjective[];
}

export interface CharacterBase {
  id: string;
  name: string;
  characterClass: string;
  gameSystem: GameSystem;
  backstory: string;
  notes: string;
  questLog: Quest[];
}

export interface DnDMulticlass {
  class: string;
  level: number;
}

export type DnDAbility = 'strength' | 'dexterity' | 'constitution' | 'intelligence' | 'wisdom' | 'charisma';

export interface DnD5eCharacter extends CharacterBase {
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

export interface DarkHeresyCharacter extends CharacterBase {
  gameSystem: 'Dark Heresy';
  homeWorld: DarkHeresyHomeWorld | '';
  worldVariant: string;
  careerPath: DarkHeresyCareerPath | '';
  rank: string;
  divination: string;
  divinationEffect: string;
  quirk: string;
  height: string;
  weight: string;
  age: string;
  skinColor: string;
  hairColor: string;
  eyeColor: string;
  experience: number;
  totalExpSpent: number;
  alternatePath: string | null;
  advancedPath: string | null;
  stats: {
    weaponSkill: number;
    ballisticSkill: number;
    strength: number;
    toughness: number;
    agility: number;
    intelligence: number;
    perception: number;
    willpower: number;
    fellowship: number;
    influence: number;
  };
  statUpgrades: {
    weaponSkill: [boolean, boolean, boolean, boolean];
    ballisticSkill: [boolean, boolean, boolean, boolean];
    strength: [boolean, boolean, boolean, boolean];
    toughness: [boolean, boolean, boolean, boolean];
    agility: [boolean, boolean, boolean, boolean];
    intelligence: [boolean, boolean, boolean, boolean];
    perception: [boolean, boolean, boolean, boolean];
    willpower: [boolean, boolean, boolean, boolean];
    fellowship: [boolean, boolean, boolean, boolean];
    influence: [boolean, boolean, boolean, boolean];
  };
  statNotes?: {
    weaponSkill?: string;
    ballisticSkill?: string;
    strength?: string;
    toughness?: string;
    agility?: string;
    intelligence?: string;
    perception?: string;
    willpower?: string;
    fellowship?: string;
    influence?: string;
  };
  wounds: {
    current: number;
    max: number;
    notes?: string;
  };
  fatePoints: {
    current: number;
    max: number;
    notes?: string;
  };
  insanityPoints: {
    total: number;
    notes?: string;
  };
  corruptionPoints: {
    total: number;
    notes?: string;
  };
  wealth: {
    throneGelt: number;
    monthlyIncome: number;
  };
  movement: {
    walkHalf: number;
    walkFull: number;
    charge: number;
    run: number;
  };
  equipment: DarkHeresyEquipment;
  inventory: InventoryItem[];
  skills: Skill[];
  talents: Talent[];
}

export type Character = DnD5eCharacter | DarkHeresyCharacter;
