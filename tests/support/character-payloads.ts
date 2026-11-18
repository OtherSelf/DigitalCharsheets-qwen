/**
 * Payload'ы, которые реально собирают формы создания (create-form.tsx).
 *
 * Это данные теста, а не рантайм: значения совпадают с onSubmit каждой формы,
 * поэтому если форма перестанет класть системное поле (spells, fatePoints,
 * statUpgrades…), сквозные тесты это увидят.
 */

export type AnyCharacter = Record<string, any>;

// ─── payload'ы: точная копия того, что собирает onSubmit в формах ───────────

/** D&D 5e, 7 уровень: значения совпадают с DndCharacterForm.onSubmit(). */
export function dndPayload(overrides: AnyCharacter = {}): AnyCharacter {
  const level = 7;
  return {
    name: 'Seraphina Vael',
    characterClass: 'Wizard',
    race: 'High Elf',
    background: 'Sage',
    alignment: 'Neutral Good',
    experiencePoints: 23000,
    age: '146',
    eyes: 'Silver',
    skin: 'Pale',
    height: `5'7"`,
    weight: '128 lb',
    hair: 'Black',
    inspiration: '',
    proficiencyBonus: Math.floor((level - 1) / 4) + 2,
    level,
    gameSystem: 'Dungeons & Dragons',
    backstory: 'Archivist of the Emerald Spire.',
    notes: '',
    questLog: [],
    divineBoons: [],
    stats: {
      strength: 8,
      dexterity: 14,
      constitution: 12,
      intelligence: 18,
      wisdom: 13,
      charisma: 10,
    },
    savingThrows: [
      { name: 'Strength', proficient: false, value: -1 },
      { name: 'Dexterity', proficient: false, value: 2 },
      { name: 'Constitution', proficient: false, value: 1 },
      { name: 'Intelligence', proficient: true, value: 7 },
      { name: 'Wisdom', proficient: true, value: 4 },
      { name: 'Charisma', proficient: false, value: 0 },
    ],
    skills: [
      {
        name: 'arcana',
        label: 'Arcana (Int)',
        proficient: true,
        expertise: false,
        value: 7,
      },
      {
        name: 'history',
        label: 'History (Int)',
        proficient: true,
        expertise: false,
        value: 7,
      },
      {
        name: 'insight',
        label: 'Insight (Wis)',
        proficient: true,
        expertise: false,
        value: 4,
      },
      {
        name: 'perception',
        label: 'Perception (Wis)',
        proficient: false,
        expertise: false,
        value: 1,
      },
    ],
    armorClass: 15,
    speed: 30,
    hitPoints: { current: 45, max: 45 },
    temporaryHitPoints: 0,
    hitDice: `${level}d8`,
    deathSaves: { successes: 0, failures: 0 },
    exhaustion: 0,
    otherProficienciesAndLanguages: ['Common', 'Elvish'],
    attacks: [
      {
        id: 'atk-1',
        name: 'Fire Bolt',
        ability: 'intelligence',
        useProficiencyBonus: true,
        damageDice: '2d10',
        damageModifier: '0',
        notes: '',
      },
    ],
    spellcastingAbility: 'intelligence',
    spellAttackBonus: '+7',
    spellSaveDifficulty: 15,
    spellcastingEntries: [
      {
        id: 'primary',
        ability: 'intelligence',
        attackBonus: '+7',
        saveDC: 15,
        notes: '',
      },
    ],
    personalityTraits: ['I use polysyllabic words.'],
    ideals: ['Knowledge.'],
    bonds: ['My life is a series of tomes.'],
    flaws: ['I am easily distracted.'],
    featuresAndTraits: ['Arcane Recovery'],
    equipment: [
      { id: 'eq-1', name: 'Spellbook', status: 'default', notes: '' },
    ],
    attunementItems: [],
    currency: { cp: 0, sp: 0, ep: 0, gp: 150, pp: 5 },
    inventory: [
      { id: 'inv-1', name: 'Potion of Healing', status: 'default', notes: '2' },
    ],
    spells: [
      { id: 'spell-1', name: 'Fireball', level: 3, notes: '8d6 fire' },
      { id: 'spell-2', name: 'Shield', level: 1, notes: '+5 AC' },
    ],
    ...overrides,
  };
}
