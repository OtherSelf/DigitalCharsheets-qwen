import type { DnD5eCharacterDraft } from './defaults';

/**
 * Демо-персонаж D&D 5e для гостевого лендинга `/demo`. Данные живут в модуле,
 * а не в компоненте: добавление новой редакции не требует правок демо-экрана.
 */
export function createDnd5eDemo(): DnD5eCharacterDraft {
  return {
    name: 'Thorin Ironforge',
    characterClass: 'Fighter',
    systemId: 'dnd5e',
    gameSystem: 'Dungeons & Dragons',
    backstory:
      'A seasoned warrior from the northern mountains, seeking glory and gold.',
    notes: 'Demo character for preview purposes.',
    questLog: [],
    level: 3,
    race: 'Dwarf',
    background: 'Soldier',
    alignment: 'Lawful Good',
    experiencePoints: 900,
    inspiration: '0',
    proficiencyBonus: 2,
    stats: {
      strength: 16,
      dexterity: 12,
      constitution: 15,
      intelligence: 10,
      wisdom: 13,
      charisma: 8,
    },
    savingThrows: [],
    skills: [],
    armorClass: 18,
    speed: 25,
    hitPoints: { current: 28, max: 28 },
    temporaryHitPoints: 0,
    hitDice: '3d10',
    deathSaves: { successes: 0, failures: 0 },
    otherProficienciesAndLanguages: ['Common', 'Dwarvish'],
    attacks: [],
    personalityTraits: ['I face problems head-on.'],
    ideals: [
      'Tradition. The ancient traditions of my people must be preserved.',
    ],
    bonds: ['I will bring glory to my clan.'],
    flaws: ['I am suspicious of strangers.'],
    featuresAndTraits: ['Darkvision', 'Dwarven Resilience'],
    equipment: [],
    currency: { cp: 0, sp: 0, gp: 15, pp: 0, ep: 0 },
    inventory: [],
    spells: [],
  };
}
