import { rankForCharacter } from './dark-heresy-ranks';
import type { DH1CharacterDraft } from './defaults';

/**
 * Демо-персонаж Dark Heresy 1-й редакции: nine characteristics, `fatigue1st`,
 * без `influence` и `fatigue2nd`.
 */
export function createDh1Demo(): DH1CharacterDraft {
  const totalExpSpent = 500;
  const careerPath = 'Guardsman';
  return {
    name: 'Inquisitor Vane',
    characterClass: careerPath,
    systemId: 'dh1',
    gameSystem: 'Dark Heresy',
    backstory:
      'A dedicated servant of the Inquisition, rooting out heresy in the underhive.',
    notes: 'Demo character for preview purposes.',
    questLog: [],
    homeWorld: 'Hive World',
    worldVariant: 'Middle Hive',
    careerPath,
    rank: rankForCharacter({ careerPath, totalExpSpent }),
    divination: 'painOfBullet',
    divinationEffect: 'toughness1',
    quirk: 'Pallid',
    height: '180 cm',
    weight: '75 kg',
    age: '28',
    skinColor: 'Pale',
    hairColor: 'Black',
    eyeColor: 'Grey',
    experience: totalExpSpent,
    experienceLog: [],
    totalExpSpent,
    alternatePath: null,
    advancedPath: null,
    // Hive World: база 20/20/20/15/20/20/20/20/25 + 2d10, не выше базы +20.
    stats: {
      weaponSkill: 35,
      ballisticSkill: 30,
      strength: 30,
      toughness: 30,
      agility: 30,
      intelligence: 35,
      perception: 30,
      willpower: 30,
      fellowship: 30,
    },
    statUpgrades: {
      weaponSkill: [false, false, false, false],
      ballisticSkill: [false, false, false, false],
      strength: [false, false, false, false],
      toughness: [false, false, false, false],
      agility: [false, false, false, false],
      intelligence: [false, false, false, false],
      perception: [false, false, false, false],
      willpower: [false, false, false, false],
      fellowship: [false, false, false, false],
    },
    statNotes: {},
    wounds: { current: 12, max: 12 },
    fatePoints: { current: 2, max: 2 },
    insanityPoints: { total: 5 },
    corruptionPoints: { total: 0 },
    wealth: { throneGelt: 50, monthlyIncome: 10 },
    movement: { walkHalf: 3, walkFull: 6, charge: 9, run: 18 },
    equipment: {
      armor: {
        Head: { ap: 3, type: 'Flak', mods: '', quality: 'Common' },
        'Right arm': null,
        Body: { ap: 4, type: 'Flak', mods: '', quality: 'Common' },
        'Left arm': null,
        'Right leg': null,
        'Left leg': null,
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
    inventory: [],
    skills: [],
    talents: [],
    fatigue1st: { current: 0 },
    criticalConditions: [],
  };
}
