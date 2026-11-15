import type { NormalizeOptions, NormalizeResult } from '../types';
import { deriveAptitudes } from './dh2e-aptitudes';
import { DH2E_BACKGROUNDS, DH2E_HOMEWORLDS, DH2E_ROLES } from './dh2e-data';
import { resolveDivinationId } from './dh2e-divinations';
import type { DH2Character } from './types';

/**
 * ─── LANDMARK: DH2 NORMALIZE ───────────────────────────────────────────────
 * Приведение legacy/импортированного листа к dh2 2-й редакции. Логика
 * принадлежит редакции: ядро не ветвится по `systemId` (D10).
 *
 * Правила (D2, D3):
 *   • отсутствующие структуры заполняются дефолтами dh2;
 *   • поля DH1 (`careerPath`, `rank`, `quirk`, `worldVariant`, `alternatePath`,
 *     `advancedPath`, `divinationEffect`) удаляются, их значения — в `notes`:
 *     лист 2e не должен показывать карьеру и ранг;
 *   • мир DH1 → id 2e, `Imperial World` остаётся только в `notes`;
 *   • пророчество DH1 → строка 2-9, неизвестное — в `notes`;
 *   • у характеристики пять ступеней (4-й флаг DH1 сохраняется, 5-й = false);
 *   • профиль аптитюд пересобирается из мира/бэкграунда/роли, если пуст;
 *   • функция идемпотентна: повторный прогон не меняет лист.
 */

const MIGRATION_NOTE_MARKER = '[migration v2]';

type RawRecord = Record<string, unknown>;

const DEFAULT_EQUIPMENT = {
  armor: {
    Head: null,
    Body: null,
    'Left arm': null,
    'Right arm': null,
    'Left leg': null,
    'Right leg': null,
  },
  weapons: { melee: [], ranged: [] },
};

function isRecord(value: unknown): value is RawRecord {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}

function asRecord(value: unknown): RawRecord {
  return isRecord(value) ? value : {};
}

const CORE_STAT_KEYS = [
  'weaponSkill',
  'ballisticSkill',
  'strength',
  'toughness',
  'agility',
  'intelligence',
  'perception',
  'willpower',
  'fellowship',
] as const;

const DEFAULT_STATS: RawRecord = {
  ...Object.fromEntries(CORE_STAT_KEYS.map((key) => [key, 0])),
  influence: 0,
};

const DEFAULT_UPGRADES: RawRecord = {
  ...Object.fromEntries(
    CORE_STAT_KEYS.map((key) => [key, [false, false, false, false, false]]),
  ),
  influence: [false, false, false, false, false],
};

/** Миры DH1, у которых есть прямой аналог 2e. `Imperial World` аналога не имеет. */
const LEGACY_HOME_WORLDS: Readonly<Record<string, string>> = {
  'Feral World': 'feral-world',
  'Hive World': 'hive-world',
  'Forge World': 'forge-world',
  'Void Born': 'voidborn',
};

const HOME_WORLD_IDS = new Set(DH2E_HOMEWORLDS.map((world) => world.id));
const BACKGROUND_IDS = new Set(DH2E_BACKGROUNDS.map((bg) => bg.id));
const ROLE_IDS = new Set(DH2E_ROLES.map((role) => role.id));

/** Поля DH1, которых в листе 2e нет; значения переносим в `notes`. */
const LEGACY_FIELDS: Readonly<Record<string, string>> = {
  careerPath: 'карьера DH1',
  rank: 'ранг DH1',
  worldVariant: 'вариант мира DH1',
  quirk: 'примета DH1',
  alternatePath: 'альтернативный путь DH1',
  advancedPath: 'продвинутый путь DH1',
  divinationEffect: 'эффект пророчества DH1',
};

function appendMigrationNote(raw: RawRecord, line: string): void {
  const notes = typeof raw.notes === 'string' ? raw.notes : '';
  if (notes.includes(line)) return;
  const block = `${MIGRATION_NOTE_MARKER} ${line}`;
  raw.notes = notes.trim() ? `${notes.trimEnd()}\n\n${block}` : block;
}

function hasMeaningfulValue(value: unknown): boolean {
  if (value === undefined || value === null || value === '') return false;
  if (typeof value === 'object') return Object.keys(value).length > 0;
  return true;
}

/**
 * Ступеней характеристик в 2e пять (Simple…Expert), в листах DH1-стиля было
 * четыре. Лишние флаги отбрасываем, недостающие добиваем `false`: иначе
 * пятая ступень никогда не станет доступной.
 */
function toFiveFlags(value: unknown): boolean[] {
  const source = Array.isArray(value) ? value : [];
  return Array.from({ length: 5 }, (_, index) => Boolean(source[index]));
}

function migrateLegacyFields(character: RawRecord, warnings: string[]): void {
  const moved: string[] = [];
  for (const [key, label] of Object.entries(LEGACY_FIELDS)) {
    const value = character[key];
    if (hasMeaningfulValue(value)) {
      moved.push(`${label}: ${String(value)}`);
    }
    delete character[key];
  }

  const homeWorld =
    typeof character.homeWorld === 'string' ? character.homeWorld : '';
  if (homeWorld && !HOME_WORLD_IDS.has(homeWorld)) {
    const mapped = LEGACY_HOME_WORLDS[homeWorld];
    if (mapped) {
      character.homeWorld = mapped;
    } else {
      moved.push(`родной мир DH1: ${homeWorld}`);
      character.homeWorld = '';
    }
  }

  const divination =
    typeof character.divination === 'string' ? character.divination : '';
  if (divination) {
    const mapped = resolveDivinationId(divination);
    if (mapped) {
      character.divination = mapped;
    } else {
      moved.push(`пророчество DH1: ${divination}`);
      character.divination = '';
      warnings.push('dh2: пророчество DH1 не сопоставлено с таблицей 2-9');
    }
  }

  if (moved.length > 0) {
    appendMigrationNote(character, `поля DH1: ${moved.join('; ')}`);
    warnings.push('dh2: поля DH1 перенесены в notes');
  }
}

function fillDefaults(character: RawRecord): void {
  // `||`, как в прежнем ядре: поле перезаписывается только если оно пустое.
  if (!character.stats) character.stats = { ...DEFAULT_STATS };
  if (!character.statUpgrades) {
    character.statUpgrades = JSON.parse(JSON.stringify(DEFAULT_UPGRADES));
  }
  if (!character.movement) {
    character.movement = { walkHalf: 0, walkFull: 0, charge: 0, run: 0 };
  }
  if (!character.wounds) {
    character.wounds = { current: 0, max: 0, notes: '' };
  }
  if (!character.fatePoints) {
    character.fatePoints = { current: 0, max: 0, notes: '' };
  }
  if (!character.insanityPoints) {
    character.insanityPoints = { total: 0, notes: '' };
  }
  if (!character.corruptionPoints) {
    character.corruptionPoints = { total: 0, notes: '' };
  }
  if (!character.wealth) {
    character.wealth = { throneGelt: 0, monthlyIncome: 0, notes: '' };
  }
  if (!character.equipment) {
    character.equipment = JSON.parse(JSON.stringify(DEFAULT_EQUIPMENT));
  }
  if (!character.skills) character.skills = [];
  if (!character.talents) character.talents = [];
}

function enforceDh2Fields(character: RawRecord, warnings: string[]): void {
  const stats = asRecord(character.stats);
  const upgrades = asRecord(character.statUpgrades);
  const notes = asRecord(character.statNotes);

  const nextStats: RawRecord = { ...stats };
  for (const key of CORE_STAT_KEYS) {
    nextStats[key] = typeof stats[key] === 'number' ? stats[key] : 0;
  }
  // Влияние в dh2 обязательно; значение по умолчанию — 30.
  nextStats.influence =
    typeof stats.influence === 'number' ? stats.influence : 30;

  const nextUpgrades: RawRecord = { ...upgrades };
  for (const key of CORE_STAT_KEYS) {
    nextUpgrades[key] = toFiveFlags(upgrades[key]);
  }
  nextUpgrades.influence = toFiveFlags(upgrades.influence);

  const nextNotes: RawRecord = { ...notes };
  if (typeof notes.influence === 'string') {
    nextNotes.influence = notes.influence;
  }

  // Усталость 1-й редакции в dh2 не хранится: значимое значение — в notes.
  const legacyFatigue = character.fatigue1st;
  if (hasMeaningfulValue(legacyFatigue)) {
    appendMigrationNote(
      character,
      `усталость 1-й редакции сохранена здесь: ${JSON.stringify(legacyFatigue)}`,
    );
    warnings.push('dh2: fatigue1st перенесена в notes (поля в листе нет)');
  }
  delete character.fatigue1st;
  if (!isRecord(character.fatigue2nd)) character.fatigue2nd = { current: 0 };

  character.stats = nextStats;
  character.statUpgrades = nextUpgrades;
  character.statNotes = nextNotes;

  if (typeof character.homeWorld !== 'string') character.homeWorld = '';
  if (typeof character.background !== 'string') character.background = '';
  if (typeof character.role !== 'string') character.role = '';
  if (!BACKGROUND_IDS.has(String(character.background))) {
    if (hasMeaningfulValue(character.background)) {
      appendMigrationNote(
        character,
        `бэкграунд не из 2e: ${String(character.background)}`,
      );
    }
    character.background = '';
  }
  if (!ROLE_IDS.has(String(character.role))) {
    if (hasMeaningfulValue(character.role)) {
      appendMigrationNote(
        character,
        `роль не из 2e: ${String(character.role)}`,
      );
    }
    character.role = '';
  }

  const aptitudes = asRecord(character.aptitudes);
  const chosen = asRecord(aptitudes.chosen);
  const profile = Array.isArray(aptitudes.profile) ? aptitudes.profile : [];
  const derived =
    profile.length > 0
      ? { profile: profile as string[] }
      : deriveAptitudes(
          {
            homeWorld: String(character.homeWorld),
            background: String(character.background),
            role: String(character.role),
          },
          chosen as Record<string, string>,
        );
  character.aptitudes = {
    profile: derived.profile,
    chosen,
    extra: Array.isArray(aptitudes.extra) ? aptitudes.extra : [],
  };

  if (!Array.isArray(character.eliteAdvances)) character.eliteAdvances = [];
  const psy = asRecord(character.psy);
  character.psy = {
    rating: typeof psy.rating === 'number' ? psy.rating : 0,
    disciplines: Array.isArray(psy.disciplines) ? psy.disciplines : [],
    powers: Array.isArray(psy.powers) ? psy.powers : [],
  };
  if (!Array.isArray(character.experienceLog)) character.experienceLog = [];
  if (typeof character.divination !== 'string') character.divination = '';
  if (typeof character.gender !== 'string') character.gender = '';

  // Тренировка навыка: `plus30` стало обязательным в типе v2.
  if (Array.isArray(character.skills)) {
    character.skills = character.skills.map((skill) => {
      if (!isRecord(skill)) return skill;
      const training = asRecord(skill.training);
      return {
        ...skill,
        training: {
          skilled: Boolean(training.skilled),
          plus10: Boolean(training.plus10),
          plus20: Boolean(training.plus20),
          plus30: Boolean(training.plus30),
        },
      };
    });
  }
}

export function normalizeDh2(
  raw: Readonly<Record<string, unknown>>,
  options: NormalizeOptions = {},
): NormalizeResult<DH2Character> {
  const character: RawRecord = { ...raw };
  const warnings: string[] = [];

  if (options.applyDefaults) fillDefaults(character);
  migrateLegacyFields(character, warnings);
  enforceDh2Fields(character, warnings);

  return {
    character: character as unknown as DH2Character,
    warnings,
  };
}
