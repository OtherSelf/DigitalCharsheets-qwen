import type { NormalizeOptions, NormalizeResult } from '../types';
import {
  effectIdForDivination,
  resolveDivinationEffectId,
  resolveDivinationId,
} from './divination-i18n';
import type { DH2Character } from './types';

/**
 * ─── LANDMARK: DH2 NORMALIZE ───────────────────────────────────────────────
 * Приведение legacy/импортированного листа к dh2. Раньше вся эта логика
 * жила в ядре (`src/lib/character-version.ts` + `src/lib/export-utils.ts`) и
 * ветвилась по `systemId`; теперь dh2 владеет ею сам (этап 2, D10).
 *
 * Правила (📌 D3/D8):
 *   • отсутствующие структуры заполняются дефолтами dh2;
 *   • пророчества из английских фраз превращаются в стабильные ID;
 *   • усталости 1-й редакции (`fatigue1st`) в dh2 нет, значимые значения
 *     не теряются — уходят в `notes` блоком `[migration v2]`;
 *   • у навыка тренировка всегда имеет `plus30`;
 *   • функция идемпотентна: повторный прогон не меняет лист.
 */

const MIGRATION_NOTE_MARKER = '[migration v2]';

type RawRecord = Record<string, unknown>;

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

/** Дефолты dh2: девять характеристик + влияние (у dh1 его нет). */
const DEFAULT_STATS: RawRecord = {
  ...Object.fromEntries(CORE_STAT_KEYS.map((key) => [key, 0])),
  influence: 0,
};

const DEFAULT_UPGRADES: RawRecord = {
  ...Object.fromEntries(
    CORE_STAT_KEYS.map((key) => [key, [false, false, false, false]]),
  ),
  influence: [false, false, false, false],
};

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

function hasMeaningfulValue(value: unknown): boolean {
  if (value === undefined || value === null) return false;
  if (typeof value === 'boolean') return value;
  if (typeof value === 'number') return value !== 0;
  if (typeof value === 'string') return value.trim() !== '';
  if (Array.isArray(value)) return value.some(hasMeaningfulValue);
  if (isRecord(value)) return Object.values(value).some(hasMeaningfulValue);
  return true;
}

/** Влияние по умолчанию (30) не считается потерей: так писал старый тип. */
function hasMeaningfulInfluence(value: unknown): boolean {
  return typeof value === 'number' && value !== 30 && value !== 0;
}

/** Добавить строку миграции в `notes` один раз (идемпотентность). */
function appendMigrationNote(raw: RawRecord, line: string): void {
  const notes = typeof raw.notes === 'string' ? raw.notes : '';
  if (notes.includes(line)) return;
  const block = `${MIGRATION_NOTE_MARKER} ${line}`;
  raw.notes = notes.trim() ? `${notes.trimEnd()}\n\n${block}` : block;
}

/** Пророчества и эффекты хранятся ID; старые фразы → ID (v1). */
function normalizeDivination(raw: RawRecord, warnings: string[]): void {
  const divinationRaw =
    typeof raw.divination === 'string' ? raw.divination : '';
  const effectRaw =
    typeof raw.divinationEffect === 'string' ? raw.divinationEffect : '';

  const divinationId = resolveDivinationId(divinationRaw);
  if (divinationId) {
    raw.divination = divinationId;
    const canonicalEffect = effectIdForDivination(divinationId);
    if (canonicalEffect) raw.divinationEffect = canonicalEffect;
  } else if (divinationRaw) {
    warnings.push(
      `неизвестное пророчество оставлено как есть: ${divinationRaw}`,
    );
    raw.divination = divinationRaw;
  }

  const resolvedEffect = resolveDivinationEffectId(effectRaw);
  if (resolvedEffect) {
    if (!divinationId) raw.divinationEffect = resolvedEffect;
  } else if (effectRaw) {
    raw.divinationEffect = effectRaw;
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
    nextUpgrades[key] = Array.isArray(upgrades[key])
      ? upgrades[key]
      : [false, false, false, false];
  }
  nextUpgrades.influence = Array.isArray(upgrades.influence)
    ? upgrades.influence
    : [false, false, false, false];
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
    warnings.push(
      'dh2: fatigue1st перенесена в notes (поля в листе больше нет)',
    );
  }
  delete character.fatigue1st;
  if (!isRecord(character.fatigue2nd)) character.fatigue2nd = { current: 0 };

  character.stats = nextStats;
  character.statUpgrades = nextUpgrades;
  character.statNotes = nextNotes;

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
  normalizeDivination(character, warnings);
  enforceDh2Fields(character, warnings);

  return {
    character: character as unknown as DH2Character,
    warnings,
  };
}
