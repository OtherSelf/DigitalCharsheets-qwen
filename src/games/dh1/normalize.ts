import type { NormalizeOptions, NormalizeResult } from '../types';
import {
  effectIdForDivination,
  resolveDivinationEffectId,
  resolveDivinationId,
} from './divination-i18n';
import type { DH1Character } from './types';

/**
 * ─── LANDMARK: DH1 NORMALIZE ───────────────────────────────────────────────
 * Приведение legacy/импортированного листа к dh1. Логика принадлежит
 * редакции: ядро не ветвится по `systemId`, dh1 сам знает свои поля и
 * правила (D10).
 *
 * Правила (D3/D8):
 *   • отсутствующие структуры заполняются дефолтами dh1;
 *   • пророчества из английских фраз превращаются в стабильные ID;
 *   • полей 2-й редакции (`influence`, `fatigue2nd`) в dh1 нет, значимые
 *     значения не теряются — уходят в `notes` блоком `[migration v2]`;
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

/** Дефолты dh1: девять характеристик, без `influence` (это dh2). */
const DEFAULT_STATS: RawRecord = Object.fromEntries(
  CORE_STAT_KEYS.map((key) => [key, 0]),
);

const DEFAULT_UPGRADES: RawRecord = Object.fromEntries(
  CORE_STAT_KEYS.map((key) => [key, [false, false, false, false]]),
);

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

function enforceDh1Fields(character: RawRecord, warnings: string[]): void {
  const stats = asRecord(character.stats);
  const upgrades = asRecord(character.statUpgrades);
  const notes = asRecord(character.statNotes);

  const nextStats: RawRecord = { ...stats };
  for (const key of CORE_STAT_KEYS) {
    nextStats[key] = typeof stats[key] === 'number' ? stats[key] : 0;
  }
  const nextUpgrades: RawRecord = { ...upgrades };
  for (const key of CORE_STAT_KEYS) {
    nextUpgrades[key] = Array.isArray(upgrades[key])
      ? upgrades[key]
      : [false, false, false, false];
  }
  const nextNotes: RawRecord = { ...notes };

  delete nextStats.influence;
  delete nextUpgrades.influence;
  delete nextNotes.influence;

  // Значения 2e-полей не выбрасываем, а фиксируем в notes.
  const coldLegacy: string[] = [];
  if (hasMeaningfulInfluence(stats.influence)) {
    coldLegacy.push(`influence=${String(stats.influence)}`);
  }
  if (hasMeaningfulValue(upgrades.influence)) {
    coldLegacy.push(`influence upgrades=${JSON.stringify(upgrades.influence)}`);
  }
  if (hasMeaningfulValue(notes.influence)) {
    coldLegacy.push(`influence note=${String(notes.influence)}`);
  }
  if (hasMeaningfulValue(character.fatigue2nd)) {
    coldLegacy.push(`fatigue2nd=${JSON.stringify(character.fatigue2nd)}`);
  }
  if (coldLegacy.length > 0) {
    appendMigrationNote(
      character,
      `поля 2-й редакции убраны из dh1 и сохранены: ${coldLegacy.join('; ')}`,
    );
    warnings.push(`dh1: поля 2e перенесены в notes (${coldLegacy.join('; ')})`);
  }
  delete character.fatigue2nd;
  if (!isRecord(character.fatigue1st)) character.fatigue1st = { current: 0 };

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

export function normalizeDh1(
  raw: Readonly<Record<string, unknown>>,
  options: NormalizeOptions = {},
): NormalizeResult<DH1Character> {
  const character: RawRecord = { ...raw };
  const warnings: string[] = [];

  if (options.applyDefaults) fillDefaults(character);
  normalizeDivination(character, warnings);
  enforceDh1Fields(character, warnings);

  return {
    character: character as unknown as DH1Character,
    warnings,
  };
}
