import { CHARACTER_SCHEMA_VERSION } from '@/lib/character-version';
import { calculateRank, RanksByCareer } from '@/lib/dark-heresy-ranks';
import { effectIdForDivination } from '@/lib/divination-i18n';

import { readNumber, readString, type DefaultsInput } from '../shared/defaults';
import {
  DARK_HERESY_CORE_STATS,
  DarkHeresyCareerPaths,
  DarkHeresyHomeWorlds,
  type DarkHeresyBase,
  type DarkHeresyCareerPath,
  type DarkHeresyCoreStats,
  type DarkHeresyCoreStatUpgrades,
  type DarkHeresyHomeWorld,
  type DarkHeresyStatUpgrade,
  type DH1Character,
} from './types';

/**
 * ─── LANDMARK: DARK_HERESY BASE DEFAULTS ──────────────────────────────────
 * Базовая часть фабрики персонажа Dark Heresy внутри модуля.
 * Редакция добавляет характеристики и усталость ниже.
 *
 * Раньше весь объект собирался в `dark-heresy-character-form.tsx`; теперь
 * правила (ранг по опыту, эффект пророчества, движение от Agility) живут
 * здесь и переиспользуются тестами.
 */

export type DarkHeresyBaseDraft = Omit<DarkHeresyBase, 'id'>;

function readHomeWorld(input: DefaultsInput): DarkHeresyHomeWorld | '' {
  const raw = readString(input, 'homeWorld', '');
  return (DarkHeresyHomeWorlds as readonly string[]).includes(raw)
    ? (raw as DarkHeresyHomeWorld)
    : '';
}

function readCareerPath(input: DefaultsInput): DarkHeresyCareerPath | '' {
  const raw = readString(input, 'careerPath', '');
  return (DarkHeresyCareerPaths as readonly string[]).includes(raw)
    ? (raw as DarkHeresyCareerPath)
    : '';
}

function readNullableString(input: DefaultsInput, key: string): string | null {
  const value = input[key];
  return typeof value === 'string' ? value : null;
}

export function createDarkHeresyBaseDefaults(
  input: DefaultsInput = {},
): DarkHeresyBaseDraft {
  const careerPath = readCareerPath(input);
  const careerRanks = careerPath ? RanksByCareer[careerPath] : null;
  const totalExpSpent = readNumber(input, 'totalExpSpent', 0);
  const rank = careerRanks
    ? calculateRank(careerRanks, totalExpSpent, null, null)
    : readString(input, 'rank', 'N/A');
  const divination = readString(input, 'divination', '');
  const agility = readNumber(input, 'agility', 30);
  const agilityBonus = Math.floor(agility / 10);
  const wounds = readNumber(input, 'wounds', 10);

  return {
    name: readString(input, 'name', ''),
    characterClass: careerPath,
    gameSystem: 'Dark Heresy',
    schemaVersion: CHARACTER_SCHEMA_VERSION,
    backstory: readString(input, 'backstory', ''),
    homeWorld: readHomeWorld(input),
    worldVariant: readString(input, 'worldVariant', ''),
    careerPath,
    rank,
    divination,
    divinationEffect:
      effectIdForDivination(divination) ||
      readString(input, 'divinationEffect', ''),
    quirk: readString(input, 'quirk', ''),
    height: readString(input, 'height', ''),
    weight: readString(input, 'weight', ''),
    age: readString(input, 'age', ''),
    skinColor: readString(input, 'skinColor', ''),
    hairColor: readString(input, 'hairColor', ''),
    eyeColor: readString(input, 'eyeColor', ''),
    experience: readNumber(input, 'experience', 0),
    totalExpSpent,
    alternatePath: readNullableString(input, 'alternatePath'),
    advancedPath: readNullableString(input, 'advancedPath'),
    notes: '',
    questLog: [],
    wounds: { current: wounds, max: wounds },
    fatePoints: {
      current: readNumber(input, 'fatePoints', 1),
      max: readNumber(input, 'fatePoints', 1),
    },
    insanityPoints: { total: 0, notes: '' },
    corruptionPoints: { total: 0, notes: '' },
    wealth: { throneGelt: 0, monthlyIncome: 0 },
    movement: {
      walkHalf: agilityBonus,
      walkFull: agilityBonus * 2,
      charge: agilityBonus * 3,
      run: agilityBonus * 6,
    },
    equipment: {
      armor: {
        Head: null,
        Body: null,
        'Left arm': null,
        'Right arm': null,
        'Left leg': null,
        'Right leg': null,
      },
      weapons: { melee: [], ranged: [] },
    },
    inventory: [],
    skills: [],
    talents: [],
    criticalConditions: [],
  };
}

export type DH1CharacterDraft = Omit<DH1Character, 'id'>;

export function createDh1Defaults(
  input: DefaultsInput = {},
): DH1CharacterDraft {
  const base = createDarkHeresyBaseDefaults(input);
  const stats = Object.fromEntries(
    DARK_HERESY_CORE_STATS.map((stat) => [stat, readNumber(input, stat, 30)]),
  ) as DarkHeresyCoreStats;
  const statUpgrades = Object.fromEntries(
    DARK_HERESY_CORE_STATS.map((stat) => [
      stat,
      [false, false, false, false] as DarkHeresyStatUpgrade,
    ]),
  ) as DarkHeresyCoreStatUpgrades;

  return {
    ...base,
    systemId: 'dh1',
    stats,
    statUpgrades,
    statNotes: {},
    fatigue1st: { current: readNumber(input, 'fatigue1st', 0) },
  };
}
