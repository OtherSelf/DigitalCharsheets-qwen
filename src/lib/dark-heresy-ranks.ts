import { DarkHeresyCareerPath } from './types';

// The EXP threshold for unlocking advanced career paths.
export const ADVANCED_RANK_THRESHOLD = 6000;

interface Rank {
  name: string;
  expThreshold: number;
}

export interface AdvancedPath {
  name: string;
  ranks: Rank[];
}

export interface CareerProgression {
  standard: Rank[];
  alternates?: {
    name: string;
    ranks: Rank[];
  }[];
}


export const RanksByCareer: Record<DarkHeresyCareerPath, CareerProgression> = {
  Adept: {
    standard: [
      { name: 'Archivist', expThreshold: 0 },
      { name: 'Scrivener', expThreshold: 500 },
      { name: 'Scribe', expThreshold: 1000 },
      { name: 'Inditor', expThreshold: 2000 },
      { name: 'Scholar', expThreshold: 3000 },
    ],
    alternates: [
      {
        name: 'Chirurgeon',
        ranks: [
          { name: 'Chirurgeon', expThreshold: 2000 },
        ],
      },
    ],
  },
  Arbitrator: {
    standard: [
      { name: 'Trooper', expThreshold: 0 },
      { name: 'Enforcer', expThreshold: 500 },
      { name: 'Regulator', expThreshold: 1000 },
      { name: 'Investigator', expThreshold: 2000 },
      { name: 'Arbitrator', expThreshold: 3000 },
    ],
  },
  Assassin: {
    standard: [
      { name: 'Sell-Steel', expThreshold: 0 },
      { name: 'Shadesman', expThreshold: 500 },
      { name: 'Nighthawk', expThreshold: 1000 },
      { name: 'Secluse', expThreshold: 2000 },
      { name: 'Assassin', expThreshold: 3500 },
    ]
  },
  Cleric: {
    standard: [
      { name: 'Novice', expThreshold: 0 },
      { name: 'Initiate', expThreshold: 500 },
      { name: 'Priest', expThreshold: 1000 },
      { name: 'Preacher', expThreshold: 2000 },
      { name: 'Cleric', expThreshold: 3000 },
    ]
  },
  Guardsman: {
    standard: [
      { name: 'Conscript', expThreshold: 0 },
      { name: 'Guard', expThreshold: 500 },
      { name: 'Armsman', expThreshold: 1000 },
      { name: 'Sergeant', expThreshold: 2000 },
      { name: 'Veteran', expThreshold: 3000 },
    ]
  },
  'Imperial Psyker': {
    standard: [
      { name: 'Sanctionite', expThreshold: 0 },
      { name: 'Neonate', expThreshold: 500 },
      { name: 'Aspirant', expThreshold: 1000 },
    ]
  },
  Scum: {
    standard: [
      { name: 'Dreg', expThreshold: 0 },
      { name: 'Outcast', expThreshold: 500 },
      { name: 'Outlaw', expThreshold: 1000 },
      { name: 'Renegade', expThreshold: 2000 },
      { name: 'Rogue', expThreshold: 3000 },
    ]
  },
  'Tech-Priest': {
    standard: [
      { name: 'Technographer', expThreshold: 0 },
      { name: 'Mech-Wright', expThreshold: 500 },
      { name: 'Electro-Priest', expThreshold: 1000 },
      { name: 'Engineer', expThreshold: 2000 },
    ]
  },
};

export const AdvancedPathsByCareer: Partial<Record<DarkHeresyCareerPath, Record<string, AdvancedPath>>> = {
    Adept: {
      pathA: {
        name: 'Comptroller',
        ranks: [
          { name: 'Comptroller', expThreshold: 6000 },
          { name: 'Logister Comptroller', expThreshold: 8000 },
          { name: 'Sage Logister', expThreshold: 10000 },
        ],
      },
      pathB: {
        name: 'Lexographer',
        ranks: [
          { name: 'Lexographer', expThreshold: 6000 },
          { name: 'Loremaster Lexographer', expThreshold: 8000 },
          { name: 'Loremaster Magister', expThreshold: 10000 },
        ],
      },
    },
    Arbitrator: {
      pathA: {
        name: 'Proctor',
        ranks: [
          { name: 'Proctor', expThreshold: 6000 },
          { name: 'Marshal', expThreshold: 8000 },
          { name: 'Lord Marshal', expThreshold: 10000 },
        ],
      },
      pathB: {
        name: 'Intelligencer',
        ranks: [
          { name: 'Intelligencer', expThreshold: 6000 },
          { name: 'Magistrate', expThreshold: 8000 },
          { name: 'Justicar', expThreshold: 10000 },
        ],
      },
    },
    Assassin: {
      pathA: { name: 'Death Adept', ranks: [
        { name: 'Death Adept', expThreshold: 6000 }, 
        { name: 'Nihilator', expThreshold: 8000 },
        { name: 'Imperator-Mortis', expThreshold: 10000 }
      ] },
      pathB: { name: 'Freeblade', ranks: [
        { name: 'Freeblade', expThreshold: 6000 }, 
        { name: 'Assassin at Marque', expThreshold: 8000 },
        { name: 'Assassin Palatine', expThreshold: 10000 }
      ] },
    },
    Cleric: {
      pathA: {
        name: 'Exorcist',
        ranks: [
          { name: 'Exorcist', expThreshold: 6000 },
          { name: 'Zealot', expThreshold: 8000 },
          { name: 'Redemptionist', expThreshold: 10000 },
        ],
      },
      pathB: {
        name: 'Confessor',
        ranks: [
          { name: 'Confessor', expThreshold: 6000 },
          { name: 'Bishop', expThreshold: 8000 },
          { name: 'Hierophant', expThreshold: 10000 },
        ],
      },
    },
    Guardsman: { 
        pathA: { 
            name: 'Assault Veteran', 
            ranks: [
                { name: 'Assault Veteran', expThreshold: 6000 }, 
                { name: 'Shocktrooper', expThreshold: 8000 },
                { name: 'Stormtrooper', expThreshold: 10000 }
            ] 
        },
        pathB: { 
            name: 'Lieutenant', 
            ranks: [
                { name: 'Lieutenant', expThreshold: 6000 }, 
                { name: 'Captain', expThreshold: 8000 },
                { name: 'Commander', expThreshold: 10000 }
            ] 
        },
        pathC: {
            name: 'Scout',
            ranks: [
                { name: 'Scout', expThreshold: 6000 },
                { name: 'Marksman', expThreshold: 8000 },
                { name: 'Sniper', expThreshold: 10000 },
            ]
        }
    },
    'Imperial Psyker': {
        pathA: {
            name: 'Savant Militant',
            ranks: [
                { name: 'Savant Militant', expThreshold: 2000 },
                { name: 'Warrant-Savant', expThreshold: 3000 },
                { name: 'Lieutenant-Savant', expThreshold: 6000 },
                { name: 'Savant Adjunct', expThreshold: 8000 },
                { name: 'Savant-Preceptor', expThreshold: 10000 },
            ],
        },
        pathB: {
            name: 'Scholar Materium',
            ranks: [
                { name: 'Scholar Materium', expThreshold: 2000 },
                { name: 'Scholar Medicae', expThreshold: 3000 },
                { name: 'Scholar Arcanum', expThreshold: 6000 },
                { name: 'Scholar Obscurus', expThreshold: 8000 },
                { name: 'Scholar Empyrean', expThreshold: 10000 },
            ],
        },
    },
    Scum: {
      pathA: {
        name: 'Fixer',
        ranks: [
          { name: 'Fixer', expThreshold: 6000 },
          { name: 'Shark', expThreshold: 8000 },
          { name: 'Charlatan', expThreshold: 10000 },
        ],
      },
      pathB: {
        name: 'Cutter',
        ranks: [
          { name: 'Cutter', expThreshold: 6000 },
          { name: 'Stubjack', expThreshold: 8000 },
          { name: 'Gang Lord', expThreshold: 10000 },
        ],
      },
    },
    'Tech-Priest': {
      pathA: {
        name: 'Tech-Priest',
        ranks: [
          { name: 'Tech-Priest', expThreshold: 3000 },
          { name: 'Technomancer', expThreshold: 6000 },
          { name: 'Cyber-Seer', expThreshold: 8000 },
          { name: 'Magos', expThreshold: 10000 },
        ],
      },
      pathB: {
        name: 'Heretek',
        ranks: [
          { name: 'Heretek', expThreshold: 3000 },
          { name: 'Mech-Deacon', expThreshold: 6000 },
          { name: 'Omniprophet', expThreshold: 8000 },
          { name: 'Magos Errant', expThreshold: 10000 },
        ],
      },
    },
};


export function calculateRank(
  careerProgression: CareerProgression,
  totalExpSpent: number,
  advancedPath: AdvancedPath | null,
  alternatePath: string | null
): string {
  // Priority 1: Advanced Path
  if (advancedPath) {
    const currentAdvancedRank = [...advancedPath.ranks]
      .reverse()
      .find(rank => totalExpSpent >= rank.expThreshold);
    if (currentAdvancedRank) {
      return currentAdvancedRank.name;
    }
  }

  // Priority 2: Alternate Path
  if (alternatePath && careerProgression.alternates) {
    const path = careerProgression.alternates.find(p => p.name === alternatePath);
    if (path) {
      const currentAlternateRank = [...path.ranks]
        .reverse()
        .find(rank => totalExpSpent >= rank.expThreshold);
      
      if (currentAlternateRank) {
        // Check if the character's EXP is still within the bounds of this alternate path.
        // An alternate path is "active" as long as the current EXP is less than the EXP
        // threshold of the *next* standard rank that this path does NOT replace.
        const alternateRankThresholds = path.ranks.map(r => r.expThreshold);
        const replacedStandardRanks = careerProgression.standard.filter(sr => 
          alternateRankThresholds.includes(sr.expThreshold)
        );
        const firstStandardRankAfterAlternate = careerProgression.standard.find(sr => 
          sr.expThreshold > (replacedStandardRanks[replacedStandardRanks.length - 1]?.expThreshold ?? -1)
        );

        const pathEndThreshold = firstStandardRankAfterAlternate?.expThreshold ?? ADVANCED_RANK_THRESHOLD;

        if (totalExpSpent < pathEndThreshold) {
          return currentAlternateRank.name;
        }
      }
    }
  }

  // Priority 3: Standard Path (Fallback)
  const currentBasicRank = [...careerProgression.standard]
    .reverse()
    .find(rank => totalExpSpent >= rank.expThreshold);

  return currentBasicRank ? currentBasicRank.name : (careerProgression.standard[0]?.name || 'Unknown Rank');
}
