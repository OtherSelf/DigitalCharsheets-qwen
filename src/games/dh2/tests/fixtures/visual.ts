import type { DH2Character } from '../../types';

/**
 * Фикстура визуальных тестов Dark Heresy 2-й редакции.
 *
 * Данные «богатые», чтобы на снимках были видны не пустые карточки: навыки
 * с разными ступенями тренировки, таланты, снаряжение с дырами в доспехе,
 * инвентарь с количеством и весом, пользовательские ресурсы, журнал опыта,
 * критические эффекты, Безумие и Порча. Даты фиксированные — PNG не зависят
 * от дня запуска.
 *
 * Файл — часть плагина: global-setup находит его по пути
 * `src/games/<id>/tests/fixtures/visual.ts`, поэтому удаление папки игры
 * убирает и её фикстуру, не ломая визуальный хост.
 *
 * Кастомная тема dh2 (`plugin.json#ui.theme`) применяется к странице листа
 * автоматически: эталоны фиксируют именно её, а не «серый» вид хоста.
 */
export const dh2Character: Omit<DH2Character, 'id' | 'userId'> = {
  name: 'Interrogator Vane',
  characterClass: 'warrior',
  systemId: 'dh2',
  gameSystem: 'Dark Heresy',
  backstory:
    'A dedicate of the Ordo Hereticus, Vane spent a decade in the underhive of Hive Sibellus before the Inquisition pulled him out. He speaks for the Emperor quietly, and carries a chainsword for the conversations that end badly.',
  notes: 'Wears a respirator under the collar. Owes 200 Gelt to the cell.',
  questLog: [],
  homeWorld: 'hive-world',
  background: 'adeptus-arbites',
  role: 'warrior',
  aptitudes: {
    profile: [
      'perception',
      'offence',
      'ballistic-skill',
      'defence',
      'weapon-skill',
      'strength',
      'toughness',
    ],
    chosen: {},
    extra: [],
  },
  divination: 'd100-10',
  gender: 'male',
  eliteAdvances: ['psyker'],
  psy: {
    rating: 2,
    disciplines: ['Telepathy'],
    powers: ['Mind Link'],
  },
  startingChoices: {
    roleTalent: 'iron-jaw',
    skills: ['inquiry'],
    talents: [],
  },
  experienceLog: [
    {
      id: 'xl-1',
      kind: 'award',
      ref: 'Session 12 — the Saint of Ash',
      cost: 400,
      createdAt: '2026-02-03T18:00:00.000Z',
    },
    {
      id: 'xl-2',
      kind: 'characteristic',
      ref: 'perception +5',
      cost: 250,
      createdAt: '2026-02-10T18:00:00.000Z',
    },
    {
      id: 'xl-3',
      kind: 'skill',
      ref: 'Inquiry +10',
      cost: 300,
      createdAt: '2026-02-17T18:00:00.000Z',
    },
    {
      id: 'xl-4',
      kind: 'talent',
      ref: 'Total Recall',
      cost: 600,
      createdAt: '2026-02-24T18:00:00.000Z',
    },
  ],
  height: '180 cm',
  weight: '75 kg',
  age: '28',
  skinColor: 'Pale',
  hairColor: 'Black',
  eyeColor: 'Grey',
  experience: 7901,
  totalExpSpent: 7100,
  stats: {
    weaponSkill: 35,
    ballisticSkill: 30,
    strength: 35,
    toughness: 40,
    agility: 35,
    intelligence: 45,
    perception: 55,
    willpower: 42,
    fellowship: 35,
    influence: 30,
  },
  statUpgrades: {
    weaponSkill: [false, false, false, false, false],
    ballisticSkill: [false, false, false, false, false],
    strength: [false, false, false, false, false],
    toughness: [false, false, false, false, false],
    agility: [false, false, false, false, false],
    intelligence: [false, false, false, false, false],
    perception: [true, true, false, false, false],
    willpower: [false, false, false, false, false],
    fellowship: [false, false, false, false, false],
    influence: [true, false, false, false, false],
  },
  statNotes: {},
  wounds: {
    current: 12,
    max: 12,
  },
  fatePoints: {
    current: 2,
    max: 2,
  },
  insanityPoints: {
    total: 6,
    notes: 'The Saint of Ash',
  },
  corruptionPoints: {
    total: 3,
    notes: 'Dealing with a relic',
  },
  wealth: {
    throneGelt: 50,
    monthlyIncome: 10,
  },
  movement: {
    walkHalf: 2,
    walkFull: 4,
    charge: 8,
    run: 12,
  },
  equipment: {
    armor: {
      Head: {
        ap: 3,
        type: 'Flak',
        mods: '',
        quality: 'Common',
      },
      'Right arm': null,
      Body: {
        ap: 4,
        type: 'Flak',
        mods: 'Lined',
        quality: 'Good',
      },
      'Left arm': null,
      'Right leg': null,
      'Left leg': {
        ap: 2,
        type: 'Leather',
        mods: '',
        quality: 'Poor',
      },
    },
    weapons: {
      melee: [
        {
          id: 'm1',
          name: 'Chainsword',
          type: 'Melee',
          range: '-',
          penetration: '2',
          damage: '1d10+3 R',
          traits: 'Tearing',
          equipped: true,
        },
      ],
      ranged: [
        {
          id: 'r1',
          name: 'Lasgun',
          type: 'Basic',
          range: '100m',
          rof: 'S/3/-',
          damage: '1d10+3 E',
          clip: 60,
          clipSize: 60,
          reload: 'Full',
          traits: '',
          equipped: true,
        },
      ],
    },
  },
  inventory: [
    {
      id: 'inv-1',
      name: 'Laspistol power pack',
      status: 'default',
      notes: 'Spare',
      quantity: 3,
      weight: 0.1,
    },
    {
      id: 'inv-2',
      name: 'Flak vest',
      status: 'default',
      notes: '',
      quantity: 1,
      weight: 4,
    },
    {
      id: 'inv-3',
      name: 'Interrogation kit',
      status: 'default',
      notes: 'Ordo property',
      quantity: 1,
      weight: 2,
    },
    {
      id: 'inv-4',
      name: 'Respirator',
      status: 'default',
      notes: '',
      quantity: 1,
      weight: 0.5,
    },
    {
      id: 'inv-5',
      name: 'Throne gelt pouch',
      status: 'lost',
      notes: 'Left in the shuttle',
      quantity: 1,
      weight: 0.1,
    },
  ],
  skills: [
    {
      id: 'awareness',
      name: 'Awareness',
      notes: '',
      type: 'basic',
      training: {
        skilled: true,
        plus10: true,
        plus20: false,
        plus30: false,
      },
    },
    {
      id: 'inquiry',
      name: 'Inquiry',
      notes: 'Known for the underhive',
      type: 'basic',
      training: {
        skilled: true,
        plus10: true,
        plus20: true,
        plus30: false,
      },
    },
    {
      id: 'interrogation',
      name: 'Interrogation',
      notes: '',
      type: 'advanced',
      training: {
        skilled: true,
        plus10: true,
        plus20: false,
        plus30: false,
      },
    },
    {
      id: 'dodge',
      name: 'Dodge',
      notes: '',
      type: 'basic',
      training: {
        skilled: true,
        plus10: true,
        plus20: false,
        plus30: false,
      },
    },
    {
      id: 'stealth',
      name: 'Stealth',
      notes: '',
      type: 'basic',
      training: {
        skilled: true,
        plus10: false,
        plus20: false,
        plus30: false,
      },
    },
    {
      id: 'tech-use',
      name: 'Tech-Use',
      notes: '',
      type: 'advanced',
      training: {
        skilled: true,
        plus10: true,
        plus20: false,
        plus30: false,
      },
    },
    {
      id: 'psychic-discipline-telepathy',
      name: 'Psyniscience',
      notes: '',
      type: 'advanced',
      training: {
        skilled: true,
        plus10: true,
        plus20: false,
        plus30: false,
      },
    },
  ],
  talents: [
    {
      id: 'iron-jaw',
      name: 'Iron Jaw',
      notes: 'Role talent',
      description: 'Test Toughness to avoid Stunned.',
    },
    {
      id: 'total-recall',
      name: 'Total Recall',
      notes: '',
      description: 'Recall any detail seen or heard.',
    },
    {
      id: 'hatred-heretics',
      name: 'Hatred (Heretics)',
      notes: '',
      description: '+10 to attack rolls against heretics.',
    },
    {
      id: 'peer-underworld',
      name: 'Peer (Underworld)',
      notes: '',
      description: '+10 Socialise with the underhive.',
    },
    {
      id: 'psyker',
      name: 'Psyker',
      notes: 'Elite advance',
      description: 'Bound to the Scholastica Psykana.',
    },
  ],
  fatigue2nd: {
    current: 2,
  },
  criticalConditions: [
    {
      id: 'cc-1',
      name: 'Broken ribs',
      notes: '3 critical damage to the body',
    },
    {
      id: 'cc-2',
      name: 'Concussion',
      notes: 'Stunned for one round',
    },
  ],
  customResources: [
    {
      id: 'cr-1',
      description: 'Grenades',
      current: 2,
      max: 4,
      notes: 'Frag',
    },
    {
      id: 'cr-2',
      description: 'Stimm',
      current: 1,
      max: 3,
    },
  ],
};

export default dh2Character;
