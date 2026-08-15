import { type Character } from './types';

const DND_DEFAULT_SAVING_THROWS = [
  { name: 'Strength', proficient: false, value: 0 },
  { name: 'Dexterity', proficient: false, value: 0 },
  { name: 'Constitution', proficient: false, value: 0 },
  { name: 'Intelligence', proficient: false, value: 0 },
  { name: 'Wisdom', proficient: false, value: 0 },
  { name: 'Charisma', proficient: false, value: 0 },
];

const DND_DEFAULT_SKILLS = [
  { name: 'acrobatics', label: 'Acrobatics (Dex)', proficient: false, expertise: false, value: 0 },
  { name: 'animalHandling', label: 'Animal Handling (Wis)', proficient: false, expertise: false, value: 0 },
  { name: 'arcana', label: 'Arcana (Int)', proficient: false, expertise: false, value: 0 },
  { name: 'athletics', label: 'Athletics (Str)', proficient: false, expertise: false, value: 0 },
  { name: 'deception', label: 'Deception (Cha)', proficient: false, expertise: false, value: 0 },
  { name: 'history', label: 'History (Int)', proficient: false, expertise: false, value: 0 },
  { name: 'insight', label: 'Insight (Wis)', proficient: false, expertise: false, value: 0 },
  { name: 'intimidation', label: 'Intimidation (Cha)', proficient: false, expertise: false, value: 0 },
  { name: 'investigation', label: 'Investigation (Int)', proficient: false, expertise: false, value: 0 },
  { name: 'medicine', label: 'Medicine (Wis)', proficient: false, expertise: false, value: 0 },
  { name: 'nature', label: 'Nature (Int)', proficient: false, expertise: false, value: 0 },
  { name: 'perception', label: 'Perception (Wis)', proficient: false, expertise: false, value: 0 },
  { name: 'performance', label: 'Performance (Cha)', proficient: false, expertise: false, value: 0 },
  { name: 'persuasion', label: 'Persuasion (Cha)', proficient: false, expertise: false, value: 0 },
  { name: 'religion', label: 'Religion (Int)', proficient: false, expertise: false, value: 0 },
  { name: 'sleightOfHand', label: 'Sleight of Hand (Dex)', proficient: false, expertise: false, value: 0 },
  { name: 'stealth', label: 'Stealth (Dex)', proficient: false, expertise: false, value: 0 },
  { name: 'survival', label: 'Survival (Wis)', proficient: false, expertise: false, value: 0 },
];

export const MOCK_CHARACTERS: Character[] = [
  {
    id: 'cleric-of-helm',
    name: 'Anya Thorne',
    level: 5,
    characterClass: 'Cleric',
    gameSystem: 'Dungeons & Dragons',
    race: 'Human',
    background: 'Acolyte',
    alignment: 'Lawful Good',
    experiencePoints: 6500,
    isMulticlass: false,
    multiclasses: [],
    divineBoons: [],
    inspiration: 'Yes',
    proficiencyBonus: 3,
    age: '28',
    eyes: 'Blue',
    skin: 'Fair',
    height: '1.7m',
    weight: '65kg',
    hair: 'Blonde',
    stats: {
      strength: 16,
      dexterity: 10,
      constitution: 14,
      intelligence: 12,
      wisdom: 18,
      charisma: 13,
    },
    savingThrows: DND_DEFAULT_SAVING_THROWS,
    skills: DND_DEFAULT_SKILLS,
    armorClass: 18,
    speed: 30,
    hitPoints: {
      current: 38,
      max: 38,
    },
    temporaryHitPoints: 0,
    hpTracking: 'Took 10 necrotic damage from the wraith.',
    hitDice: '5d8',
    deathSaves: {
      successes: 0,
      failures: 0,
    },
    exhaustion: 0,
    otherProficienciesAndLanguages: ['Common', 'Celestial', 'Herbalism Kit'],
    attacks: [
      { id: 'atk-1', name: 'Warhammer', atkBonus: '+6', damageType: '1d8+3 B' }
    ],
    spellAttackBonus: '+7',
    spellSaveDifficulty: 15,
    spellcastingAbility: 'wisdom',
    spellcastingEntries: [
      { id: 'primary', ability: 'wisdom', attackBonus: '+7', saveDC: 15 }
    ],
    combatResources: [
      { id: 'res-1', description: 'Channel Divinity', current: 1, max: 1 },
    ],
    personalityTraits: ['I am always calm, even in the face of disaster.', 'I am tolerant of other faiths.'],
    ideals: ['Charity. I always try to help those in need.'],
    bonds: ['I would die to recover an ancient holy relic.'],
    flaws: ['I am too trusting of those in positions of religious authority.'],
    featuresAndTraits: ['Disciple of Life', 'Turn Undead'],
    equipment: [
      { id: 'equip-1', name: 'Plate Armor', status: 'default', notes: 'AC 18' },
      { id: 'equip-2', name: 'Warhammer', status: 'default', notes: '1d8 bludgeoning' },
      { id: 'equip-3', name: 'Shield', status: 'default', notes: '+2 AC' },
    ],
    attunementItems: [
      { id: 'att-1', description: 'Holy Symbol of Helm', attuned: true },
    ],
    currency: { cp: 10, sp: 20, ep: 0, gp: 150, pp: 5 },
    inventory: [
      { id: 'item-3', name: 'Holy Symbol', status: 'lost', notes: 'Silver Anvil' },
      { id: 'item-4', name: "Healer's Kit", status: 'default', notes: '10 uses' },
    ],
    spells: [
        { id: 'spell-1', name: 'Guiding Bolt', notes: '120ft range, 4d6 radiant damage.', level: 1 },
        { id: 'spell-2', name: 'Bless', notes: 'Up to 3 creatures, +1d4 to attacks and saves.', level: 1 },
        { id: 'spell-3', name: 'Cure Wounds', notes: 'Touch, 1d8+WIS healing.', level: 1 },
        { id: 'spell-4', name: 'Spiritual Weapon', notes: 'Bonus action, 1d8+WIS force damage.', level: 2 },
        { id: 'spell-5', name: 'Spirit Guardians', notes: '15ft radius, difficult terrain, 3d8 radiant/necrotic damage.', level: 3 },
    ],
    notes: 'Remember to buy more rations in the next town. Also, investigate the strange rumors about the old mill.',
    questLog: [
      {
        id: 'quest-1',
        title: 'Find the Lost Mine of Phandelver',
        status: 'active',
        description: 'Gundren Rockseeker hired us to escort a wagon to Phandalin. He was ambushed by goblins. We need to find their hideout and rescue him.',
        createdAt: '2023-10-26T10:00:00Z',
        updatedAt: '2023-10-27T14:30:00Z',
      },
      {
        id: 'quest-2',
        title: 'Deliver the Wagon',
        status: 'completed',
        description: 'Successfully brought the wagon of supplies to Barthen\'s Provisions in Phandalin.',
        createdAt: '2023-10-25T09:00:00Z',
        updatedAt: '2023-10-26T11:00:00Z',
      }
    ],
    companions: []
  },
  {
    id: 'inquisitor-acolyte-jax',
    name: 'Jax Valerius',
    characterClass: 'Adept',
    gameSystem: 'Dark Heresy',
    homeWorld: 'Hive World',
    worldVariant: '',
    careerPath: 'Adept',
    rank: 'Scribe',
    divination: 'The wise man learns from the deaths of others.',
    divinationEffect: '+3 Intelligence.',
    quirk: 'Twitches and mutters to himself.',
    height: '1.8m',
    weight: '75kg',
    age: '24',
    skinColor: 'Pale',
    hairColor: 'Black',
    eyeColor: 'Grey',
    experience: 150,
    totalExpSpent: 850,
    alternatePath: null,
    advancedPath: null,
    stats: {
      weaponSkill: 35,
      ballisticSkill: 40,
      strength: 32,
      toughness: 38,
      agility: 45,
      intelligence: 45,
      perception: 42,
      willpower: 39,
      fellowship: 28,
      influence: 30,
    },
    statUpgrades: {
        weaponSkill: [true, false, false, false],
        ballisticSkill: [true, false, false, false],
        strength: [false, false, false, false],
        toughness: [true, false, false, false],
        agility: [true, false, false, false],
        intelligence: [true, true, false, false],
        perception: [false, false, false, false],
        willpower: [false, false, false, false],
        fellowship: [false, false, false, false],
        influence: [false, false, false, false],
    },
    statNotes: {
      intelligence: 'Divination bonus: +3',
    },
    wounds: { current: 12, max: 12 },
    fatePoints: { current: 2, max: 2 },
    insanityPoints: { total: 3, notes: '' },
    corruptionPoints: { total: 1, notes: '' },
    wealth: {
      throneGelt: 100,
      monthlyIncome: 50,
    },
    movement: {
      walkHalf: 4,
      walkFull: 8,
      charge: 12,
      run: 24,
    },
    backstory:
      'Born in the underhive of Scintilla, Jax was recruited into the Inquisition after his latent psyker abilities manifested during a gang war. He now serves a radical Inquisitor, his loyalty tested daily by the horrors he must confront.',
    equipment: {
      armor: {
        'Head': { ap: 2, type: 'Flak', mods: '-', quality: 'Common' },
        'Right arm': { ap: 4, type: 'Flak', mods: '-', quality: 'Common' },
        'Body': { ap: 4, type: 'Flak', mods: '-', quality: 'Common' },
        'Left arm': { ap: 4, type: 'Flak', mods: '-', quality: 'Common' },
        'Right leg': { ap: 2, type: 'Flak', mods: '-', quality: 'Common' },
        'Left leg': { ap: 2, type: 'Flak', mods: '-', quality: 'Common' },
      },
      weapons: {
          melee: [
              { id: 'w-melee-1', name: 'Knife', type: 'Low-Tech', range: '-', penetration: '0', damage: '1d5 R', traits: 'Primitive', notes: '' }
          ],
          ranged: [
              { id: 'w-ranged-1', name: 'Laspistol', type: 'Las', range: '30m', rof: 'S/2/-', damage: '1d10+2 E', clip: 30, clipSize: 30, reload: 'Half', traits: 'Reliable', notes: '' }
          ]
      }
    },
    inventory: [
      { id: 'item-8', name: 'Data-slate', status: 'lost', notes: 'Cracked screen' },
    ],
    skills: [
        {id: 'skill-1', name: 'Awareness', notes: 'Standard perception checks.', type: 'basic', training: { skilled: true, plus10: false, plus20: false }},
        {id: 'skill-2', name: 'Common Lore (Imperium)', notes: '', type: 'basic', training: { skilled: true, plus10: false, plus20: false }},
        {id: 'skill-3', name: 'Forbidden Lore (Psykers)', notes: 'Knowledge of the warp and its dangers.', type: 'advanced', training: { skilled: false, plus10: false, plus20: false }},
        {id: 'skill-4', name: 'Inquiry', notes: 'Gathering information and interrogating subjects.', type: 'basic', training: { skilled: true, plus10: false, plus20: false }}
    ],
    talents: [
        { id: 'talent-1', name: 'Melee Weapon Training (Primitive)', notes: '' },
        { id: 'talent-2', name: 'Pistol Weapon Training (Las)', notes: '' },
        { id: 'talent-3', name: 'Basic Weapon Training (SP)', notes: '' },
    ],
    notes: 'Inquisitor\'s last known whereabouts: Port Wrath. Need to cross-reference the stellar charts with the decoded astropathic message. Suspect the informant, "Silas," is a double agent.',
    questLog: [
      {
        id: 'quest-dh-1',
        title: 'Investigate the Heretek Cult',
        status: 'active',
        description: 'A cult known as the "Cog-blighted" is operating in the lower manufactorum levels. Infiltrate and identify their leader. Do not engage unless necessary.',
        createdAt: '2024-01-15T18:00:00Z',
        updatedAt: '2024-01-18T11:20:00Z',
      }
    ]
  },
  {
    id: 'elf-rogue-lyra',
    name: 'Lyra Meadowlight',
    level: 5,
    characterClass: 'Rogue',
    gameSystem: 'Dungeons & Dragons',
    race: 'Elf',
    background: 'Criminal',
    alignment: 'Chaotic Neutral',
    experiencePoints: 6500,
    isMulticlass: false,
    multiclasses: [],
    divineBoons: [],
    inspiration: '',
    proficiencyBonus: 3,
    age: '112',
    eyes: 'Green',
    skin: 'Fair',
    height: '1.6m',
    weight: '50kg',
    hair: 'Silver',
    stats: {
      strength: 11,
      dexterity: 20,
      constitution: 12,
      intelligence: 14,
      wisdom: 13,
      charisma: 16,
    },
    savingThrows: DND_DEFAULT_SAVING_THROWS,
    skills: DND_DEFAULT_SKILLS,
    armorClass: 16,
    speed: 30,
    hitPoints: {
      current: 31,
      max: 31,
    },
    temporaryHitPoints: 0,
    hitDice: '5d8',
    deathSaves: {
      successes: 0,
      failures: 0,
    },
    exhaustion: 0,
    otherProficienciesAndLanguages: ['Common', 'Elvish', "Thieves' Tools"],
    attacks: [
      { id: 'atk-2', name: 'Rapier', atkBonus: '+7', damageType: '1d8+5 P' }
    ],
    spellAttackBonus: '',
    spellSaveDifficulty: 8,
    spellcastingAbility: 'none',
    spellcastingEntries: [
      { id: 'primary', ability: 'none', attackBonus: '', saveDC: 8 }
    ],
    combatResources: [
      { id: 'res-2', description: 'Sneak Attack', current: 1, max: 1 },
    ],
    personalityTraits: [],
    ideals: [],
    bonds: [],
    flaws: [],
    featuresAndTraits: ['Sneak Attack', 'Cunning Action'],
    backstory:
      "Lyra grew up in a quiet elven village, but found its pace too slow for her tastes. She left for the bustling cities of humans, where her quick fingers and quicker wit have earned her a reputation as a master thief and information broker. She has a soft spot for sweet rolls and a strong dislike for authority.",
    equipment: [
      { id: 'equip-9', name: 'Studded Leather', status: 'default', notes: '' },
      { id: 'equip-10', name: 'Rapier', status: 'default', notes: '' },
      { id: 'equip-11', name: 'Shortbow', status: 'default', notes: '' },
    ],
    attunementItems: [],
    currency: { cp: 50, sp: 10, gp: 25, pp: 0, ep: 0 },
    inventory: [
      { id: 'item-12', name: "Thieves' Tools", status: 'default', notes: '' },
    ],
    spells: [],
    notes: 'The contact in the Shadow Thieves guild is named "Silas". He meets at the "Salty Siren" tavern at midnight. Password is "moonstone".',
    questLog: [],
    companions: []
  },
];
