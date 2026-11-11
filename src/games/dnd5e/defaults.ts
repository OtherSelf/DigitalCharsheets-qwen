import { CHARACTER_SCHEMA_VERSION } from '@/lib/character-version';

import { readNumber, readString, type DefaultsInput } from '../shared/defaults';
import type {
  DnD5eCharacter,
  DnDAbility,
  DnDSavingThrow,
  DnDSkill,
} from './types';

/**
 * ─── LANDMARK: DND5E DEFAULTS ──────────────────────────────────────────────
 * Фабрика персонажа D&D 5e. Раньше объект собирался прямо в
 * `dnd-character-form.tsx`; теперь он один и тот же для формы, тестов и
 * будущего импорта.
 *
 * Вход — «плоские» значения формы (атрибуты и опыт), как их присылает
 * react-hook-form; вложенные структуры (спасброски, навыки, слоты) собирает
 * фабрика.
 */

/** Черновик листа: `id` присваивает сервер при создании. */
export type DnD5eCharacterDraft = Omit<DnD5eCharacter, 'id'>;

export const DND_DEFAULT_SAVING_THROWS: DnDSavingThrow[] = [
  { name: 'Strength', proficient: false, value: 0 },
  { name: 'Dexterity', proficient: false, value: 0 },
  { name: 'Constitution', proficient: false, value: 0 },
  { name: 'Intelligence', proficient: false, value: 0 },
  { name: 'Wisdom', proficient: false, value: 0 },
  { name: 'Charisma', proficient: false, value: 0 },
];

const DND_SKILL_SEEDS = [
  { name: 'acrobatics', label: 'Acrobatics (Dex)' },
  { name: 'animalHandling', label: 'Animal Handling (Wis)' },
  { name: 'arcana', label: 'Arcana (Int)' },
  { name: 'athletics', label: 'Athletics (Str)' },
  { name: 'deception', label: 'Deception (Cha)' },
  { name: 'history', label: 'History (Int)' },
  { name: 'insight', label: 'Insight (Wis)' },
  { name: 'intimidation', label: 'Intimidation (Cha)' },
  { name: 'investigation', label: 'Investigation (Int)' },
  { name: 'medicine', label: 'Medicine (Wis)' },
  { name: 'nature', label: 'Nature (Int)' },
  { name: 'perception', label: 'Perception (Wis)' },
  { name: 'performance', label: 'Performance (Cha)' },
  { name: 'persuasion', label: 'Persuasion (Cha)' },
  { name: 'religion', label: 'Religion (Int)' },
  { name: 'sleightOfHand', label: 'Sleight of Hand (Dex)' },
  { name: 'stealth', label: 'Stealth (Dex)' },
  { name: 'survival', label: 'Survival (Wis)' },
] as const;

export const DND_DEFAULT_SKILLS: DnDSkill[] = DND_SKILL_SEEDS.map((skill) => ({
  ...skill,
  proficient: false,
  expertise: false,
  value: 0,
}));

/** Уровень по опыту — те же пороги, что в форме создания. */
export function calculateLevelFromExp(exp: number): number {
  if (exp >= 355000) return 20;
  if (exp >= 305000) return 19;
  if (exp >= 265000) return 18;
  if (exp >= 225000) return 17;
  if (exp >= 195000) return 16;
  if (exp >= 165000) return 15;
  if (exp >= 140000) return 14;
  if (exp >= 120000) return 13;
  if (exp >= 100000) return 12;
  if (exp >= 85000) return 11;
  if (exp >= 64000) return 10;
  if (exp >= 48000) return 9;
  if (exp >= 34000) return 8;
  if (exp >= 23000) return 7;
  if (exp >= 14000) return 6;
  if (exp >= 6500) return 5;
  if (exp >= 2700) return 4;
  if (exp >= 900) return 3;
  if (exp >= 300) return 2;
  return 1;
}

export function createDnd5eDefaults(
  input: DefaultsInput = {},
): DnD5eCharacterDraft {
  const experiencePoints = readNumber(input, 'experiencePoints', 0);
  const level = readNumber(
    input,
    'level',
    calculateLevelFromExp(experiencePoints),
  );
  const proficiencyBonus = Math.floor((level - 1) / 4) + 2;
  const constitution = readNumber(input, 'constitution', 10);
  const constitutionModifier = Math.floor((constitution - 10) / 2);
  const maxHitPoints = readNumber(
    input,
    'max',
    Math.max(1, 8 + constitutionModifier),
  );
  const spellcastingAbility = readString(
    input,
    'spellcastingAbility',
    'none',
  ) as DnDAbility | 'none';
  const spellAttackBonus = readString(input, 'spellAttackBonus', '');
  const spellSaveDifficulty = readNumber(input, 'spellSaveDifficulty', 8);

  return {
    name: readString(input, 'name', ''),
    characterClass: readString(input, 'characterClass', ''),
    race: readString(input, 'race', 'Human'),
    background: readString(input, 'background', 'Acolyte'),
    alignment: readString(input, 'alignment', '') || 'Neutral',
    schemaVersion: CHARACTER_SCHEMA_VERSION,
    systemId: 'dnd5e',
    gameSystem: 'Dungeons & Dragons',
    experiencePoints,
    age: readString(input, 'age', ''),
    eyes: readString(input, 'eyes', ''),
    skin: readString(input, 'skin', ''),
    height: readString(input, 'height', ''),
    weight: readString(input, 'weight', ''),
    hair: readString(input, 'hair', ''),
    inspiration: '',
    proficiencyBonus,
    level,
    backstory: readString(input, 'backstory', ''),
    notes: '',
    questLog: [],
    divineBoons: [],
    stats: {
      strength: readNumber(input, 'strength', 10),
      dexterity: readNumber(input, 'dexterity', 10),
      constitution,
      intelligence: readNumber(input, 'intelligence', 10),
      wisdom: readNumber(input, 'wisdom', 10),
      charisma: readNumber(input, 'charisma', 10),
    },
    savingThrows: DND_DEFAULT_SAVING_THROWS.map((save) => ({ ...save })),
    skills: DND_DEFAULT_SKILLS.map((skill) => ({ ...skill })),
    armorClass: readNumber(input, 'armorClass', 10),
    speed: readNumber(input, 'speed', 30),
    hitPoints: { current: maxHitPoints, max: maxHitPoints },
    temporaryHitPoints: 0,
    hitDice: `${level}d8`,
    deathSaves: { successes: 0, failures: 0 },
    exhaustion: 0,
    otherProficienciesAndLanguages: [],
    attacks: [],
    spellcastingAbility,
    spellAttackBonus,
    spellSaveDifficulty,
    spellcastingEntries: [
      {
        id: 'primary',
        ability: spellcastingAbility,
        attackBonus: spellAttackBonus,
        saveDC: spellSaveDifficulty,
      },
    ],
    personalityTraits: [],
    ideals: [],
    bonds: [],
    flaws: [],
    featuresAndTraits: [],
    equipment: [],
    attunementItems: [],
    currency: { cp: 0, sp: 0, ep: 0, gp: 150, pp: 5 },
    inventory: [],
    spells: [],
  };
}
