export const DarkHeresyCareerPaths = ["Adept", "Arbitrator", "Assassin", "Cleric", "Guardsman", "Imperial Psyker", "Scum", "Tech-Priest"] as const;

export const DIVINATIONS = [
  { divination: 'Mutation without, corruption within.', effect: 'Minor Mutation.' },
  { divination: 'Only the insane have strength enough to prosper. Only those who prosper may judge what is sane.', effect: '+2 Insanity Points.' },
  { divination: 'Sins hidden in the heart turn all to decay.', effect: '+3 Corruption Points.' },
  { divination: 'Innocence is an illusion.', effect: '+1 Insanity Point, +1 Corruption Point.' },
  { divination: 'Dark dreams lie upon the heart.', effect: '+2 Corruption Points.' },
  { divination: 'The pain of the bullet is ecstasy compared to damnation.', effect: '+1 Toughness.' },
  { divination: 'Kill the alien before it can speak its lies.', effect: '+2 Agility.' },
  { divination: 'Truth is subjective.', effect: '+3 Intelligence, +3 Corruption Points.' },
  { divination: 'Know the mutant; kill the mutant.', effect: '+2 Perception.' },
  { divination: 'Even a man who has nothing can still offer his life.', effect: '+2 Strength.' },
  { divination: 'If a job is worth doing it is worth dying for.', effect: '"Frenzy" talent.' },
  { divination: 'Only in death does duty end.', effect: '+1 Wound.' },
  { divination: 'A mind without purpose will wander in dark places.', effect: '+1 Fate Point.' },
  { divination: 'There are no civilians in the battle for survival.', effect: '+2 Toughness, +1 Wound.' },
  { divination: 'Violence solves everything.', effect: '+3 Weapon Skill.' },
  { divination: 'To war is human.', effect: '+3 Agility.' },
  { divination: 'Die if you must, but not with your spirit broken.', effect: '+3 Willpower.' },
  { divination: 'The gun is mightier than the sword.', effect: '+3 Ballistic Skill.' },
  { divination: 'Be a boon to your brothers and bane to your enemies.', effect: '+3 Fellowship.' },
  { divination: 'Men must die so that Man endures.', effect: '+3 Toughness.' },
  { divination: 'In the darkness, follow the light of Terra.', effect: '+3 Willpower.' },
  { divination: 'The only true fear is of dying with your duty not done.', effect: '+2 Wounds.' },
  { divination: 'Thought begets Heresy; Heresy begets Retribution.', effect: '+3 Strength.' },
  { divination: 'The wise man learns from the deaths of others.', effect: '+3 Intelligence.' },
  { divination: 'A suspicious mind is a healthy mind.', effect: '+3 Perception.' },
  { divination: 'Trust in your fear.', effect: '+2 Agility, +1 Fate Point.' },
  { divination: 'There is no substitute for zeal.', effect: '+2 Toughness, +2 Willpower.' },
  { divination: 'Do not ask why you serve. Only ask how.', effect: '+2 Weapon Skill, +2 Ballistic Skill.' },
];

export const FERAL_WORLD_QUIRKS = [
  'Hairy Knuckles', 'Joined Eyebrows', 'Warpaint', 'Hands like Spatchcocks', 
  'Filed Teeth', 'Beetling Brows', 'Musky Smell', 'Hairy', 
  'Ripped Ears', 'Long Fingernails', 'Tribal Tattooing', 'Scarring', 
  'Piercing', 'Cat’s Eyes', 'Small Head', 'Thick Jaw'
];

export const HIVE_WORLD_QUIRKS = [
  'Pallid', 'Grimy Skin', 'Outrageous Hair', 'Rotten Teeth', 
  'Electoo', 'Piercing', 'Set of Piercings', 'Hacking Cough', 
  'Tattoos', 'Bullet Wound Scar', 'Nervous Tic', 'Large Mole', 
  'Pollution Scars', 'Hump', 'Small Hands', 'Chemical Smell'
];

export const IMPERIAL_WORLD_QUIRKS = [
  'Missing Digit', 'Aquiline Nose', 'Warts', 'Duelling Scar', 
  'Pierced Nose', 'Nervous Tic', 'Aquila Tattoo', 'Faint Smell', 
  'Pox Marks', 'Devotional Scar', 'Electoo', 'Quivering Fingers', 
  'Pierced Ears', 'Sinister Boil', 'Make-up', 'Slouched Gait'
];

export const VOID_BORN_QUIRKS = [
  'Pallid', 'Bald', 'Long Fingers', 'Tiny Ears', 
  'Spindly Limbs', 'Yellow Fingernails', 'Stumpy Teeth', 'Widely Spaced Eyes', 
  'Large Head', 'Curved Spine', 'Hairless', 'Elegant Hands', 
  'Flowing Hair', 'Albino', 'Limping Gait', 'Stooped Stance'
];

export const QUIRKS_BY_HOMEWORLD: Record<string, string[]> = {
  "Feral World": FERAL_WORLD_QUIRKS,
  "Hive World": HIVE_WORLD_QUIRKS,
  "Imperial World": IMPERIAL_WORLD_QUIRKS,
  "Void Born": VOID_BORN_QUIRKS,
};

export const WORLD_VARIANTS_BY_HOMEWORLD: Record<string, string[]> = {
  "Imperial World": ["Agri-World", "Backwater", "Feudal World", "War Zone", "Dead Planet", "Shrine World", "Paradise World"],
  "Feral World": ["Dirt Ward", "Unlucky Colour", "Hunter's Oath", "Thirsty Blade", "Spirit Shackle", "Warrior Death", "Power of Names", "Lonely Dead", "Living Record", "Nemesis"],
  "Hive World": ["Dross Hound", "Ganger Scum", "Factory Dregs", "Middle Hive", "Specialist", "Hive Noble"],
  "Void Born": ["Space Hulk", "Orbital", "Chartist Vessel", "War Ship", "Rogue Trader"],
};

export const WORLD_VARIANT_LABELS: Record<string, string> = {
  "Feral World": "Tribal Taboos",
  "Hive World": "Hive Class",
  "Imperial World": "Birth Planet",
  "Void Born": "Ship Tradition",
};

export const HOME_WORLD_KEYS: Record<string, string> = {
  "Feral World": "homeWorldFeral",
  "Hive World": "homeWorldHive",
  "Imperial World": "homeWorldImperial",
  "Void Born": "homeWorldVoidBorn",
};

export const VARIANT_KEYS: Record<string, string> = {
  "Agri-World": "variantAgriWorld",
  "Backwater": "variantBackwater",
  "Feudal World": "variantFeudalWorld",
  "War Zone": "variantWarZone",
  "Dead Planet": "variantDeadPlanet",
  "Shrine World": "variantShrineWorld",
  "Paradise World": "variantParadiseWorld",
  "Dirt Ward": "variantDirtWard",
  "Unlucky Colour": "variantUnluckyColour",
  "Hunter's Oath": "variantHuntersOath",
  "Thirsty Blade": "variantThirstyBlade",
  "Spirit Shackle": "variantSpiritShackle",
  "Warrior Death": "variantWarriorDeath",
  "Power of Names": "variantPowerOfNames",
  "Lonely Dead": "variantLonelyDead",
  "Living Record": "variantLivingRecord",
  "Nemesis": "variantNemesis",
  "Dross Hound": "variantDrossHound",
  "Ganger Scum": "variantGangerScum",
  "Factory Dregs": "variantFactoryDregs",
  "Middle Hive": "variantMiddleHive",
  "Specialist": "variantSpecialist",
  "Hive Noble": "variantHiveNoble",
  "Space Hulk": "variantSpaceHulk",
  "Orbital": "variantOrbital",
  "Chartist Vessel": "variantChartistVessel",
  "War Ship": "variantWarShip",
  "Rogue Trader": "variantRogueTrader",
};


export const ALL_QUIRKS = [
    ...new Set([
        ...FERAL_WORLD_QUIRKS,
        ...HIVE_WORLD_QUIRKS,
        ...IMPERIAL_WORLD_QUIRKS,
        ...VOID_BORN_QUIRKS
    ])
].sort();

export const QUIRK_KEYS: Record<string, string> = {
  "Hairy Knuckles": "quirkHairyKnuckles", "Joined Eyebrows": "quirkJoinedEyebrows", "Warpaint": "quirkWarpaint",
  "Hands like Spatchcocks": "quirkHandsLikeSpatchcocks", "Filed Teeth": "quirkFiledTeeth", "Beetling Brows": "quirkBeetlingBrows",
  "Musky Smell": "quirkMuskySmell", "Hairy": "quirkHairy", "Ripped Ears": "quirkRippedEars", "Long Fingernails": "quirkLongFingernails",
  "Tribal Tattooing": "quirkTribalTattooing", "Scarring": "quirkScarring", "Piercing": "quirkPiercing", "Cat’s Eyes": "quirkCatsEyes",
  "Small Head": "quirkSmallHead", "Thick Jaw": "quirkThickJaw", "Grimy Skin": "quirkGrimySkin", "Outrageous Hair": "quirkOutrageousHair",
  "Rotten Teeth": "quirkRottenTeeth", "Electoo": "quirkElectoo", "Set of Piercings": "quirkSetOfPiercings", "Hacking Cough": "quirkHackingCough",
  "Tattoos": "quirkTattoos", "Bullet Wound Scar": "quirkBulletWoundScar", "Nervous Tic": "quirkNervousTic", "Large Mole": "quirkLargeMole",
  "Pollution Scars": "quirkPollutionScars", "Hump": "quirkHump", "Small Hands": "quirkSmallHands", "Chemical Smell": "quirkChemicalSmell",
  "Missing Digit": "quirkMissingDigit", "Aquiline Nose": "quirkAquilineNose", "Warts": "quirkWarts", "Duelling Scar": "quirkDuellingScar",
  "Pierced Nose": "quirkPiercedNose", "Aquila Tattoo": "quirkAquilaTattoo", "Faint Smell": "quirkFaintSmell", "Pox Marks": "quirkPoxMarks",
  "Devotional Scar": "quirkDevotionalScar", "Quivering Fingers": "quirkQuiveringFingers", "Pierced Ears": "quirkPiercedEars", "Sinister Boil": "quirkSinisterBoil",
  "Make-up": "quirkMakeup", "Slouched Gait": "quirkSlouchedGait", "Bald": "quirkBald", "Long Fingers": "quirkLongFingers",
  "Tiny Ears": "quirkTinyEars", "Spindly Limbs": "quirkSpindlyLimbs", "Yellow Fingernails": "quirkYellowFingernails", "Stumpy Teeth": "quirkStumpyTeeth",
  "Widely Spaced Eyes": "quirkWidelySpacedEyes", "Large Head": "quirkLargeHead", "Curved Spine": "quirkCurvedSpine", "Hairless": "quirkHairless",
  "Elegant Hands": "quirkElegantHands", "Flowing Hair": "quirkFlowingHair", "Albino": "quirkAlbino", "Limping Gait": "quirkLimpingGait", "Stooped Stance": "quirkStoopedStance",
};

export const CAREER_KEYS: Record<string, string> = {
  "Adept": "careerAdept",
  "Arbitrator": "careerArbitrator",
  "Assassin": "careerAssassin",
  "Cleric": "careerCleric",
  "Guardsman": "careerGuardsman",
  "Imperial Psyker": "careerImperialPsyker",
  "Scum": "careerScum",
  "Tech-Priest": "careerTechPriest",
};

export const RANK_KEYS: Record<string, string> = {
  "Archivist": "rankArchivist", "Scrivener": "rankScrivener", "Scribe": "rankScribe", "Inditor": "rankInditor", "Scholar": "rankScholar",
  "Chirurgeon": "rankChirurgeon", "Comptroller": "rankComptroller", "Logister Comptroller": "rankLogisterComptroller", "Sage Logister": "rankSageLogister",
  "Lexographer": "rankLexographer", "Loremaster Lexographer": "rankLoremasterLexographer", "Loremaster Magister": "rankLoremasterMagister",
  "Trooper": "rankTrooper", "Enforcer": "rankEnforcer", "Regulator": "rankRegulator", "Investigator": "rankInvestigator", "Arbitrator": "rankArbitrator",
  "Proctor": "rankProctor", "Marshal": "rankMarshal", "Lord Marshal": "rankLordMarshal", "Intelligencer": "rankIntelligencer", "Magistrate": "rankMagistrate", "Justicar": "rankJusticar",
  "Sell-Steel": "rankSellSteel", "Shadesman": "rankShadesman", "Nighthawk": "rankNighthawk", "Secluse": "rankSecluse", "Assassin": "rankAssassin",
  "Death Adept": "rankDeathAdept", "Nihilator": "rankNihilator", "Imperator-Mortis": "rankImperatorMortis", "Freeblade": "rankFreeblade", "Assassin at Marque": "rankAssassinAtMarque", "Assassin Palatine": "rankAssassinPalatine",
  "Novice": "rankNovice", "Initiate": "rankInitiate", "Priest": "rankPriest", "Preacher": "rankPreacher", "Cleric": "rankCleric",
  "Exorcist": "rankExorcist", "Zealot": "rankZealot", "Redemptionist": "rankRedemptionist", "Confessor": "rankConfessor", "Bishop": "rankBishop", "Hierophant": "rankHierophant",
  "Conscript": "rankConscript", "Guard": "rankGuard", "Armsman": "rankArmsman", "Sergeant": "rankSergeant", "Veteran": "rankVeteran",
  "Assault Veteran": "rankAssaultVeteran", "Shocktrooper": "rankShocktrooper", "Stormtrooper": "rankStormtrooper", "Lieutenant": "rankLieutenant", "Captain": "rankCaptain", "Commander": "rankCommander",
  "Scout": "rankScout", "Marksman": "rankMarksman", "Sniper": "rankSniper",
  "Sanctionite": "rankSanctionite", "Neonate": "rankNeonate", "Aspirant": "rankAspirant",
  "Savant Militant": "rankSavantMilitant", "Warrant-Savant": "rankWarrantSavant", "Lieutenant-Savant": "rankLieutenantSavant", "Savant Adjunct": "rankSavantAdjunct", "Savant-Preceptor": "rankSavantPreceptor",
  "Scholar Materium": "rankScholarMaterium", "Scholar Medicae": "rankScholarMedicae", "Scholar Arcanum": "rankScholarArcanum", "Scholar Obscurus": "rankScholarObscurus", "Scholar Empyrean": "rankScholarEmpyrean",
  "Dreg": "rankDreg", "Outcast": "rankOutcast", "Outlaw": "rankOutlaw", "Renegade": "rankRenegade", "Rogue": "rankRogue",
  "Fixer": "rankFixer", "Shark": "rankShark", "Charlatan": "rankCharlatan", "Cutter": "rankCutter", "Stubjack": "rankStubjack", "Gang Lord": "rankGangLord",
  "Technographer": "rankTechnographer", "Mech-Wright": "rankMechWright", "Electro-Priest": "rankElectroPriest", "Engineer": "rankEngineer", "Tech-Priest": "rankTechPriest",
  "Technomancer": "rankTechnomancer", "Cyber-Seer": "rankCyberSeer", "Magos": "rankMagos", "Heretek": "rankHeretek", "Mech-Deacon": "rankMechDeacon", "Omniprophet": "rankOmniprophet", "Magos Errant": "rankMagosErrant",
};