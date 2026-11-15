import type { DH2CharacterDraft } from './defaults';
import { deriveAptitudes } from './dh2e-aptitudes';
import type { DarkHeresyStatUpgrade } from './types';

/**
 * Демо-персонаж Dark Heresy 2-й редакции: мир, бэкграунд и роль 2e,
 * выведенные аптитюды, десять характеристик (включая `influence`),
 * пророчество таблицы 2-9 и `fatigue2nd`.
 */
export function createDh2Demo(): DH2CharacterDraft {
  return {
    name: 'Interrogator Vane',
    characterClass: 'warrior',
    systemId: 'dh2',
    gameSystem: 'Dark Heresy',
    backstory:
      'A dedicated servant of the Inquisition, rooting out heresy in the underhive.',
    notes: 'Demo character for preview purposes.',
    questLog: [],
    homeWorld: 'hive-world',
    background: 'adeptus-arbites',
    role: 'warrior',
    aptitudes: {
      ...(() => {
        const aptitudes = deriveAptitudes({
          homeWorld: 'hive-world',
          background: 'adeptus-arbites',
          role: 'warrior',
        });
        return { profile: aptitudes.profile, chosen: {}, extra: [] };
      })(),
    },
    divination: 'd100-10',
    gender: 'Male',
    eliteAdvances: [],
    psy: { rating: 0, disciplines: [], powers: [] },
    experienceLog: [],
    height: '180 cm',
    weight: '75 kg',
    age: '28',
    skinColor: 'Pale',
    hairColor: 'Black',
    eyeColor: 'Grey',
    experience: 1000,
    totalExpSpent: 0,
    stats: {
      weaponSkill: 35,
      ballisticSkill: 30,
      strength: 35,
      toughness: 40,
      agility: 35,
      intelligence: 40,
      perception: 45,
      willpower: 40,
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
      perception: [false, false, false, false, false],
      willpower: [false, false, false, false, false],
      fellowship: [false, false, false, false, false],
      influence: [false, false, false, false, false] as DarkHeresyStatUpgrade,
    },
    statNotes: {},
    wounds: { current: 12, max: 12 },
    fatePoints: { current: 2, max: 2 },
    insanityPoints: { total: 5 },
    corruptionPoints: { total: 0 },
    wealth: { throneGelt: 50, monthlyIncome: 10 },
    movement: { walkHalf: 2, walkFull: 4, charge: 8, run: 12 },
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
    fatigue2nd: { current: 0 },
    criticalConditions: [],
  };
}
