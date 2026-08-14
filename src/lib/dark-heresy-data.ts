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

export const ALL_QUIRKS = [
    ...new Set([
        ...FERAL_WORLD_QUIRKS,
        ...HIVE_WORLD_QUIRKS,
        ...IMPERIAL_WORLD_QUIRKS,
        ...VOID_BORN_QUIRKS
    ])
].sort();
