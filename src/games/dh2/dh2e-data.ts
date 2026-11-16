/**
 * ─── AUTO-GENERATED — НЕ РЕДАКТИРОВАТЬ ─────────────────────────────────────
 * Данные 2-й редакции из контент-каталога workspace (content/dh2).
 * Пересобрать: npm run dh2e:data. Проверить дрейф: npm run dh2e:check.
 */

import type {
  Dh2eAptitude,
  Dh2eBackground,
  Dh2eCharacteristic,
  Dh2eDivination,
  Dh2eHomeWorld,
  Dh2eRole,
} from './dh2e-types';

export const DH2E_APTITUDES: readonly Dh2eAptitude[] = [
  {
    id: 'general',
    labelKey: 'dh2.catalog.aptitude.general',
    group: 'general',
  },
  {
    id: 'weapon-skill',
    labelKey: 'dh2.catalog.aptitude.weapon-skill',
    group: 'characteristic',
  },
  {
    id: 'ballistic-skill',
    labelKey: 'dh2.catalog.aptitude.ballistic-skill',
    group: 'characteristic',
  },
  {
    id: 'strength',
    labelKey: 'dh2.catalog.aptitude.strength',
    group: 'characteristic',
  },
  {
    id: 'toughness',
    labelKey: 'dh2.catalog.aptitude.toughness',
    group: 'characteristic',
  },
  {
    id: 'agility',
    labelKey: 'dh2.catalog.aptitude.agility',
    group: 'characteristic',
  },
  {
    id: 'intelligence',
    labelKey: 'dh2.catalog.aptitude.intelligence',
    group: 'characteristic',
  },
  {
    id: 'perception',
    labelKey: 'dh2.catalog.aptitude.perception',
    group: 'characteristic',
  },
  {
    id: 'willpower',
    labelKey: 'dh2.catalog.aptitude.willpower',
    group: 'characteristic',
  },
  {
    id: 'fellowship',
    labelKey: 'dh2.catalog.aptitude.fellowship',
    group: 'characteristic',
  },
  {
    id: 'offence',
    labelKey: 'dh2.catalog.aptitude.offence',
    group: 'other',
  },
  {
    id: 'finesse',
    labelKey: 'dh2.catalog.aptitude.finesse',
    group: 'other',
  },
  {
    id: 'defence',
    labelKey: 'dh2.catalog.aptitude.defence',
    group: 'other',
  },
  {
    id: 'psyker',
    labelKey: 'dh2.catalog.aptitude.psyker',
    group: 'other',
  },
  {
    id: 'tech',
    labelKey: 'dh2.catalog.aptitude.tech',
    group: 'other',
  },
  {
    id: 'knowledge',
    labelKey: 'dh2.catalog.aptitude.knowledge',
    group: 'other',
  },
  {
    id: 'leadership',
    labelKey: 'dh2.catalog.aptitude.leadership',
    group: 'other',
  },
  {
    id: 'fieldcraft',
    labelKey: 'dh2.catalog.aptitude.fieldcraft',
    group: 'other',
  },
  {
    id: 'social',
    labelKey: 'dh2.catalog.aptitude.social',
    group: 'other',
  },
];

export const DH2E_CHARACTERISTICS: readonly Dh2eCharacteristic[] = [
  {
    id: 'weaponSkill',
    labelKey: 'dh2.catalog.characteristic.weaponSkill',
    short: 'WS',
    purchasable: true,
    aptitudeIds: ['weapon-skill', 'offence'],
  },
  {
    id: 'ballisticSkill',
    labelKey: 'dh2.catalog.characteristic.ballisticSkill',
    short: 'BS',
    purchasable: true,
    aptitudeIds: ['ballistic-skill', 'finesse'],
  },
  {
    id: 'strength',
    labelKey: 'dh2.catalog.characteristic.strength',
    short: 'S',
    purchasable: true,
    aptitudeIds: ['strength', 'offence'],
  },
  {
    id: 'toughness',
    labelKey: 'dh2.catalog.characteristic.toughness',
    short: 'T',
    purchasable: true,
    aptitudeIds: ['toughness', 'defence'],
  },
  {
    id: 'agility',
    labelKey: 'dh2.catalog.characteristic.agility',
    short: 'Ag',
    purchasable: true,
    aptitudeIds: ['agility', 'finesse'],
  },
  {
    id: 'intelligence',
    labelKey: 'dh2.catalog.characteristic.intelligence',
    short: 'Int',
    purchasable: true,
    aptitudeIds: ['intelligence', 'knowledge'],
  },
  {
    id: 'perception',
    labelKey: 'dh2.catalog.characteristic.perception',
    short: 'Per',
    purchasable: true,
    aptitudeIds: ['perception', 'fieldcraft'],
  },
  {
    id: 'willpower',
    labelKey: 'dh2.catalog.characteristic.willpower',
    short: 'WP',
    purchasable: true,
    aptitudeIds: ['willpower', 'psyker'],
  },
  {
    id: 'fellowship',
    labelKey: 'dh2.catalog.characteristic.fellowship',
    short: 'Fel',
    purchasable: true,
    aptitudeIds: ['fellowship', 'social'],
  },
  {
    id: 'influence',
    labelKey: 'dh2.catalog.characteristic.influence',
    short: 'Inf',
    purchasable: false,
    aptitudeIds: [],
  },
];

export const DH2E_HOMEWORLDS: readonly Dh2eHomeWorld[] = [
  {
    id: 'feral-world',
    labelKey: 'dh2.catalog.world.feral-world',
    characteristicModifiers: {
      plus: ['strength', 'toughness'],
      minus: ['influence'],
    },
    fateThreshold: 2,
    emperorsBlessing: 3,
    wounds: '9+1d5',
    aptitudeId: 'toughness',
    bonusKey: 'dh2.catalog.world.feral-world.bonus',
    recommendedBackgroundIds: [
      'adeptus-arbites',
      'adeptus-astra-telepathica',
      'imperial-guard',
      'outcast',
    ],
  },
  {
    id: 'forge-world',
    labelKey: 'dh2.catalog.world.forge-world',
    characteristicModifiers: {
      plus: ['intelligence', 'toughness'],
      minus: ['fellowship'],
    },
    fateThreshold: 3,
    emperorsBlessing: 8,
    wounds: '8+1d5',
    aptitudeId: 'intelligence',
    bonusKey: 'dh2.catalog.world.forge-world.bonus',
    recommendedBackgroundIds: [
      'adeptus-administratum',
      'adeptus-arbites',
      'adeptus-mechanicus',
      'imperial-guard',
    ],
  },
  {
    id: 'highborn',
    labelKey: 'dh2.catalog.world.highborn',
    characteristicModifiers: {
      plus: ['fellowship', 'influence'],
      minus: ['toughness'],
    },
    fateThreshold: 4,
    emperorsBlessing: 10,
    wounds: '9+1d5',
    aptitudeId: 'fellowship',
    bonusKey: 'dh2.catalog.world.highborn.bonus',
    recommendedBackgroundIds: [
      'adeptus-administratum',
      'adeptus-arbites',
      'adeptus-astra-telepathica',
      'adeptus-ministorum',
    ],
  },
  {
    id: 'hive-world',
    labelKey: 'dh2.catalog.world.hive-world',
    characteristicModifiers: {
      plus: ['agility', 'perception'],
      minus: ['willpower'],
    },
    fateThreshold: 2,
    emperorsBlessing: 6,
    wounds: '8+1d5',
    aptitudeId: 'perception',
    bonusKey: 'dh2.catalog.world.hive-world.bonus',
    recommendedBackgroundIds: [
      'adeptus-arbites',
      'adeptus-mechanicus',
      'imperial-guard',
      'outcast',
    ],
  },
  {
    id: 'shrine-world',
    labelKey: 'dh2.catalog.world.shrine-world',
    characteristicModifiers: {
      plus: ['fellowship', 'willpower'],
      minus: ['perception'],
    },
    fateThreshold: 3,
    emperorsBlessing: 6,
    wounds: '7+1d5',
    aptitudeId: 'willpower',
    bonusKey: 'dh2.catalog.world.shrine-world.bonus',
    recommendedBackgroundIds: [
      'adeptus-administratum',
      'adeptus-arbites',
      'adeptus-ministorum',
      'imperial-guard',
    ],
  },
  {
    id: 'voidborn',
    labelKey: 'dh2.catalog.world.voidborn',
    characteristicModifiers: {
      plus: ['intelligence', 'willpower'],
      minus: ['strength'],
    },
    fateThreshold: 3,
    emperorsBlessing: 5,
    wounds: '7+1d5',
    aptitudeId: 'intelligence',
    bonusKey: 'dh2.catalog.world.voidborn.bonus',
    recommendedBackgroundIds: [
      'adeptus-astra-telepathica',
      'adeptus-mechanicus',
      'adeptus-ministorum',
      'outcast',
    ],
  },
];

export const DH2E_BACKGROUNDS: readonly Dh2eBackground[] = [
  {
    id: 'adeptus-administratum',
    labelKey: 'dh2.catalog.background.adeptus-administratum',
    startingSkills: [
      {
        choose: 1,
        of: [
          {
            skillId: 'commerce',
          },
          {
            skillId: 'medicae',
          },
        ],
      },
      {
        skillId: 'common-lore',
        specialisation: 'administratum',
      },
      {
        skillId: 'linguistics',
        specialisation: 'high-gothic',
      },
      {
        skillId: 'logic',
      },
      {
        skillId: 'scholastic-lore',
        specialisation: 'any',
      },
    ],
    startingTalents: [
      {
        talentId: 'weapon-training',
        specialisation: 'las',
      },
    ],
    bonusKeys: ['dh2.catalog.background.adeptus-administratum.bonus.0'],
    aptitudeChoice: ['knowledge', 'social'],
    recommendedRoleIds: ['chirurgeon', 'hierophant', 'sage', 'seeker'],
  },
  {
    id: 'adeptus-arbites',
    labelKey: 'dh2.catalog.background.adeptus-arbites',
    startingSkills: [
      {
        skillId: 'awareness',
      },
      {
        skillId: 'common-lore',
        specialisation: 'adeptus-arbites',
      },
      {
        skillId: 'common-lore',
        specialisation: 'underworld',
      },
      {
        choose: 1,
        of: [
          {
            skillId: 'inquiry',
          },
          {
            skillId: 'interrogation',
          },
        ],
      },
      {
        skillId: 'intimidate',
      },
      {
        skillId: 'scrutiny',
      },
    ],
    startingTalents: [
      {
        talentId: 'weapon-training',
        specialisation: 'shock',
      },
    ],
    bonusKeys: ['dh2.catalog.background.adeptus-arbites.bonus.0'],
    aptitudeChoice: ['offence', 'defence'],
    recommendedRoleIds: ['assassin', 'desperado', 'seeker', 'warrior'],
  },
  {
    id: 'adeptus-astra-telepathica',
    labelKey: 'dh2.catalog.background.adeptus-astra-telepathica',
    startingSkills: [
      {
        skillId: 'awareness',
      },
      {
        skillId: 'common-lore',
        specialisation: 'adeptus-astra-telepathica',
      },
      {
        choose: 1,
        of: [
          {
            skillId: 'deceive',
          },
          {
            skillId: 'interrogation',
          },
        ],
      },
      {
        skillId: 'forbidden-lore',
        specialisation: 'the-warp',
      },
      {
        choose: 1,
        of: [
          {
            skillId: 'psyniscience',
          },
          {
            skillId: 'scrutiny',
          },
        ],
      },
    ],
    startingTalents: [
      {
        talentId: 'weapon-training',
        specialisations: ['las', 'low-tech'],
      },
    ],
    bonusKeys: [
      'dh2.catalog.background.adeptus-astra-telepathica.bonus.0',
      'dh2.catalog.background.adeptus-astra-telepathica.bonus.1',
    ],
    aptitudeChoice: ['defence', 'psyker'],
    recommendedRoleIds: ['chirurgeon', 'mystic', 'sage', 'seeker'],
  },
  {
    id: 'adeptus-mechanicus',
    labelKey: 'dh2.catalog.background.adeptus-mechanicus',
    startingSkills: [
      {
        choose: 1,
        of: [
          {
            skillId: 'awareness',
          },
          {
            skillId: 'operate',
            specialisation: 'any',
          },
        ],
      },
      {
        skillId: 'common-lore',
        specialisation: 'adeptus-mechanicus',
      },
      {
        skillId: 'logic',
      },
      {
        skillId: 'security',
      },
      {
        skillId: 'tech-use',
      },
    ],
    startingTalents: [
      {
        talentId: 'mechadendrite-use',
        specialisation: 'utility',
      },
      {
        talentId: 'weapon-training',
        specialisation: 'solid-projectile',
      },
    ],
    bonusKeys: ['dh2.catalog.background.adeptus-mechanicus.bonus.0'],
    aptitudeChoice: ['knowledge', 'tech'],
    recommendedRoleIds: ['chirurgeon', 'hierophant', 'sage', 'seeker'],
  },
  {
    id: 'adeptus-ministorum',
    labelKey: 'dh2.catalog.background.adeptus-ministorum',
    startingSkills: [
      {
        skillId: 'charm',
      },
      {
        skillId: 'command',
      },
      {
        skillId: 'common-lore',
        specialisation: 'ecclesiarchy',
      },
      {
        choose: 1,
        of: [
          {
            skillId: 'inquiry',
          },
          {
            skillId: 'scrutiny',
          },
        ],
      },
      {
        skillId: 'linguistics',
        specialisation: 'high-gothic',
      },
    ],
    startingTalents: [
      {
        choose: 1,
        of: [
          {
            talentId: 'weapon-training',
            specialisation: 'flame',
          },
          {
            talentId: 'weapon-training',
            specialisations: ['low-tech', 'solid-projectile'],
          },
        ],
      },
    ],
    bonusKeys: ['dh2.catalog.background.adeptus-ministorum.bonus.0'],
    aptitudeChoice: ['leadership', 'social'],
    recommendedRoleIds: ['chirurgeon', 'hierophant', 'seeker', 'warrior'],
  },
  {
    id: 'imperial-guard',
    labelKey: 'dh2.catalog.background.imperial-guard',
    startingSkills: [
      {
        skillId: 'athletics',
      },
      {
        skillId: 'command',
      },
      {
        skillId: 'common-lore',
        specialisation: 'imperial-guard',
      },
      {
        choose: 1,
        of: [
          {
            skillId: 'medicae',
          },
          {
            skillId: 'operate',
            specialisation: 'surface',
          },
        ],
      },
      {
        skillId: 'navigate',
        specialisation: 'surface',
      },
    ],
    startingTalents: [
      {
        talentId: 'weapon-training',
        specialisations: ['las', 'low-tech'],
      },
    ],
    bonusKeys: ['dh2.catalog.background.imperial-guard.bonus.0'],
    aptitudeChoice: ['fieldcraft', 'leadership'],
    recommendedRoleIds: ['assassin', 'desperado', 'hierophant', 'warrior'],
  },
  {
    id: 'outcast',
    labelKey: 'dh2.catalog.background.outcast',
    startingSkills: [
      {
        choose: 1,
        of: [
          {
            skillId: 'acrobatics',
          },
          {
            skillId: 'sleight-of-hand',
          },
        ],
      },
      {
        skillId: 'common-lore',
        specialisation: 'underworld',
      },
      {
        skillId: 'deceive',
      },
      {
        skillId: 'dodge',
      },
      {
        skillId: 'stealth',
      },
    ],
    startingTalents: [
      {
        talentId: 'weapon-training',
        specialisations: ['chain'],
      },
    ],
    bonusKeys: ['dh2.catalog.background.outcast.bonus.0'],
    aptitudeChoice: ['fieldcraft', 'social'],
    recommendedRoleIds: ['assassin', 'desperado', 'seeker'],
  },
];

export const DH2E_ROLES: readonly Dh2eRole[] = [
  {
    id: 'assassin',
    labelKey: 'dh2.catalog.role.assassin',
    aptitudes: [
      'agility',
      {
        choose: 1,
        of: ['ballistic-skill', 'weapon-skill'],
      },
      'fieldcraft',
      'finesse',
      'perception',
    ],
    talentChoice: {
      choose: 1,
      of: ['jaded', 'leap-up'],
    },
    bonusKey: 'dh2.catalog.role.assassin.bonus',
  },
  {
    id: 'chirurgeon',
    labelKey: 'dh2.catalog.role.chirurgeon',
    aptitudes: [
      'fieldcraft',
      'intelligence',
      'knowledge',
      'strength',
      'toughness',
    ],
    talentChoice: {
      choose: 1,
      of: ['resistance', 'takedown'],
    },
    bonusKey: 'dh2.catalog.role.chirurgeon.bonus',
  },
  {
    id: 'desperado',
    labelKey: 'dh2.catalog.role.desperado',
    aptitudes: [
      'agility',
      'ballistic-skill',
      'defence',
      'fellowship',
      'finesse',
    ],
    talentChoice: {
      choose: 1,
      of: ['catfall', 'quick-draw'],
    },
    bonusKey: 'dh2.catalog.role.desperado.bonus',
  },
  {
    id: 'hierophant',
    labelKey: 'dh2.catalog.role.hierophant',
    aptitudes: ['fellowship', 'offence', 'social', 'toughness', 'willpower'],
    talentChoice: {
      choose: 1,
      of: ['double-team', 'hatred'],
    },
    bonusKey: 'dh2.catalog.role.hierophant.bonus',
  },
  {
    id: 'mystic',
    labelKey: 'dh2.catalog.role.mystic',
    aptitudes: [
      'defence',
      'intelligence',
      'knowledge',
      'perception',
      'willpower',
    ],
    talentChoice: {
      choose: 1,
      of: ['resistance', 'warp-sense'],
    },
    bonusKey: 'dh2.catalog.role.mystic.bonus',
  },
  {
    id: 'sage',
    labelKey: 'dh2.catalog.role.sage',
    aptitudes: ['intelligence', 'knowledge', 'perception', 'tech', 'willpower'],
    talentChoice: {
      choose: 1,
      of: ['ambidextrous', 'clues-from-the-crowds'],
    },
    bonusKey: 'dh2.catalog.role.sage.bonus',
  },
  {
    id: 'seeker',
    labelKey: 'dh2.catalog.role.seeker',
    aptitudes: ['fellowship', 'intelligence', 'perception', 'social', 'tech'],
    talentChoice: {
      choose: 1,
      of: ['keen-intuition', 'disarm'],
    },
    bonusKey: 'dh2.catalog.role.seeker.bonus',
  },
  {
    id: 'warrior',
    labelKey: 'dh2.catalog.role.warrior',
    aptitudes: [
      'ballistic-skill',
      'defence',
      'offence',
      'strength',
      'weapon-skill',
    ],
    talentChoice: {
      choose: 1,
      of: ['iron-jaw', 'rapid-reload'],
    },
    bonusKey: 'dh2.catalog.role.warrior.bonus',
  },
];

export const DH2E_DIVINATIONS: readonly Dh2eDivination[] = [
  {
    id: 'd100-01',
    from: 1,
    to: 1,
    textKey: 'dh2.catalog.divination.d100-01',
    effectKey: 'dh2.catalog.divination.d100-01.effect',
    grants: [
      {
        table: '8-15',
      },
    ],
  },
  {
    id: 'd100-02',
    from: 2,
    to: 5,
    textKey: 'dh2.catalog.divination.d100-02',
    effectKey: 'dh2.catalog.divination.d100-02.effect',
    deltas: {
      perception: 5,
    },
    grants: [
      {
        disorder: 'phobia',
      },
    ],
  },
  {
    id: 'd100-06',
    from: 6,
    to: 9,
    textKey: 'dh2.catalog.divination.d100-06',
    effectKey: 'dh2.catalog.divination.d100-06.effect',
    deltasElse: {
      willpower: 2,
    },
    grants: [
      {
        talent: 'jaded',
      },
    ],
  },
  {
    id: 'd100-10',
    from: 10,
    to: 13,
    textKey: 'dh2.catalog.divination.d100-10',
    effectKey: 'dh2.catalog.divination.d100-10.effect',
    deltas: {
      agility: -3,
    },
  },
  {
    id: 'd100-14',
    from: 14,
    to: 17,
    textKey: 'dh2.catalog.divination.d100-14',
    effectKey: 'dh2.catalog.divination.d100-14.effect',
    deltasElse: {
      strength: 2,
    },
    grants: [
      {
        talent: 'hatred',
      },
    ],
  },
  {
    id: 'd100-18',
    from: 18,
    to: 21,
    textKey: 'dh2.catalog.divination.d100-18',
    effectKey: 'dh2.catalog.divination.d100-18.effect',
    choices: [
      {
        plus: {
          deltas: {
            agility: 3,
          },
        },
        minus: {
          deltas: {
            'weapon-skill': -3,
          },
        },
      },
    ],
  },
  {
    id: 'd100-22',
    from: 22,
    to: 25,
    textKey: 'dh2.catalog.divination.d100-22',
    effectKey: 'dh2.catalog.divination.d100-22.effect',
    deltasElse: {
      agility: 2,
    },
    grants: [
      {
        talent: 'quick-draw',
      },
    ],
  },
  {
    id: 'd100-26',
    from: 26,
    to: 29,
    textKey: 'dh2.catalog.divination.d100-26',
    effectKey: 'dh2.catalog.divination.d100-26.effect',
    deltas: {
      perception: 3,
    },
    corruptionFirst: 1,
  },
  {
    id: 'd100-30',
    from: 30,
    to: 33,
    textKey: 'dh2.catalog.divination.d100-30',
    effectKey: 'dh2.catalog.divination.d100-30.effect',
    deltas: {
      intelligence: -3,
    },
    corruptionFirst: -1,
  },
  {
    id: 'd100-34',
    from: 34,
    to: 38,
    textKey: 'dh2.catalog.divination.d100-34',
    effectKey: 'dh2.catalog.divination.d100-34.effect',
    choices: [
      {
        plus: {
          deltas: {
            fellowship: 3,
          },
        },
        minus: {
          deltas: {
            toughness: -3,
          },
        },
      },
    ],
  },
  {
    id: 'd100-39',
    from: 39,
    to: 43,
    textKey: 'dh2.catalog.divination.d100-39',
    effectKey: 'dh2.catalog.divination.d100-39.effect',
    grants: [
      {
        rule: 'new-disorder-instead-of-severity',
      },
    ],
  },
  {
    id: 'd100-44',
    from: 44,
    to: 49,
    textKey: 'dh2.catalog.divination.d100-44',
    effectKey: 'dh2.catalog.divination.d100-44.effect',
    choices: [
      {
        plus: {
          deltas: {
            toughness: 3,
          },
        },
        minus: {
          deltas: {
            fellowship: -3,
          },
        },
      },
    ],
  },
  {
    id: 'd100-50',
    from: 50,
    to: 54,
    textKey: 'dh2.catalog.divination.d100-50',
    effectKey: 'dh2.catalog.divination.d100-50.effect',
    grants: [
      {
        rule: 'choose-malignancy',
      },
    ],
  },
  {
    id: 'd100-55',
    from: 55,
    to: 59,
    textKey: 'dh2.catalog.divination.d100-55',
    effectKey: 'dh2.catalog.divination.d100-55.effect',
    choices: [
      {
        plus: {
          deltas: {
            'weapon-skill': 3,
          },
        },
        minus: {
          deltas: {
            agility: -3,
          },
        },
      },
    ],
  },
  {
    id: 'd100-60',
    from: 60,
    to: 63,
    textKey: 'dh2.catalog.divination.d100-60',
    effectKey: 'dh2.catalog.divination.d100-60.effect',
    deltas: {
      perception: -3,
    },
    insanityFirst: -1,
  },
  {
    id: 'd100-64',
    from: 64,
    to: 67,
    textKey: 'dh2.catalog.divination.d100-64',
    effectKey: 'dh2.catalog.divination.d100-64.effect',
    deltas: {
      willpower: 3,
    },
    insanityFirst: 1,
  },
  {
    id: 'd100-68',
    from: 68,
    to: 71,
    textKey: 'dh2.catalog.divination.d100-68',
    effectKey: 'dh2.catalog.divination.d100-68.effect',
    deltas: {
      perception: 2,
    },
    grants: [
      {
        rule: 'reroll-awareness-avoid-surprise',
      },
    ],
  },
  {
    id: 'd100-72',
    from: 72,
    to: 75,
    textKey: 'dh2.catalog.divination.d100-72',
    effectKey: 'dh2.catalog.divination.d100-72.effect',
    deltas: {
      toughness: -3,
    },
    grants: [
      {
        rule: 'first-damage-bonus',
      },
    ],
  },
  {
    id: 'd100-76',
    from: 76,
    to: 79,
    textKey: 'dh2.catalog.divination.d100-76',
    effectKey: 'dh2.catalog.divination.d100-76.effect',
    deltasElse: {
      toughness: 2,
    },
    grants: [
      {
        talent: 'resistance',
      },
    ],
  },
  {
    id: 'd100-80',
    from: 80,
    to: 83,
    textKey: 'dh2.catalog.divination.d100-80',
    effectKey: 'dh2.catalog.divination.d100-80.effect',
    grants: [
      {
        rule: 'first-fatigue-minus-one',
      },
    ],
  },
  {
    id: 'd100-84',
    from: 84,
    to: 87,
    textKey: 'dh2.catalog.divination.d100-84',
    effectKey: 'dh2.catalog.divination.d100-84.effect',
    deltasElse: {
      intelligence: 2,
    },
    grants: [
      {
        talent: 'keen-intuition',
      },
    ],
  },
  {
    id: 'd100-88',
    from: 88,
    to: 91,
    textKey: 'dh2.catalog.divination.d100-88',
    effectKey: 'dh2.catalog.divination.d100-88.effect',
    deltasElse: {
      agility: 2,
    },
    grants: [
      {
        skill: 'dodge',
        rank: 1,
      },
    ],
  },
  {
    id: 'd100-92',
    from: 92,
    to: 95,
    textKey: 'dh2.catalog.divination.d100-92',
    effectKey: 'dh2.catalog.divination.d100-92.effect',
    deltasElse: {
      fellowship: 2,
    },
    grants: [
      {
        talent: 'clues-from-the-crowds',
      },
    ],
  },
  {
    id: 'd100-96',
    from: 96,
    to: 99,
    textKey: 'dh2.catalog.divination.d100-96',
    effectKey: 'dh2.catalog.divination.d100-96.effect',
    grants: [
      {
        rule: 'burn-fate-survival-1d10',
      },
    ],
  },
  {
    id: 'd100-100',
    from: 100,
    to: 100,
    textKey: 'dh2.catalog.divination.d100-100',
    effectKey: 'dh2.catalog.divination.d100-100.effect',
    fateThreshold: 1,
  },
];
