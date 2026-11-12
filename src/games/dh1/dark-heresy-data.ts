/**
 * ─── LANDMARK: DH1 DATA PACK ───────────────────────────────────────────────
 * Данные (карьеры, пророчества, эффекты) редакции Dark Heresy 1, живущие внутри плагина
 * (решение D10). Копия, а не общий data-модуль: редакции считаются разными,
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
/**
 * Legacy-совместимость: карты DH уже содержат ключи конкретной редакции
 * (`dh1.*`), поэтому функция — no-op. Оставлена, чтобы старые вызовы
 * `dhLocalizedKey(key, edition)` не переписывались; ключи `dh.*` больше не
 * существуют в словарях (иначе это «сырой ключ» в UI).
 */
export function dhLocalizedKey(
  key: string,
  _edition?: 'dh1' | 'dh1' | 'dh2',
): string {
  return key;
}

export const HOME_WORLD_KEYS: Record<string, string> = {
  'Feral World': 'dh1.homeWorldFeral',
  'Hive World': 'dh1.homeWorldHive',
  'Imperial World': 'dh1.homeWorldImperial',
  'Void Born': 'dh1.homeWorldVoidBorn',
  'Forge World': 'dh1.homeWorldForge',
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
