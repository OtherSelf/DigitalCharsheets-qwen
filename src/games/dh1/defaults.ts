import { readNumber, readString, type DefaultsInput } from '../shared/defaults';
import {
  fateRangeFromText,
  WORLD_STARTING_PROFILE,
  woundsRangeFromFormula,
} from './dark-heresy-data';
import { rankForCharacter } from './dark-heresy-ranks';
import { statBonus } from './dh-stats';
import { effectIdForDivination } from './divination-i18n';
import { resolveGender } from './gender';
import { DH1_SCHEMA_VERSION } from './schema-version';
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
  const totalExpSpent = readNumber(input, 'totalExpSpent', 0);
  const alternatePath = readNullableString(input, 'alternatePath');
  const advancedPath = readNullableString(input, 'advancedPath');
  const rank = careerPath
    ? rankForCharacter({
        careerPath,
        totalExpSpent,
        advancedPath,
        alternatePath,
      })
    : readString(input, 'rank', '');
  const divination = readString(input, 'divination', '');
  const agility = readNumber(input, 'agility', 30);
  const agilityBonus = statBonus(agility);
  const homeWorld = readHomeWorld(input);
  const startingProfile = homeWorld
    ? WORLD_STARTING_PROFILE[homeWorld]
    : undefined;
  // Мир задаёт диапазон: дефолт — минимум, бросок игрок вводит сам.
  const wounds = readNumber(
    input,
    'wounds',
    (startingProfile && woundsRangeFromFormula(startingProfile.wounds)?.min) ??
      10,
  );
  const fatePoints = readNumber(
    input,
    'fatePoints',
    (startingProfile && fateRangeFromText(startingProfile.fate)?.min) ?? 1,
  );

  return {
    name: readString(input, 'name', ''),
    characterClass: careerPath,
    gameSystem: 'Dark Heresy',
    schemaVersion: DH1_SCHEMA_VERSION,
    backstory: readString(input, 'backstory', ''),
    homeWorld,
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
    alternatePath,
    advancedPath,
    rankChoices: {},
    notes: readString(input, 'notes', ''),
    questLog: [],
    wounds: { current: wounds, max: wounds },
    fatePoints: { current: fatePoints, max: fatePoints },
    insanityPoints: { total: readNumber(input, 'insanity', 0), notes: '' },
    corruptionPoints: { total: readNumber(input, 'corruption', 0), notes: '' },
    wealth: {
      throneGelt: readNumber(input, 'throneGelt', 0),
      monthlyIncome: 0,
    },
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
  const identity = { gender: resolveGender(input.gender).code };
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
    experienceLog: [],
    identity,
    stats,
    statUpgrades,
    statNotes: {},
    fatigue1st: { current: readNumber(input, 'fatigue1st', 0) },
    // Псайкер начинает с Пси-рейтингом 1 (Таблица 1-18/Глава VI).
    ...(base.careerPath === 'Imperial Psyker'
      ? {
          psy: {
            rating: 1,
            discipline: '',
            powers: [],
            testedAgainst: '',
          },
        }
      : {}),
  };
}
