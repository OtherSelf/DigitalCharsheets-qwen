/**
 * ─── LANDMARK: DH1 DATA PACK ───────────────────────────────────────────────
 * Данные (карьеры, пророчества, эффекты) редакции Dark Heresy 1, живущие внутри плагина
 * (решение D10). Это осознанная копия `src/lib/dark-heresy-data.ts`:
 * редакции считаются разными, даже если сейчас содержимое совпадает, —
 * правки dh1 не должны менять dh2, и наоборот.
 * Общего data-плагина нет.
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
    divination: 'Mutation without, corruption within.',
    effectId: 'minorMutation',
    effect: 'Minor Mutation.',
  },
  {
    id: 'onlyTheInsane',
    divination:
      'Only the insane have strength enough to prosper. Only those who prosper may judge what is sane.',
    effectId: 'insanity2',
    effect: '+2 Insanity Points.',
  },
  {
    id: 'sinsHidden',
    divination: 'Sins hidden in the heart turn all to decay.',
    effectId: 'corruption3',
    effect: '+3 Corruption Points.',
  },
  {
    id: 'innocenceIllusion',
    divination: 'Innocence is an illusion.',
    effectId: 'insanity1Corruption1',
    effect: '+1 Insanity Point, +1 Corruption Point.',
  },
  {
    id: 'darkDreams',
    divination: 'Dark dreams lie upon the heart.',
    effectId: 'insanity2',
    effect: '+2 Insanity Points.',
  },
  {
    id: 'painOfBullet',
    divination: 'The pain of the bullet is ecstasy compared to damnation.',
    effectId: 'toughness1',
    effect: '+1 Toughness.',
  },
  {
    id: 'killTheAlien',
    divination: 'Kill the alien before it can speak its lies.',
    effectId: 'agility2',
    effect: '+2 Agility.',
  },
  {
    id: 'truthSubjective',
    divination: 'Truth is subjective.',
    effectId: 'intelligence3Corruption3',
    effect: '+3 Intelligence, +3 Corruption Points.',
  },
  {
    id: 'knowTheMutant',
    divination: 'Know the mutant; kill the mutant.',
    effectId: 'perception2',
    effect: '+2 Perception.',
  },
  {
    id: 'offerHisLife',
    divination: 'Even a man who has nothing can still offer his life.',
    effectId: 'strength2',
    effect: '+2 Strength.',
  },
  {
    id: 'jobWorthDying',
    divination: 'If a job is worth doing it is worth dying for.',
    effectId: 'frenzyTalent',
    effect: '"Frenzy" talent.',
  },
  {
    id: 'onlyInDeath',
    divination: 'Only in death does duty end.',
    effectId: 'wound1',
    effect: '+1 Wound.',
  },
  {
    id: 'mindWithoutPurpose',
    divination: 'A mind without purpose will wander in dark places.',
    effectId: 'fate1',
    effect: '+1 Fate Point.',
  },
  {
    id: 'noCivilians',
    divination: 'There are no civilians in the battle for survival.',
    effectId: 'toughness2Wound1',
    effect: '+2 Toughness, +1 Wound.',
  },
  {
    id: 'violenceSolves',
    divination: 'Violence solves everything.',
    effectId: 'weaponSkill3',
    effect: '+3 Weapon Skill.',
  },
  {
    id: 'toWarHuman',
    divination: 'To war is human.',
    effectId: 'agility3',
    effect: '+3 Agility.',
  },
  {
    id: 'spiritNotBroken',
    divination: 'Die if you must, but not with your spirit broken.',
    effectId: 'willpower3',
    effect: '+3 Willpower.',
  },
  {
    id: 'gunMightier',
    divination: 'The gun is mightier than the sword.',
    effectId: 'ballisticSkill3',
    effect: '+3 Ballistic Skill.',
  },
  {
    id: 'boonToBrothers',
    divination: 'Be a boon to your brothers and bane to your enemies.',
    effectId: 'fellowship3',
    effect: '+3 Fellowship.',
  },
  {
    id: 'menMustDie',
    divination: 'Men must die so that Man endures.',
    effectId: 'toughness3',
    effect: '+3 Toughness.',
  },
  {
    id: 'darknessLightOfTerra',
    divination: 'In the darkness, follow the light of Terra.',
    effectId: 'willpower3',
    effect: '+3 Willpower.',
  },
  {
    id: 'onlyTrueFear',
    divination: 'The only true fear is of dying with your duty not done.',
    effectId: 'wounds2',
    effect: '+2 Wounds.',
  },
  {
    id: 'thoughtBegetsHeresy',
    divination: 'Thought begets Heresy; Heresy begets Retribution.',
    effectId: 'strength3',
    effect: '+3 Strength.',
  },
  {
    id: 'wiseManLearns',
    divination: 'The wise man learns from the deaths of others.',
    effectId: 'intelligence3',
    effect: '+3 Intelligence.',
  },
  {
    id: 'suspiciousMind',
    divination: 'A suspicious mind is a healthy mind.',
    effectId: 'perception3',
    effect: '+3 Perception.',
  },
  {
    id: 'trustYourFear',
    divination: 'Trust in your fear.',
    effectId: 'agility2Fate1',
    effect: '+2 Agility, +1 Fate Point.',
  },
  {
    id: 'noSubstituteForZeal',
    divination: 'There is no substitute for zeal.',
    effectId: 'toughness2Willpower2',
    effect: '+2 Toughness, +2 Willpower.',
  },
  {
    id: 'askHowNotWhy',
    divination: 'Do not ask why you serve. Only ask how.',
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
};

export const WORLD_VARIANT_LABELS: Record<string, string> = {
  'Feral World': 'Tribal Taboos',
  'Hive World': 'Hive Class',
  'Imperial World': 'Birth Planet',
  'Void Born': 'Ship Tradition',
  'Forge World': 'Place of Birth',
};

/** Ключ данных в пространстве конкретной редакции: dh.* → dh1 или dh2. */
export function dhLocalizedKey(key: string, edition: 'dh1' | 'dh2'): string {
  return key.startsWith('dh.') ? `${edition}.${key.slice(3)}` : key;
}

export const HOME_WORLD_KEYS: Record<string, string> = {
  'Feral World': 'dh.homeWorldFeral',
  'Hive World': 'dh.homeWorldHive',
  'Imperial World': 'dh.homeWorldImperial',
  'Void Born': 'dh.homeWorldVoidBorn',
  'Forge World': 'dh.homeWorldForge',
};

export const VARIANT_KEYS: Record<string, string> = {
  'Agri-World': 'dh.variantAgriWorld',
  Backwater: 'dh.variantBackwater',
  'Feudal World': 'dh.variantFeudalWorld',
  'War Zone': 'dh.variantWarZone',
  'Dead Planet': 'dh.variantDeadPlanet',
  'Shrine World': 'dh.variantShrineWorld',
  'Paradise World': 'dh.variantParadiseWorld',
  'Dirt Ward': 'dh.variantDirtWard',
  'Unlucky Colour': 'dh.variantUnluckyColour',
  "Hunter's Oath": 'dh.variantHuntersOath',
  'Thirsty Blade': 'dh.variantThirstyBlade',
  'Spirit Shackle': 'dh.variantSpiritShackle',
  'Warrior Death': 'dh.variantWarriorDeath',
  'Power of Names': 'dh.variantPowerOfNames',
  'Lonely Dead': 'dh.variantLonelyDead',
  'Living Record': 'dh.variantLivingRecord',
  Nemesis: 'dh.variantNemesis',
  'Dross Hound': 'dh.variantDrossHound',
  'Ganger Scum': 'dh.variantGangerScum',
  'Factory Dregs': 'dh.variantFactoryDregs',
  'Middle Hive': 'dh.variantMiddleHive',
  Specialist: 'dh.variantSpecialist',
  'Hive Noble': 'dh.variantHiveNoble',
  'Space Hulk': 'dh.variantSpaceHulk',
  Orbital: 'dh.variantOrbital',
  'Chartist Vessel': 'dh.variantChartistVessel',
  'Rogue Trader': 'dh.variantRogueTrader',
  'Great Forge World': 'dh.variantGreatForgeWorld',
  'Minor Forge World': 'dh.variantMinorForgeWorld',
  Orbit: 'dh.variantForgeOrbit',
  Territory: 'dh.variantTerritory',
  'Research Outpost': 'dh.variantResearchOutpost',
  'Explorator Fleet': 'dh.variantExploratorFleet',
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
  'Hairy Knuckles': 'dh.quirkHairyKnuckles',
  'Joined Eyebrows': 'dh.quirkJoinedEyebrows',
  Warpaint: 'dh.quirkWarpaint',
  'Hands like Spatchcocks': 'dh.quirkHandsLikeSpatchcocks',
  'Filed Teeth': 'dh.quirkFiledTeeth',
  'Beetling Brows': 'dh.quirkBeetlingBrows',
  'Musky Smell': 'dh.quirkMuskySmell',
  Hairy: 'dh.quirkHairy',
  'Ripped Ears': 'dh.quirkRippedEars',
  'Long Fingernails': 'dh.quirkLongFingernails',
  'Tribal Tattooing': 'dh.quirkTribalTattooing',
  Scarring: 'dh.quirkScarring',
  Piercing: 'dh.quirkPiercing',
  'Cat’s Eyes': 'dh.quirkCatsEyes',
  'Small Head': 'dh.quirkSmallHead',
  'Thick Jaw': 'dh.quirkThickJaw',
  Pallid: 'dh.quirkPallid',
  'Grimy Skin': 'dh.quirkGrimySkin',
  'Outrageous Hair': 'dh.quirkOutrageousHair',
  'Rotten Teeth': 'dh.quirkRottenTeeth',
  Electoo: 'dh.quirkElectoo',
  'Set of Piercings': 'dh.quirkSetOfPiercings',
  'Hacking Cough': 'dh.quirkHackingCough',
  Tattoos: 'dh.quirkTattoos',
  'Bullet Wound Scar': 'dh.quirkBulletWoundScar',
  'Nervous Tic': 'dh.quirkNervousTic',
  'Large Mole': 'dh.quirkLargeMole',
  'Pollution Scars': 'dh.quirkPollutionScars',
  Hump: 'dh.quirkHump',
  'Small Hands': 'dh.quirkSmallHands',
  'Chemical Smell': 'dh.quirkChemicalSmell',
  'Missing Digit': 'dh.quirkMissingDigit',
  'Aquiline Nose': 'dh.quirkAquilineNose',
  Warts: 'dh.quirkWarts',
  'Duelling Scar': 'dh.quirkDuellingScar',
  'Pierced Nose': 'dh.quirkPiercedNose',
  'Aquila Tattoo': 'dh.quirkAquilaTattoo',
  'Faint Smell': 'dh.quirkFaintSmell',
  'Pox Marks': 'dh.quirkPoxMarks',
  'Devotional Scar': 'dh.quirkDevotionalScar',
  'Quivering Fingers': 'dh.quirkQuiveringFingers',
  'Pierced Ears': 'dh.quirkPiercedEars',
  'Sinister Boil': 'dh.quirkSinisterBoil',
  'Make-up': 'dh.quirkMakeup',
  'Slouched Gait': 'dh.quirkSlouchedGait',
  Bald: 'dh.quirkBald',
  'Long Fingers': 'dh.quirkLongFingers',
  'Tiny Ears': 'dh.quirkTinyEars',
  'Spindly Limbs': 'dh.quirkSpindlyLimbs',
  'Yellow Fingernails': 'dh.quirkYellowFingernails',
  'Stumpy Teeth': 'dh.quirkStumpyTeeth',
  'Widely Spaced Eyes': 'dh.quirkWidelySpacedEyes',
  'Large Head': 'dh.quirkLargeHead',
  'Curved Spine': 'dh.quirkCurvedSpine',
  Hairless: 'dh.quirkHairless',
  'Elegant Hands': 'dh.quirkElegantHands',
  'Flowing Hair': 'dh.quirkFlowingHair',
  Albino: 'dh.quirkAlbino',
  'Limping Gait': 'dh.quirkLimpingGait',
  'Stooped Stance': 'dh.quirkStoopedStance',
};

export const CAREER_KEYS: Record<string, string> = {
  Adept: 'dh.careerAdept',
  Arbitrator: 'dh.careerArbitrator',
  Assassin: 'dh.careerAssassin',
  Cleric: 'dh.careerCleric',
  Guardsman: 'dh.careerGuardsman',
  'Imperial Psyker': 'dh.careerImperialPsyker',
  Scum: 'dh.careerScum',
  'Tech-Priest': 'dh.careerTechPriest',
};

export const RANK_KEYS: Record<string, string> = {
  Archivist: 'dh.rankArchivist',
  Scrivener: 'dh.rankScrivener',
  Scribe: 'dh.rankScribe',
  Inditor: 'dh.rankInditor',
  Scholar: 'dh.rankScholar',
  Chirurgeon: 'dh.rankChirurgeon',
  Comptroller: 'dh.rankComptroller',
  'Logister Comptroller': 'dh.rankLogisterComptroller',
  'Sage Logister': 'dh.rankSageLogister',
  Lexographer: 'dh.rankLexographer',
  'Loremaster Lexographer': 'dh.rankLoremasterLexographer',
  'Loremaster Magister': 'dh.rankLoremasterMagister',
  Trooper: 'dh.rankTrooper',
  Enforcer: 'dh.rankEnforcer',
  Regulator: 'dh.rankRegulator',
  Investigator: 'dh.rankInvestigator',
  Arbitrator: 'dh.rankArbitrator',
  Proctor: 'dh.rankProctor',
  Marshal: 'dh.rankMarshal',
  'Lord Marshal': 'dh.rankLordMarshal',
  Intelligencer: 'dh.rankIntelligencer',
  Magistrate: 'dh.rankMagistrate',
  Justicar: 'dh.rankJusticar',
  'Sell-Steel': 'dh.rankSellSteel',
  Shadesman: 'dh.rankShadesman',
  Nighthawk: 'dh.rankNighthawk',
  Secluse: 'dh.rankSecluse',
  Assassin: 'dh.rankAssassin',
  'Death Adept': 'dh.rankDeathAdept',
  Nihilator: 'dh.rankNihilator',
  'Imperator-Mortis': 'dh.rankImperatorMortis',
  Freeblade: 'dh.rankFreeblade',
  'Assassin at Marque': 'dh.rankAssassinAtMarque',
  'Assassin Palatine': 'dh.rankAssassinPalatine',
  Novice: 'dh.rankNovice',
  Initiate: 'dh.rankInitiate',
  Priest: 'dh.rankPriest',
  Preacher: 'dh.rankPreacher',
  Cleric: 'dh.rankCleric',
  Exorcist: 'dh.rankExorcist',
  Zealot: 'dh.rankZealot',
  Redemptionist: 'dh.rankRedemptionist',
  Confessor: 'dh.rankConfessor',
  Bishop: 'dh.rankBishop',
  Hierophant: 'dh.rankHierophant',
  Conscript: 'dh.rankConscript',
  Guard: 'dh.rankGuard',
  Armsman: 'dh.rankArmsman',
  Sergeant: 'dh.rankSergeant',
  Veteran: 'dh.rankVeteran',
  'Assault Veteran': 'dh.rankAssaultVeteran',
  Shocktrooper: 'dh.rankShocktrooper',
  Stormtrooper: 'dh.rankStormtrooper',
  Lieutenant: 'dh.rankLieutenant',
  Captain: 'dh.rankCaptain',
  Commander: 'dh.rankCommander',
  Scout: 'dh.rankScout',
  Marksman: 'dh.rankMarksman',
  Sniper: 'dh.rankSniper',
  Sanctionite: 'dh.rankSanctionite',
  Neonate: 'dh.rankNeonate',
  Aspirant: 'dh.rankAspirant',
  'Savant Militant': 'dh.rankSavantMilitant',
  'Warrant-Savant': 'dh.rankWarrantSavant',
  'Lieutenant-Savant': 'dh.rankLieutenantSavant',
  'Savant Adjunct': 'dh.rankSavantAdjunct',
  'Savant-Preceptor': 'dh.rankSavantPreceptor',
  'Scholar Materium': 'dh.rankScholarMaterium',
  'Scholar Medicae': 'dh.rankScholarMedicae',
  'Scholar Arcanum': 'dh.rankScholarArcanum',
  'Scholar Obscurus': 'dh.rankScholarObscurus',
  'Scholar Empyrean': 'dh.rankScholarEmpyrean',
  Dreg: 'dh.rankDreg',
  Outcast: 'dh.rankOutcast',
  Outlaw: 'dh.rankOutlaw',
  Renegade: 'dh.rankRenegade',
  Rogue: 'dh.rankRogue',
  Fixer: 'dh.rankFixer',
  Shark: 'dh.rankShark',
  Charlatan: 'dh.rankCharlatan',
  Cutter: 'dh.rankCutter',
  Stubjack: 'dh.rankStubjack',
  'Gang Lord': 'dh.rankGangLord',
  Technographer: 'dh.rankTechnographer',
  'Mech-Wright': 'dh.rankMechWright',
  'Electro-Priest': 'dh.rankElectroPriest',
  Engineer: 'dh.rankEngineer',
  'Tech-Priest': 'dh.rankTechPriest',
  Technomancer: 'dh.rankTechnomancer',
  'Cyber-Seer': 'dh.rankCyberSeer',
  Magos: 'dh.rankMagos',
  Heretek: 'dh.rankHeretek',
  'Mech-Deacon': 'dh.rankMechDeacon',
  Omniprophet: 'dh.rankOmniprophet',
  'Magos Errant': 'dh.rankMagosErrant',
};
