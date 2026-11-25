/**
 * ─── LANDMARK: DH1 DATA PACK ───────────────────────────────────────────────
 * Данные (карьеры, пророчества, эффекты) редакции Dark Heresy 1, живущие внутри плагина
 * (DH-данные дублируются). Копия, а не общий data-модуль: редакции считаются разными,
 * даже если сейчас содержимое совпадает, — правки dh1 не должны менять
 * dh2, и наоборот. Источник этих данных — здесь;
 * общего data-плагина нет.
 */
export const DarkHeresyCareerPaths = [
  'Adept',
  'Arbitrator',
  'Assassin',
  'Cleric',
  'Guardsman',
  'Imperial Psyker',
  'Scum',
  'Tech-Priest',
] as const;

export const DIVINATIONS = [
  {
    id: 'mutationWithout',
    divination: 'Flesh is a draft; someone is already editing.',
    effectId: 'minorMutation',
    effect: 'Minor Mutation.',
  },
  {
    id: 'onlyTheInsane',
    divination: 'Madness is a stair; not all need the top.',
    effectId: 'insanity2',
    effect: '+2 Insanity Points.',
  },
  {
    id: 'sinsHidden',
    divination: 'What is hidden rots faster than what shows.',
    effectId: 'corruption3',
    effect: '+3 Corruption Points.',
  },
  {
    id: 'innocenceIllusion',
    divination: 'Innocence is what no one has tested yet.',
    effectId: 'insanity1Corruption1',
    effect: '+1 Insanity Point, +1 Corruption Point.',
  },
  {
    id: 'darkDreams',
    divination: 'Sleep is a door that does not lock.',
    effectId: 'insanity2',
    effect: '+2 Insanity Points.',
  },
  {
    id: 'painOfBullet',
    divination: 'A bullet teaches faster than words.',
    effectId: 'toughness1',
    effect: '+1 Toughness.',
  },
  {
    id: 'killTheAlien',
    divination: 'The alien moves otherwise — learn it.',
    effectId: 'agility2',
    effect: '+2 Agility.',
  },
  {
    id: 'truthSubjective',
    divination: 'Truth is what it pays to believe.',
    effectId: 'intelligence3Corruption3',
    effect: '+3 Intelligence, +3 Corruption Points.',
  },
  {
    id: 'knowTheMutant',
    divination: 'Everyone bears a mark; look for it.',
    effectId: 'perception2',
    effect: '+2 Perception.',
  },
  {
    id: 'offerHisLife',
    divination: 'Who does not cling to life hits harder.',
    effectId: 'strength2',
    effect: '+2 Strength.',
  },
  {
    id: 'jobWorthDying',
    divination: 'A job is worth what you will leave behind.',
    effectId: 'frenzyTalent',
    effect: '"Frenzy" talent.',
  },
  {
    id: 'onlyInDeath',
    divination: 'Death is the last line; hold until it.',
    effectId: 'wound1',
    effect: '+1 Wound.',
  },
  {
    id: 'mindWithoutPurpose',
    divination: 'Purpose without a mind is only speed.',
    effectId: 'fate1',
    effect: '+1 Fate Point.',
  },
  {
    id: 'noCivilians',
    divination: 'Every bystander is a potential witness.',
    effectId: 'toughness2Wound1',
    effect: '+2 Toughness, +1 Wound.',
  },
  {
    id: 'violenceSolves',
    divination: 'A problem you can see is solved simply.',
    effectId: 'weaponSkill3',
    effect: '+3 Weapon Skill.',
  },
  {
    id: 'toWarHuman',
    divination: 'A step repeated a thousand times becomes a wing.',
    effectId: 'agility3',
    effect: '+3 Agility.',
  },
  {
    id: 'spiritNotBroken',
    divination: 'The body yields first; you decide when.',
    effectId: 'willpower3',
    effect: '+3 Willpower.',
  },
  {
    id: 'gunMightier',
    divination: 'Distance is a weapon too.',
    effectId: 'ballisticSkill3',
    effect: '+3 Ballistic Skill.',
  },
  {
    id: 'boonToBrothers',
    divination: 'A brother walks beside you while you walk.',
    effectId: 'fellowship3',
    effect: '+3 Fellowship.',
  },
  {
    id: 'menMustDie',
    divination: 'Who survived a hundred knows the price of one.',
    effectId: 'toughness3',
    effect: '+3 Toughness.',
  },
  {
    id: 'darknessLightOfTerra',
    divination: 'You carry your light; you do not find it.',
    effectId: 'willpower3',
    effect: '+3 Willpower.',
  },
  {
    id: 'onlyTrueFear',
    divination: 'Fear not the dark, but what waits in it.',
    effectId: 'wounds2',
    effect: '+2 Wounds.',
  },
  {
    id: 'thoughtBegetsHeresy',
    divination: 'Thought begins; the hand ends.',
    effectId: 'strength3',
    effect: '+3 Strength.',
  },
  {
    id: 'wiseManLearns',
    divination: 'A mistake repeated twice is a choice.',
    effectId: 'intelligence3',
    effect: '+3 Intelligence.',
  },
  {
    id: 'suspiciousMind',
    divination: 'Who expects no blow takes two.',
    effectId: 'perception3',
    effect: '+3 Perception.',
  },
  {
    id: 'trustYourFear',
    divination: 'Unease is cheap insurance.',
    effectId: 'agility2Fate1',
    effect: '+2 Agility, +1 Fate Point.',
  },
  {
    id: 'noSubstituteForZeal',
    divination: 'The burning do not notice the cold.',
    effectId: 'toughness2Willpower2',
    effect: '+2 Toughness, +2 Willpower.',
  },
  {
    id: 'askHowNotWhy',
    divination: 'An order matters in its doing, not its meaning.',
    effectId: 'weaponSkill2BallisticSkill2',
    effect: '+2 Weapon Skill, +2 Ballistic Skill.',
  },
];

export const DIVINATION_BY_ID: Record<string, (typeof DIVINATIONS)[number]> =
  Object.fromEntries(DIVINATIONS.map((d) => [d.id, d]));
export const DIVINATION_ID_BY_TEXT: Record<string, string> = Object.fromEntries(
  DIVINATIONS.map((d) => [d.divination, d.id]),
);
export const EFFECT_ID_BY_TEXT: Record<string, string> = Object.fromEntries(
  DIVINATIONS.map((d) => [d.effect, d.effectId]),
);

export const FERAL_WORLD_QUIRKS = [
  'Hairy Knuckles',
  'Joined Eyebrows',
  'Warpaint',
  'Hands like Spatchcocks',
  'Filed Teeth',
  'Beetling Brows',
  'Musky Smell',
  'Hairy',
  'Ripped Ears',
  'Long Fingernails',
  'Tribal Tattooing',
  'Scarring',
  'Piercing',
  'Cat’s Eyes',
  'Small Head',
  'Thick Jaw',
];

export const HIVE_WORLD_QUIRKS = [
  'Pallid',
  'Grimy Skin',
  'Outrageous Hair',
  'Rotten Teeth',
  'Electoo',
  'Piercing',
  'Set of Piercings',
  'Hacking Cough',
  'Tattoos',
  'Bullet Wound Scar',
  'Nervous Tic',
  'Large Mole',
  'Pollution Scars',
  'Hump',
  'Small Hands',
  'Chemical Smell',
];

export const IMPERIAL_WORLD_QUIRKS = [
  'Missing Digit',
  'Aquiline Nose',
  'Warts',
  'Duelling Scar',
  'Pierced Nose',
  'Nervous Tic',
  'Aquila Tattoo',
  'Faint Smell',
  'Pox Marks',
  'Devotional Scar',
  'Electoo',
  'Quivering Fingers',
  'Pierced Ears',
  'Sinister Boil',
  'Make-up',
  'Slouched Gait',
];

export const VOID_BORN_QUIRKS = [
  'Pallid',
  'Bald',
  'Long Fingers',
  'Tiny Ears',
  'Spindly Limbs',
  'Yellow Fingernails',
  'Stumpy Teeth',
  'Widely Spaced Eyes',
  'Large Head',
  'Curved Spine',
  'Hairless',
  'Elegant Hands',
  'Flowing Hair',
  'Albino',
  'Limping Gait',
  'Stooped Stance',
];

export const QUIRKS_BY_HOMEWORLD: Record<string, string[]> = {
  'Feral World': FERAL_WORLD_QUIRKS,
  'Hive World': HIVE_WORLD_QUIRKS,
  'Imperial World': IMPERIAL_WORLD_QUIRKS,
  'Void Born': VOID_BORN_QUIRKS,
  // В базовой книге (табл. 1-13) таблицы примет для Мира-кузницы нет.
  'Forge World': [],
};

export const WORLD_VARIANTS_BY_HOMEWORLD: Record<string, string[]> = {
  'Imperial World': [
    'Agri-World',
    'Backwater',
    'Feudal World',
    'War Zone',
    'Dead Planet',
    'Shrine World',
    'Paradise World',
  ],
  'Feral World': [
    'Dirt Ward',
    'Unlucky Colour',
    "Hunter's Oath",
    'Thirsty Blade',
    'Spirit Shackle',
    'Warrior Death',
    'Power of Names',
    'Lonely Dead',
    'Living Record',
    'Nemesis',
  ],
  'Hive World': [
    'Dross Hound',
    'Ganger Scum',
    'Factory Dregs',
    'Middle Hive',
    'Specialist',
    'Hive Noble',
  ],
  'Void Born': ['Space Hulk', 'Orbital', 'Chartist Vessel', 'Rogue Trader'],
  // Таблица И-1-2 «Место Рождения» (стр. 27).
  'Forge World': [
    'Great Forge World',
    'Minor Forge World',
    'Orbit',
    'Territory',
    'Research Outpost',
    'Explorator Fleet',
  ],
  // Таблица И-1-4 «Путь к Величию» (стр. 33).
  'Noble Born': [
    'Mercantile Magnates',
    'Military Tradition',
    'Rulers of Mankind',
    'Imperial Quartermaster',
    'House of Iron Spires',
    'Blood of Greatness',
    "Rogue's Fortune",
    'Tainted Blood',
  ],
  // Таблица И-1-5 «Судьба Семьи» (стр. 35).
  'Schola Progenium': [
    'War Martyrs',
    'Rebellion Victims',
    'Distant Outpost',
    'Lost in the Void',
    'No Trace',
    'No Return',
    'Halo of Silence',
  ],
  // Таблица И-1-3 «Осколки Памяти» (стр. 29–30).
  'Mind-Cleared': [
    'Broken Mirror',
    'Cold Grave',
    'Night of the Daemon',
    'Sole Survivor',
    'Dark Altar',
    'Bloody Throne',
    'Forest of Nightmares',
    'Malfian Candidate',
    'Restorer of Glory',
  ],
};

export const WORLD_VARIANT_LABELS: Record<string, string> = {
  'Feral World': 'dh1.tribalTaboos',
  'Hive World': 'dh1.hiveClass',
  'Imperial World': 'dh1.birthPlanet',
  'Void Born': 'dh1.shipTradition',
  'Forge World': 'dh1.placeOfBirth',
  'Noble Born': 'dh1.pathToGreatness',
  'Schola Progenium': 'dh1.familyFate',
  'Mind-Cleared': 'dh1.memoryShards',
};

export const HOME_WORLD_KEYS: Record<string, string> = {
  'Feral World': 'dh1.homeWorldFeral',
  'Hive World': 'dh1.homeWorldHive',
  'Imperial World': 'dh1.homeWorldImperial',
  'Void Born': 'dh1.homeWorldVoidBorn',
  'Forge World': 'dh1.homeWorldForge',
  'Schola Progenium': 'dh1.homeWorldSchola',
  'Noble Born': 'dh1.homeWorldNoble',
  'Mind-Cleared': 'dh1.homeWorldMindCleared',
};

export const VARIANT_KEYS: Record<string, string> = {
  'Agri-World': 'dh1.variantAgriWorld',
  Backwater: 'dh1.variantBackwater',
  'Feudal World': 'dh1.variantFeudalWorld',
  'War Zone': 'dh1.variantWarZone',
  'Dead Planet': 'dh1.variantDeadPlanet',
  'Shrine World': 'dh1.variantShrineWorld',
  'Paradise World': 'dh1.variantParadiseWorld',
  'Dirt Ward': 'dh1.variantDirtWard',
  'Unlucky Colour': 'dh1.variantUnluckyColour',
  "Hunter's Oath": 'dh1.variantHuntersOath',
  'Thirsty Blade': 'dh1.variantThirstyBlade',
  'Spirit Shackle': 'dh1.variantSpiritShackle',
  'Warrior Death': 'dh1.variantWarriorDeath',
  'Power of Names': 'dh1.variantPowerOfNames',
  'Lonely Dead': 'dh1.variantLonelyDead',
  'Living Record': 'dh1.variantLivingRecord',
  Nemesis: 'dh1.variantNemesis',
  'Dross Hound': 'dh1.variantDrossHound',
  'Ganger Scum': 'dh1.variantGangerScum',
  'Factory Dregs': 'dh1.variantFactoryDregs',
  'Middle Hive': 'dh1.variantMiddleHive',
  Specialist: 'dh1.variantSpecialist',
  'Hive Noble': 'dh1.variantHiveNoble',
  'Space Hulk': 'dh1.variantSpaceHulk',
  Orbital: 'dh1.variantOrbital',
  'Chartist Vessel': 'dh1.variantChartistVessel',
  'Rogue Trader': 'dh1.variantRogueTrader',
  'Great Forge World': 'dh1.variantGreatForgeWorld',
  'Minor Forge World': 'dh1.variantMinorForgeWorld',
  Orbit: 'dh1.variantForgeOrbit',
  Territory: 'dh1.variantTerritory',
  'Research Outpost': 'dh1.variantResearchOutpost',
  'Explorator Fleet': 'dh1.variantExploratorFleet',
  'Mercantile Magnates': 'dh1.variantMercantileMagnates',
  'Military Tradition': 'dh1.variantMilitaryTradition',
  'Rulers of Mankind': 'dh1.variantRulersOfMankind',
  'Imperial Quartermaster': 'dh1.variantImperialQuartermaster',
  'House of Iron Spires': 'dh1.variantHouseOfIronSpires',
  'Blood of Greatness': 'dh1.variantBloodOfGreatness',
  "Rogue's Fortune": 'dh1.variantRoguesFortune',
  'Tainted Blood': 'dh1.variantTaintedBlood',
  'War Martyrs': 'dh1.variantWarMartyrs',
  'Rebellion Victims': 'dh1.variantRebellionVictims',
  'Distant Outpost': 'dh1.variantDistantOutpost',
  'Lost in the Void': 'dh1.variantLostInTheVoid',
  'No Trace': 'dh1.variantNoTrace',
  'No Return': 'dh1.variantNoReturn',
  'Halo of Silence': 'dh1.variantHaloOfSilence',
  'Broken Mirror': 'dh1.variantBrokenMirror',
  'Cold Grave': 'dh1.variantColdGrave',
  'Night of the Daemon': 'dh1.variantNightOfTheDaemon',
  'Sole Survivor': 'dh1.variantSoleSurvivor',
  'Dark Altar': 'dh1.variantDarkAltar',
  'Bloody Throne': 'dh1.variantBloodyThrone',
  'Forest of Nightmares': 'dh1.variantForestOfNightmares',
  'Malfian Candidate': 'dh1.variantMalfianCandidate',
  'Restorer of Glory': 'dh1.variantRestorerOfGlory',
};

export const ALL_QUIRKS = [
  ...new Set([
    ...FERAL_WORLD_QUIRKS,
    ...HIVE_WORLD_QUIRKS,
    ...IMPERIAL_WORLD_QUIRKS,
    ...VOID_BORN_QUIRKS,
  ]),
].sort();

/**
 * Особенности родных миров (core + «Книга Инквизитора»).
 *
 * Здесь хранится только имя и короткая механика; полные описания остаются
 * в книге. Ключи словаря — обязательные для обеих локалей.
 */
export interface WorldFeatureRef {
  /** EN-имя из каталога `content/dh1` (стабильный ключ данных). */
  name: string;
  labelKey: string;
  effectKey: string;
}

export const WORLD_FEATURES: Record<string, WorldFeatureRef[]> = {
  'Feral World': [
    {
      name: 'Iron Stomach',
      labelKey: 'dh1.featureIronStomach',
      effectKey: 'dh1.featureIronStomachEffect',
    },
    {
      name: 'Primitive',
      labelKey: 'dh1.featurePrimitive',
      effectKey: 'dh1.featurePrimitiveEffect',
    },
    {
      name: 'Rite of Passage',
      labelKey: 'dh1.featureRiteOfPassage',
      effectKey: 'dh1.featureRiteOfPassageEffect',
    },
    {
      name: 'Wilderness Savvy',
      labelKey: 'dh1.featureWildernessSavvy',
      effectKey: 'dh1.featureWildernessSavvyEffect',
    },
  ],
  'Hive World': [
    {
      name: 'Accustomed to Crowds',
      labelKey: 'dh1.featureAccustomedToCrowds',
      effectKey: 'dh1.featureAccustomedToCrowdsEffect',
    },
    {
      name: 'Caves of Steel',
      labelKey: 'dh1.featureCavesOfSteel',
      effectKey: 'dh1.featureCavesOfSteelEffect',
    },
    {
      name: 'Hivebound',
      labelKey: 'dh1.featureHivebound',
      effectKey: 'dh1.featureHiveboundEffect',
    },
    {
      name: 'Wary',
      labelKey: 'dh1.featureWary',
      effectKey: 'dh1.featureWaryEffect',
    },
  ],
  'Imperial World': [
    {
      name: 'Blessed Ignorance',
      labelKey: 'dh1.featureBlessedIgnorance',
      effectKey: 'dh1.featureBlessedIgnoranceEffect',
    },
    {
      name: 'Hagiography',
      labelKey: 'dh1.featureHagiography',
      effectKey: 'dh1.featureHagiographyEffect',
    },
    {
      name: 'Liturgical Familiarity',
      labelKey: 'dh1.featureLiturgicalFamiliarity',
      effectKey: 'dh1.featureLiturgicalFamiliarityEffect',
    },
    {
      name: 'Superior Origins',
      labelKey: 'dh1.featureSuperiorOrigins',
      effectKey: 'dh1.featureSuperiorOriginsEffect',
    },
  ],
  'Void Born': [
    {
      name: 'Charmed',
      labelKey: 'dh1.featureCharmed',
      effectKey: 'dh1.featureCharmedEffect',
    },
    {
      name: 'Ill-Omened',
      labelKey: 'dh1.featureIllOmened',
      effectKey: 'dh1.featureIllOmenedEffect',
    },
    {
      name: 'Shipwise',
      labelKey: 'dh1.featureShipwise',
      effectKey: 'dh1.featureShipwiseEffect',
    },
    {
      name: 'Void Accustomed',
      labelKey: 'dh1.featureVoidAccustomed',
      effectKey: 'dh1.featureVoidAccustomedEffect',
    },
  ],
  'Forge World': [
    {
      name: 'Fit For Purpose',
      labelKey: 'dh1.featureFitForPurpose',
      effectKey: 'dh1.featureFitForPurposeEffect',
    },
    {
      name: 'Stranger to the Cult',
      labelKey: 'dh1.featureStrangerToTheCult',
      effectKey: 'dh1.featureStrangerToTheCultEffect',
    },
    {
      name: 'Credo Omnissiah',
      labelKey: 'dh1.featureCredoOmnissiah',
      effectKey: 'dh1.featureCredoOmnissiahEffect',
    },
  ],
  'Schola Progenium': [
    {
      name: 'Schola Education',
      labelKey: 'dh1.featureScholaEducation',
      effectKey: 'dh1.featureScholaEducationEffect',
    },
    {
      name: 'Skill at Arms',
      labelKey: 'dh1.featureSkillAtArms',
      effectKey: 'dh1.featureSkillAtArmsEffect',
    },
    {
      name: 'Sheltered Upbringing',
      labelKey: 'dh1.featureShelteredUpbringing',
      effectKey: 'dh1.featureShelteredUpbringingEffect',
    },
    {
      name: 'Tempered Will',
      labelKey: 'dh1.featureTemperedWill',
      effectKey: 'dh1.featureTemperedWillEffect',
    },
  ],
  'Noble Born': [
    {
      name: 'Etiquette',
      labelKey: 'dh1.featureEtiquette',
      effectKey: 'dh1.featureEtiquetteEffect',
    },
    {
      name: 'Supremely Connected',
      labelKey: 'dh1.featureSupremelyConnected',
      effectKey: 'dh1.featureSupremelyConnectedEffect',
    },
    {
      name: 'Vendetta',
      labelKey: 'dh1.featureVendetta',
      effectKey: 'dh1.featureVendettaEffect',
    },
    {
      name: 'Wealth',
      labelKey: 'dh1.featureWealth',
      effectKey: 'dh1.featureWealthEffect',
    },
  ],
  'Mind-Cleared': [
    {
      name: 'Engram Implantation',
      labelKey: 'dh1.featureEngramImplantation',
      effectKey: 'dh1.featureEngramImplantationEffect',
    },
    {
      name: 'Failsafe Control',
      labelKey: 'dh1.featureFailsafeControl',
      effectKey: 'dh1.featureFailsafeControlEffect',
    },
    {
      name: 'Imperial Conditioning',
      labelKey: 'dh1.featureImperialConditioning',
      effectKey: 'dh1.featureImperialConditioningEffect',
    },
    {
      name: 'Through A Mirror Darkly',
      labelKey: 'dh1.featureThroughAMirrorDarkly',
      effectKey: 'dh1.featureThroughAMirrorDarklyEffect',
    },
  ],
};

/**
 * Приметы для родного мира (табл. 1-13).
 *
 * Таблица примет в книге есть только для четырёх классических миров.
 * У Мира-кузницы (как и у остальных миров из «Книги Инквизитора») своей
 * таблицы нет — отдаём общий список, чтобы поле «Особенность» не пустовало.
 * Возвращается копия: `.sort()` не должен мутировать исходные константы.
 */
export function getQuirksForHomeWorld(homeWorld: string): string[] {
  const specific = QUIRKS_BY_HOMEWORLD[homeWorld];
  return specific && specific.length > 0
    ? [...specific].sort()
    : [...ALL_QUIRKS];
}

export const QUIRK_KEYS: Record<string, string> = {
  'Hairy Knuckles': 'dh1.quirkHairyKnuckles',
  'Joined Eyebrows': 'dh1.quirkJoinedEyebrows',
  Warpaint: 'dh1.quirkWarpaint',
  'Hands like Spatchcocks': 'dh1.quirkHandsLikeSpatchcocks',
  'Filed Teeth': 'dh1.quirkFiledTeeth',
  'Beetling Brows': 'dh1.quirkBeetlingBrows',
  'Musky Smell': 'dh1.quirkMuskySmell',
  Hairy: 'dh1.quirkHairy',
  'Ripped Ears': 'dh1.quirkRippedEars',
  'Long Fingernails': 'dh1.quirkLongFingernails',
  'Tribal Tattooing': 'dh1.quirkTribalTattooing',
  Scarring: 'dh1.quirkScarring',
  Piercing: 'dh1.quirkPiercing',
  'Cat’s Eyes': 'dh1.quirkCatsEyes',
  'Small Head': 'dh1.quirkSmallHead',
  'Thick Jaw': 'dh1.quirkThickJaw',
  Pallid: 'dh1.quirkPallid',
  'Grimy Skin': 'dh1.quirkGrimySkin',
  'Outrageous Hair': 'dh1.quirkOutrageousHair',
  'Rotten Teeth': 'dh1.quirkRottenTeeth',
  Electoo: 'dh1.quirkElectoo',
  'Set of Piercings': 'dh1.quirkSetOfPiercings',
  'Hacking Cough': 'dh1.quirkHackingCough',
  Tattoos: 'dh1.quirkTattoos',
  'Bullet Wound Scar': 'dh1.quirkBulletWoundScar',
  'Nervous Tic': 'dh1.quirkNervousTic',
  'Large Mole': 'dh1.quirkLargeMole',
  'Pollution Scars': 'dh1.quirkPollutionScars',
  Hump: 'dh1.quirkHump',
  'Small Hands': 'dh1.quirkSmallHands',
  'Chemical Smell': 'dh1.quirkChemicalSmell',
  'Missing Digit': 'dh1.quirkMissingDigit',
  'Aquiline Nose': 'dh1.quirkAquilineNose',
  Warts: 'dh1.quirkWarts',
  'Duelling Scar': 'dh1.quirkDuellingScar',
  'Pierced Nose': 'dh1.quirkPiercedNose',
  'Aquila Tattoo': 'dh1.quirkAquilaTattoo',
  'Faint Smell': 'dh1.quirkFaintSmell',
  'Pox Marks': 'dh1.quirkPoxMarks',
  'Devotional Scar': 'dh1.quirkDevotionalScar',
  'Quivering Fingers': 'dh1.quirkQuiveringFingers',
  'Pierced Ears': 'dh1.quirkPiercedEars',
  'Sinister Boil': 'dh1.quirkSinisterBoil',
  'Make-up': 'dh1.quirkMakeup',
  'Slouched Gait': 'dh1.quirkSlouchedGait',
  Bald: 'dh1.quirkBald',
  'Long Fingers': 'dh1.quirkLongFingers',
  'Tiny Ears': 'dh1.quirkTinyEars',
  'Spindly Limbs': 'dh1.quirkSpindlyLimbs',
  'Yellow Fingernails': 'dh1.quirkYellowFingernails',
  'Stumpy Teeth': 'dh1.quirkStumpyTeeth',
  'Widely Spaced Eyes': 'dh1.quirkWidelySpacedEyes',
  'Large Head': 'dh1.quirkLargeHead',
  'Curved Spine': 'dh1.quirkCurvedSpine',
  Hairless: 'dh1.quirkHairless',
  'Elegant Hands': 'dh1.quirkElegantHands',
  'Flowing Hair': 'dh1.quirkFlowingHair',
  Albino: 'dh1.quirkAlbino',
  'Limping Gait': 'dh1.quirkLimpingGait',
  'Stooped Stance': 'dh1.quirkStoopedStance',
};

export const CAREER_KEYS: Record<string, string> = {
  Adept: 'dh1.careerAdept',
  Arbitrator: 'dh1.careerArbitrator',
  Assassin: 'dh1.careerAssassin',
  Cleric: 'dh1.careerCleric',
  Guardsman: 'dh1.careerGuardsman',
  'Imperial Psyker': 'dh1.careerImperialPsyker',
  Scum: 'dh1.careerScum',
  'Tech-Priest': 'dh1.careerTechPriest',
};

export const RANK_KEYS: Record<string, string> = {
  Archivist: 'dh1.rankArchivist',
  Scrivener: 'dh1.rankScrivener',
  Scribe: 'dh1.rankScribe',
  Inditor: 'dh1.rankInditor',
  Scholar: 'dh1.rankScholar',
  Chirurgeon: 'dh1.rankChirurgeon',
  Comptroller: 'dh1.rankComptroller',
  'Logister Comptroller': 'dh1.rankLogisterComptroller',
  'Sage Logister': 'dh1.rankSageLogister',
  Lexographer: 'dh1.rankLexographer',
  'Loremaster Lexographer': 'dh1.rankLoremasterLexographer',
  'Loremaster Magister': 'dh1.rankLoremasterMagister',
  Trooper: 'dh1.rankTrooper',
  Enforcer: 'dh1.rankEnforcer',
  Regulator: 'dh1.rankRegulator',
  Investigator: 'dh1.rankInvestigator',
  Arbitrator: 'dh1.rankArbitrator',
  Proctor: 'dh1.rankProctor',
  Marshal: 'dh1.rankMarshal',
  'Lord Marshal': 'dh1.rankLordMarshal',
  Intelligencer: 'dh1.rankIntelligencer',
  Magistrate: 'dh1.rankMagistrate',
  Justicar: 'dh1.rankJusticar',
  'Sell-Steel': 'dh1.rankSellSteel',
  Shadesman: 'dh1.rankShadesman',
  Nighthawk: 'dh1.rankNighthawk',
  Secluse: 'dh1.rankSecluse',
  Assassin: 'dh1.rankAssassin',
  'Death Adept': 'dh1.rankDeathAdept',
  Nihilator: 'dh1.rankNihilator',
  'Imperator-Mortis': 'dh1.rankImperatorMortis',
  Freeblade: 'dh1.rankFreeblade',
  'Assassin at Marque': 'dh1.rankAssassinAtMarque',
  'Assassin Palatine': 'dh1.rankAssassinPalatine',
  Novice: 'dh1.rankNovice',
  Initiate: 'dh1.rankInitiate',
  Priest: 'dh1.rankPriest',
  Preacher: 'dh1.rankPreacher',
  Cleric: 'dh1.rankCleric',
  Exorcist: 'dh1.rankExorcist',
  Zealot: 'dh1.rankZealot',
  Redemptionist: 'dh1.rankRedemptionist',
  Confessor: 'dh1.rankConfessor',
  Bishop: 'dh1.rankBishop',
  Hierophant: 'dh1.rankHierophant',
  Conscript: 'dh1.rankConscript',
  Guard: 'dh1.rankGuard',
  Armsman: 'dh1.rankArmsman',
  Sergeant: 'dh1.rankSergeant',
  Veteran: 'dh1.rankVeteran',
  'Assault Veteran': 'dh1.rankAssaultVeteran',
  Shocktrooper: 'dh1.rankShocktrooper',
  Stormtrooper: 'dh1.rankStormtrooper',
  Lieutenant: 'dh1.rankLieutenant',
  Captain: 'dh1.rankCaptain',
  Commander: 'dh1.rankCommander',
  Scout: 'dh1.rankScout',
  Marksman: 'dh1.rankMarksman',
  Sniper: 'dh1.rankSniper',
  Sanctionite: 'dh1.rankSanctionite',
  Neonate: 'dh1.rankNeonate',
  Aspirant: 'dh1.rankAspirant',
  'Savant Militant': 'dh1.rankSavantMilitant',
  'Warrant-Savant': 'dh1.rankWarrantSavant',
  'Lieutenant-Savant': 'dh1.rankLieutenantSavant',
  'Savant Adjunct': 'dh1.rankSavantAdjunct',
  'Savant-Preceptor': 'dh1.rankSavantPreceptor',
  'Scholar Materium': 'dh1.rankScholarMaterium',
  'Scholar Medicae': 'dh1.rankScholarMedicae',
  'Scholar Arcanum': 'dh1.rankScholarArcanum',
  'Scholar Obscurus': 'dh1.rankScholarObscurus',
  'Scholar Empyrean': 'dh1.rankScholarEmpyrean',
  Dreg: 'dh1.rankDreg',
  Outcast: 'dh1.rankOutcast',
  Outlaw: 'dh1.rankOutlaw',
  Renegade: 'dh1.rankRenegade',
  Rogue: 'dh1.rankRogue',
  Fixer: 'dh1.rankFixer',
  Shark: 'dh1.rankShark',
  Charlatan: 'dh1.rankCharlatan',
  Cutter: 'dh1.rankCutter',
  Stubjack: 'dh1.rankStubjack',
  'Gang Lord': 'dh1.rankGangLord',
  Technographer: 'dh1.rankTechnographer',
  'Mech-Wright': 'dh1.rankMechWright',
  'Electro-Priest': 'dh1.rankElectroPriest',
  Engineer: 'dh1.rankEngineer',
  'Tech-Priest': 'dh1.rankTechPriest',
  Technomancer: 'dh1.rankTechnomancer',
  'Cyber-Seer': 'dh1.rankCyberSeer',
  Magos: 'dh1.rankMagos',
  Heretek: 'dh1.rankHeretek',
  'Mech-Deacon': 'dh1.rankMechDeacon',
  Omniprophet: 'dh1.rankOmniprophet',
  'Magos Errant': 'dh1.rankMagosErrant',
};

/**
 * Стартовые данные создания персонажа 1e.
 *
 * Значения — из Таблиц 1-3 (напыление характеристик), 1-6 (раны), 1-7
 * (судьба) и 1-9 (богатство). Приложение показывает их как подсказку:
 * бросок делает игрок, автогенерации нет.
 */
export interface WorldStartingProfile {
  /** База характеристик из Таблицы 1-3. */
  characteristics: {
    weaponSkill: number;
    ballisticSkill: number;
    strength: number;
    toughness: number;
    agility: number;
    intelligence: number;
    perception: number;
    willpower: number;
    fellowship: number;
  };
  /** Формула ран из Таблицы 1-6. */
  wounds: string;
  /** Диапазоны Очков Судьбы из Таблицы 1-7. */
  fate: string;
}

export const WORLD_STARTING_PROFILE: Record<string, WorldStartingProfile> = {
  'Feral World': {
    characteristics: {
      weaponSkill: 20,
      ballisticSkill: 20,
      strength: 25,
      toughness: 25,
      agility: 20,
      intelligence: 20,
      perception: 20,
      willpower: 15,
      fellowship: 15,
    },
    wounds: '1d5+9',
    fate: '1–4: 1, 5–8: 2, 9–10: 2',
  },
  'Hive World': {
    characteristics: {
      weaponSkill: 20,
      ballisticSkill: 20,
      strength: 20,
      toughness: 15,
      agility: 20,
      intelligence: 20,
      perception: 20,
      willpower: 20,
      fellowship: 25,
    },
    wounds: '1d5+8',
    fate: '1–4: 1, 5–8: 2, 9–10: 3',
  },
  'Imperial World': {
    characteristics: {
      weaponSkill: 20,
      ballisticSkill: 20,
      strength: 20,
      toughness: 20,
      agility: 20,
      intelligence: 20,
      perception: 20,
      willpower: 20,
      fellowship: 20,
    },
    wounds: '1d5+8',
    fate: '1–4: 2, 5–8: 2, 9–10: 3',
  },
  'Void Born': {
    characteristics: {
      weaponSkill: 20,
      ballisticSkill: 20,
      strength: 15,
      toughness: 20,
      agility: 20,
      intelligence: 20,
      perception: 20,
      willpower: 25,
      fellowship: 20,
    },
    wounds: '1d5+6',
    fate: '1–4: 2, 5–8: 3, 9–10: 3',
  },
  'Forge World': {
    characteristics: {
      weaponSkill: 15,
      ballisticSkill: 20,
      strength: 20,
      toughness: 20,
      agility: 20,
      intelligence: 25,
      perception: 20,
      willpower: 20,
      fellowship: 20,
    },
    wounds: '1d5+7',
    fate: '1–5: 1, 6–9: 2, 10: 3',
  },
  'Schola Progenium': {
    characteristics: {
      weaponSkill: 20,
      ballisticSkill: 20,
      strength: 20,
      toughness: 20,
      agility: 20,
      intelligence: 20,
      perception: 20,
      willpower: 20,
      fellowship: 20,
    },
    wounds: '1d5+8',
    fate: '1–2: 1, 3–7: 2, 8–10: 3',
  },
  'Noble Born': {
    characteristics: {
      weaponSkill: 20,
      ballisticSkill: 20,
      strength: 20,
      toughness: 20,
      agility: 20,
      intelligence: 20,
      perception: 20,
      willpower: 15,
      fellowship: 25,
    },
    wounds: '1d5+8',
    fate: '1–4: 1, 5–8: 2, 9–10: 3',
  },
  'Mind-Cleared': {
    characteristics: {
      weaponSkill: 20,
      ballisticSkill: 20,
      strength: 20,
      toughness: 20,
      agility: 20,
      intelligence: 20,
      perception: 20,
      willpower: 25,
      fellowship: 15,
    },
    wounds: '1d5+8',
    fate: '1–3: 2, 4–9: 3, 10: 4',
  },
};

/** Диапазон стартового значения: формулу/таблицу читает игрок, минимум — дефолт. */
export interface StartingRange {
  min: number;
  max: number;
}

/**
 * Минимум и максимум формулы ран 1e: `1d5+9` → 10–14. Нужны, чтобы форма
 * предзаполняла минимум и показывала диапазон, а не 10/1 «из воздуха».
 */
export function woundsRangeFromFormula(
  formula: string,
): StartingRange | undefined {
  const match = formula.match(/^(\d*)d(\d+)(?:\+(\d+))?$/i);
  if (!match) return undefined;
  const dice = match[1] ? Number(match[1]) : 1;
  const sides = Number(match[2]);
  const bonus = match[3] ? Number(match[3]) : 0;
  return { min: dice + bonus, max: dice * sides + bonus };
}

/**
 * Минимум и максимум Очков Судьбы 1e из текста таблицы 1-7:
 * `1–4: 1, 5–8: 2, 9–10: 3` → 1–3.
 */
export function fateRangeFromText(text: string): StartingRange | undefined {
  const values = [...text.matchAll(/:\s*(\d+)/g)].map((match) =>
    Number(match[1]),
  );
  if (values.length === 0) return undefined;
  return { min: Math.min(...values), max: Math.max(...values) };
}

/** Стартовый опыт всех персонажей 1e (Таблица 1-9, стр. 43). */
export const STARTING_EXPERIENCE = 400;

/** Стартовое богатство по профессии (Таблица 1-9, стр. 43). */
export const STARTING_WEALTH: Record<string, string> = {
  Adept: '100+1d10',
  Arbitrator: '50+2d10',
  Assassin: '120+3d10',
  Cleric: '300+5d10',
  Guardsman: '70+1d10',
  'Imperial Psyker': '50+1d5',
  Scum: '10+1d5',
  'Tech-Priest': '150+1d10',
};
