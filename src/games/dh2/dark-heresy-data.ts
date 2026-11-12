/**
 * ─── LANDMARK: DH2 DATA PACK ───────────────────────────────────────────────
 * Данные (карьеры, пророчества, эффекты) редакции Dark Heresy 2, живущие внутри плагина
 * (решение D10). Изначально это была копия `src/lib/dark-heresy-data.ts` (этап 0);
 * редакции считаются разными, даже если сейчас содержимое совпадает, —
 * правки dh2 не должны менять dh1, и наоборот.
 * Теперь lib-копии нет: источник — здесь. Общего data-плагина нет.
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
 * (`dh2.*`), поэтому функция — no-op. Оставлена, чтобы старые вызовы
 * `dhLocalizedKey(key, edition)` не переписывались; ключи `dh.*` больше не
 * существуют в словарях (иначе это «сырой ключ» в UI).
 */
export function dhLocalizedKey(
  key: string,
  _edition?: 'dh2' | 'dh1' | 'dh2',
): string {
  return key;
}

export const HOME_WORLD_KEYS: Record<string, string> = {
  'Feral World': 'dh2.homeWorldFeral',
  'Hive World': 'dh2.homeWorldHive',
  'Imperial World': 'dh2.homeWorldImperial',
  'Void Born': 'dh2.homeWorldVoidBorn',
  'Forge World': 'dh2.homeWorldForge',
};

export const VARIANT_KEYS: Record<string, string> = {
  'Agri-World': 'dh2.variantAgriWorld',
  Backwater: 'dh2.variantBackwater',
  'Feudal World': 'dh2.variantFeudalWorld',
  'War Zone': 'dh2.variantWarZone',
  'Dead Planet': 'dh2.variantDeadPlanet',
  'Shrine World': 'dh2.variantShrineWorld',
  'Paradise World': 'dh2.variantParadiseWorld',
  'Dirt Ward': 'dh2.variantDirtWard',
  'Unlucky Colour': 'dh2.variantUnluckyColour',
  "Hunter's Oath": 'dh2.variantHuntersOath',
  'Thirsty Blade': 'dh2.variantThirstyBlade',
  'Spirit Shackle': 'dh2.variantSpiritShackle',
  'Warrior Death': 'dh2.variantWarriorDeath',
  'Power of Names': 'dh2.variantPowerOfNames',
  'Lonely Dead': 'dh2.variantLonelyDead',
  'Living Record': 'dh2.variantLivingRecord',
  Nemesis: 'dh2.variantNemesis',
  'Dross Hound': 'dh2.variantDrossHound',
  'Ganger Scum': 'dh2.variantGangerScum',
  'Factory Dregs': 'dh2.variantFactoryDregs',
  'Middle Hive': 'dh2.variantMiddleHive',
  Specialist: 'dh2.variantSpecialist',
  'Hive Noble': 'dh2.variantHiveNoble',
  'Space Hulk': 'dh2.variantSpaceHulk',
  Orbital: 'dh2.variantOrbital',
  'Chartist Vessel': 'dh2.variantChartistVessel',
  'Rogue Trader': 'dh2.variantRogueTrader',
  'Great Forge World': 'dh2.variantGreatForgeWorld',
  'Minor Forge World': 'dh2.variantMinorForgeWorld',
  Orbit: 'dh2.variantForgeOrbit',
  Territory: 'dh2.variantTerritory',
  'Research Outpost': 'dh2.variantResearchOutpost',
  'Explorator Fleet': 'dh2.variantExploratorFleet',
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
  'Hairy Knuckles': 'dh2.quirkHairyKnuckles',
  'Joined Eyebrows': 'dh2.quirkJoinedEyebrows',
  Warpaint: 'dh2.quirkWarpaint',
  'Hands like Spatchcocks': 'dh2.quirkHandsLikeSpatchcocks',
  'Filed Teeth': 'dh2.quirkFiledTeeth',
  'Beetling Brows': 'dh2.quirkBeetlingBrows',
  'Musky Smell': 'dh2.quirkMuskySmell',
  Hairy: 'dh2.quirkHairy',
  'Ripped Ears': 'dh2.quirkRippedEars',
  'Long Fingernails': 'dh2.quirkLongFingernails',
  'Tribal Tattooing': 'dh2.quirkTribalTattooing',
  Scarring: 'dh2.quirkScarring',
  Piercing: 'dh2.quirkPiercing',
  'Cat’s Eyes': 'dh2.quirkCatsEyes',
  'Small Head': 'dh2.quirkSmallHead',
  'Thick Jaw': 'dh2.quirkThickJaw',
  Pallid: 'dh2.quirkPallid',
  'Grimy Skin': 'dh2.quirkGrimySkin',
  'Outrageous Hair': 'dh2.quirkOutrageousHair',
  'Rotten Teeth': 'dh2.quirkRottenTeeth',
  Electoo: 'dh2.quirkElectoo',
  'Set of Piercings': 'dh2.quirkSetOfPiercings',
  'Hacking Cough': 'dh2.quirkHackingCough',
  Tattoos: 'dh2.quirkTattoos',
  'Bullet Wound Scar': 'dh2.quirkBulletWoundScar',
  'Nervous Tic': 'dh2.quirkNervousTic',
  'Large Mole': 'dh2.quirkLargeMole',
  'Pollution Scars': 'dh2.quirkPollutionScars',
  Hump: 'dh2.quirkHump',
  'Small Hands': 'dh2.quirkSmallHands',
  'Chemical Smell': 'dh2.quirkChemicalSmell',
  'Missing Digit': 'dh2.quirkMissingDigit',
  'Aquiline Nose': 'dh2.quirkAquilineNose',
  Warts: 'dh2.quirkWarts',
  'Duelling Scar': 'dh2.quirkDuellingScar',
  'Pierced Nose': 'dh2.quirkPiercedNose',
  'Aquila Tattoo': 'dh2.quirkAquilaTattoo',
  'Faint Smell': 'dh2.quirkFaintSmell',
  'Pox Marks': 'dh2.quirkPoxMarks',
  'Devotional Scar': 'dh2.quirkDevotionalScar',
  'Quivering Fingers': 'dh2.quirkQuiveringFingers',
  'Pierced Ears': 'dh2.quirkPiercedEars',
  'Sinister Boil': 'dh2.quirkSinisterBoil',
  'Make-up': 'dh2.quirkMakeup',
  'Slouched Gait': 'dh2.quirkSlouchedGait',
  Bald: 'dh2.quirkBald',
  'Long Fingers': 'dh2.quirkLongFingers',
  'Tiny Ears': 'dh2.quirkTinyEars',
  'Spindly Limbs': 'dh2.quirkSpindlyLimbs',
  'Yellow Fingernails': 'dh2.quirkYellowFingernails',
  'Stumpy Teeth': 'dh2.quirkStumpyTeeth',
  'Widely Spaced Eyes': 'dh2.quirkWidelySpacedEyes',
  'Large Head': 'dh2.quirkLargeHead',
  'Curved Spine': 'dh2.quirkCurvedSpine',
  Hairless: 'dh2.quirkHairless',
  'Elegant Hands': 'dh2.quirkElegantHands',
  'Flowing Hair': 'dh2.quirkFlowingHair',
  Albino: 'dh2.quirkAlbino',
  'Limping Gait': 'dh2.quirkLimpingGait',
  'Stooped Stance': 'dh2.quirkStoopedStance',
};

export const CAREER_KEYS: Record<string, string> = {
  Adept: 'dh2.careerAdept',
  Arbitrator: 'dh2.careerArbitrator',
  Assassin: 'dh2.careerAssassin',
  Cleric: 'dh2.careerCleric',
  Guardsman: 'dh2.careerGuardsman',
  'Imperial Psyker': 'dh2.careerImperialPsyker',
  Scum: 'dh2.careerScum',
  'Tech-Priest': 'dh2.careerTechPriest',
};

export const RANK_KEYS: Record<string, string> = {
  Archivist: 'dh2.rankArchivist',
  Scrivener: 'dh2.rankScrivener',
  Scribe: 'dh2.rankScribe',
  Inditor: 'dh2.rankInditor',
  Scholar: 'dh2.rankScholar',
  Chirurgeon: 'dh2.rankChirurgeon',
  Comptroller: 'dh2.rankComptroller',
  'Logister Comptroller': 'dh2.rankLogisterComptroller',
  'Sage Logister': 'dh2.rankSageLogister',
  Lexographer: 'dh2.rankLexographer',
  'Loremaster Lexographer': 'dh2.rankLoremasterLexographer',
  'Loremaster Magister': 'dh2.rankLoremasterMagister',
  Trooper: 'dh2.rankTrooper',
  Enforcer: 'dh2.rankEnforcer',
  Regulator: 'dh2.rankRegulator',
  Investigator: 'dh2.rankInvestigator',
  Arbitrator: 'dh2.rankArbitrator',
  Proctor: 'dh2.rankProctor',
  Marshal: 'dh2.rankMarshal',
  'Lord Marshal': 'dh2.rankLordMarshal',
  Intelligencer: 'dh2.rankIntelligencer',
  Magistrate: 'dh2.rankMagistrate',
  Justicar: 'dh2.rankJusticar',
  'Sell-Steel': 'dh2.rankSellSteel',
  Shadesman: 'dh2.rankShadesman',
  Nighthawk: 'dh2.rankNighthawk',
  Secluse: 'dh2.rankSecluse',
  Assassin: 'dh2.rankAssassin',
  'Death Adept': 'dh2.rankDeathAdept',
  Nihilator: 'dh2.rankNihilator',
  'Imperator-Mortis': 'dh2.rankImperatorMortis',
  Freeblade: 'dh2.rankFreeblade',
  'Assassin at Marque': 'dh2.rankAssassinAtMarque',
  'Assassin Palatine': 'dh2.rankAssassinPalatine',
  Novice: 'dh2.rankNovice',
  Initiate: 'dh2.rankInitiate',
  Priest: 'dh2.rankPriest',
  Preacher: 'dh2.rankPreacher',
  Cleric: 'dh2.rankCleric',
  Exorcist: 'dh2.rankExorcist',
  Zealot: 'dh2.rankZealot',
  Redemptionist: 'dh2.rankRedemptionist',
  Confessor: 'dh2.rankConfessor',
  Bishop: 'dh2.rankBishop',
  Hierophant: 'dh2.rankHierophant',
  Conscript: 'dh2.rankConscript',
  Guard: 'dh2.rankGuard',
  Armsman: 'dh2.rankArmsman',
  Sergeant: 'dh2.rankSergeant',
  Veteran: 'dh2.rankVeteran',
  'Assault Veteran': 'dh2.rankAssaultVeteran',
  Shocktrooper: 'dh2.rankShocktrooper',
  Stormtrooper: 'dh2.rankStormtrooper',
  Lieutenant: 'dh2.rankLieutenant',
  Captain: 'dh2.rankCaptain',
  Commander: 'dh2.rankCommander',
  Scout: 'dh2.rankScout',
  Marksman: 'dh2.rankMarksman',
  Sniper: 'dh2.rankSniper',
  Sanctionite: 'dh2.rankSanctionite',
  Neonate: 'dh2.rankNeonate',
  Aspirant: 'dh2.rankAspirant',
  'Savant Militant': 'dh2.rankSavantMilitant',
  'Warrant-Savant': 'dh2.rankWarrantSavant',
  'Lieutenant-Savant': 'dh2.rankLieutenantSavant',
  'Savant Adjunct': 'dh2.rankSavantAdjunct',
  'Savant-Preceptor': 'dh2.rankSavantPreceptor',
  'Scholar Materium': 'dh2.rankScholarMaterium',
  'Scholar Medicae': 'dh2.rankScholarMedicae',
  'Scholar Arcanum': 'dh2.rankScholarArcanum',
  'Scholar Obscurus': 'dh2.rankScholarObscurus',
  'Scholar Empyrean': 'dh2.rankScholarEmpyrean',
  Dreg: 'dh2.rankDreg',
  Outcast: 'dh2.rankOutcast',
  Outlaw: 'dh2.rankOutlaw',
  Renegade: 'dh2.rankRenegade',
  Rogue: 'dh2.rankRogue',
  Fixer: 'dh2.rankFixer',
  Shark: 'dh2.rankShark',
  Charlatan: 'dh2.rankCharlatan',
  Cutter: 'dh2.rankCutter',
  Stubjack: 'dh2.rankStubjack',
  'Gang Lord': 'dh2.rankGangLord',
  Technographer: 'dh2.rankTechnographer',
  'Mech-Wright': 'dh2.rankMechWright',
  'Electro-Priest': 'dh2.rankElectroPriest',
  Engineer: 'dh2.rankEngineer',
  'Tech-Priest': 'dh2.rankTechPriest',
  Technomancer: 'dh2.rankTechnomancer',
  'Cyber-Seer': 'dh2.rankCyberSeer',
  Magos: 'dh2.rankMagos',
  Heretek: 'dh2.rankHeretek',
  'Mech-Deacon': 'dh2.rankMechDeacon',
  Omniprophet: 'dh2.rankOmniprophet',
  'Magos Errant': 'dh2.rankMagosErrant',
};
