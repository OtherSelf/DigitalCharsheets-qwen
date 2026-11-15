import { CURRENT_SCHEMA_VERSION } from '../plugin-api';
import { readNumber, readString, type DefaultsInput } from '../shared/defaults';
import { DH2E_BACKGROUNDS, DH2E_HOMEWORLDS, DH2E_ROLES } from './dh2e-data';
import { calculateRank, RanksByCareer } from './dark-heresy-ranks';
import { effectIdForDivination } from './divination-i18n';
import {
  DARK_HERESY_CORE_STATS,
  DarkHeresyCareerPaths,
  DarkHeresyHomeWorlds,
  type DarkHeresyBase,
  type DarkHeresyCareerPath,
  type DarkHeresyCoreStatNotes,
  type DarkHeresyCoreStats,
  type DarkHeresyCoreStatUpgrades,
  type DarkHeresyStatUpgrade,
  type DH2Character,
  type DH2StatNotes,
  type DH2Stats,
  type DH2StatUpgrades,
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

const HOME_WORLD_IDS = new Set(DH2E_HOMEWORLDS.map((world) => world.id));
const BACKGROUND_IDS = new Set(DH2E_BACKGROUNDS.map((bg) => bg.id));
const ROLE_IDS = new Set(DH2E_ROLES.map((role) => role.id));

function readHomeWorld(input: DefaultsInput): string {
  const raw = readString(input, 'homeWorld', '');
  if (HOME_WORLD_IDS.has(raw)) return raw;
  return (DarkHeresyHomeWorlds as readonly string[]).includes(raw) ? raw : '';
}

function readKnownId(input: DefaultsInput, key: string, known: Set<string>) {
  const raw = readString(input, key, '');
  return known.has(raw) ? raw : '';
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
    schemaVersion: CURRENT_SCHEMA_VERSION,
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
    background: readKnownId(input, 'background', BACKGROUND_IDS),
    role: readKnownId(input, 'role', ROLE_IDS),
    aptitudes: { profile: [], chosen: {}, extra: [] },
    eliteAdvances: [],
    psy: { rating: 0, disciplines: [], powers: [] },
    experienceLog: [],
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

export type DH2CharacterDraft = Omit<DH2Character, 'id'>;

export function createDh2Defaults(
  input: DefaultsInput = {},
): DH2CharacterDraft {
  const base = createDarkHeresyBaseDefaults(input);
  const stats = {
    ...(Object.fromEntries(
      DARK_HERESY_CORE_STATS.map((stat) => [stat, readNumber(input, stat, 30)]),
    ) as DarkHeresyCoreStats),
    influence: readNumber(input, 'influence', 30),
  } satisfies DH2Stats;
  const statUpgrades = {
    ...(Object.fromEntries(
      DARK_HERESY_CORE_STATS.map((stat) => [
        stat,
        [false, false, false, false, false] as DarkHeresyStatUpgrade,
      ]),
    ) as DarkHeresyCoreStatUpgrades),
    influence: [false, false, false, false, false] as DarkHeresyStatUpgrade,
  } satisfies DH2StatUpgrades;
  const statNotes = {} as DarkHeresyCoreStatNotes;

  return {
    ...base,
    systemId: 'dh2',
    stats,
    statUpgrades,
    statNotes: statNotes satisfies DH2StatNotes,
    fatigue2nd: { current: readNumber(input, 'fatigue2nd', 0) },
  };
}
