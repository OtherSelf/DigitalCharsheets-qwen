import {
  readBoolean,
  readNumber,
  readString,
  type DefaultsInput,
} from '../shared/defaults';
import { characteristicAptitudes, deriveAptitudes } from './dh2e-aptitudes';
import { DH2E_BACKGROUNDS, DH2E_HOMEWORLDS, DH2E_ROLES } from './dh2e-data';
import { isDivinationId } from './dh2e-divinations';
import { readStartingChoices } from './dh2e-grants';
import { DH2_SCHEMA_VERSION } from './schema-version';
import {
  DARK_HERESY_CORE_STATS,
  type DarkHeresyBase,
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
 * Фабрика персонажа 2-й редакции: мир, бэкграунд, роль, аптитюды, десять
 * характеристик и усталость. Значения характеристик вводит игрок (броски
 * кубиков за столом), поэтому дефолт — 30 и никакого RNG (D5).
 */

export type DarkHeresyBaseDraft = Omit<DarkHeresyBase, 'id'>;

const HOME_WORLD_IDS = new Set(DH2E_HOMEWORLDS.map((world) => world.id));
const BACKGROUND_IDS = new Set(DH2E_BACKGROUNDS.map((bg) => bg.id));
const ROLE_IDS = new Set(DH2E_ROLES.map((role) => role.id));

function readKnownId(input: DefaultsInput, key: string, known: Set<string>) {
  const raw = readString(input, key, '');
  return known.has(raw) ? raw : '';
}

function readChosen(input: DefaultsInput): Record<string, string> {
  const value = input.chosen;
  if (!value || typeof value !== 'object' || Array.isArray(value)) return {};
  const result: Record<string, string> = {};
  for (const [key, picked] of Object.entries(value)) {
    if (typeof picked === 'string' && picked) result[key] = picked;
  }
  return result;
}

/**
 * Оставляет в `aptitudes.chosen` только ключи, которые действительно есть у
 * мира/бэкграунда/роли, и значения из их вариантов: мусор из формы или
 * старого JSON не должен попадать в лист.
 */
function cleanChosen(
  chosen: Readonly<Record<string, string>>,
  result: ReturnType<typeof deriveAptitudes>,
): Record<string, string> {
  const allowed = new Map(
    result.choices.map((choice) => [choice.key, choice.of]),
  );
  const characteristic = characteristicAptitudes();
  const cleaned: Record<string, string> = {};
  for (const [key, value] of Object.entries(chosen)) {
    if (key.startsWith('duplicate.')) {
      if (characteristic.includes(value)) cleaned[key] = value;
      continue;
    }
    if (allowed.get(key)?.includes(value)) cleaned[key] = value;
  }
  return cleaned;
}

/** Раны мира 2e: `9+1d5` → 10 при «среднем» значении кубика. */
function defaultWounds(homeWorld: string): number {
  const world = DH2E_HOMEWORLDS.find((item) => item.id === homeWorld);
  const match = world?.wounds.match(/^(\d+)\+1d5$/);
  return match ? Number(match[1]) + 1 : 10;
}

function defaultFate(homeWorld: string): number {
  const world = DH2E_HOMEWORLDS.find((item) => item.id === homeWorld);
  return world?.fateThreshold ?? 1;
}

export function createDh2BaseDefaults(
  input: DefaultsInput = {},
): DarkHeresyBaseDraft {
  const homeWorld = readKnownId(input, 'homeWorld', HOME_WORLD_IDS);
  const background = readKnownId(input, 'background', BACKGROUND_IDS);
  const role = readKnownId(input, 'role', ROLE_IDS);
  const chosenInput = readChosen(input);
  // Форма создания знает про выборы и не даёт подставлять `of[0]` молча;
  // программное создание и миграция сохраняют прежний фолбэк (D11).
  const strictChoices = readBoolean(input, 'strictAptitudeChoices', false);
  const aptitudes = deriveAptitudes(
    { homeWorld, background, role },
    chosenInput,
    {
      fallbackToFirst: !strictChoices,
    },
  );
  const chosen = cleanChosen(chosenInput, aptitudes);
  const backgroundEntry = DH2E_BACKGROUNDS.find(
    (item) => item.id === background,
  );
  const roleEntry = DH2E_ROLES.find((item) => item.id === role);
  const startingChoices = readStartingChoices(
    input.startingChoices,
    backgroundEntry,
    roleEntry,
  );

  const divinationRaw = readString(input, 'divination', '');
  const divination = isDivinationId(divinationRaw) ? divinationRaw : '';

  const agility = readNumber(input, 'agility', 30);
  const agilityBonus = Math.floor(agility / 10);
  const wounds = readNumber(input, 'wounds', defaultWounds(homeWorld));
  const fatePoints = readNumber(input, 'fatePoints', defaultFate(homeWorld));

  return {
    name: readString(input, 'name', ''),
    characterClass: role || background,
    gameSystem: 'Dark Heresy',
    schemaVersion: DH2_SCHEMA_VERSION,
    backstory: readString(input, 'backstory', ''),
    homeWorld,
    background,
    role,
    aptitudes: { profile: aptitudes.profile, chosen, extra: [] },
    eliteAdvances: [],
    divination,
    gender: readString(input, 'gender', ''),
    psy: { rating: 0, disciplines: [], powers: [] },
    startingChoices,
    height: readString(input, 'height', ''),
    weight: readString(input, 'weight', ''),
    age: readString(input, 'age', ''),
    skinColor: readString(input, 'skinColor', ''),
    hairColor: readString(input, 'hairColor', ''),
    eyeColor: readString(input, 'eyeColor', ''),
    experience: readNumber(input, 'experience', 1000),
    totalExpSpent: readNumber(input, 'totalExpSpent', 0),
    experienceLog: [],
    notes: '',
    questLog: [],
    wounds: { current: wounds, max: wounds },
    fatePoints: { current: fatePoints, max: fatePoints },
    insanityPoints: { total: readNumber(input, 'insanity', 0), notes: '' },
    corruptionPoints: { total: readNumber(input, 'corruption', 0), notes: '' },
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
  const base = createDh2BaseDefaults(input);
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
