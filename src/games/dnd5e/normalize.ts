import type { NormalizeOptions, NormalizeResult } from '../types';
import type { DnD5eCharacter } from './types';

/**
 * ─── LANDMARK: DND5E NORMALIZE ─────────────────────────────────────────────
 * Приведение legacy/импортированного листа к D&D 5e. Раньше дефолты
 * отсутствующих структур жили в ядре (`normalizeCharacter` в
 * `src/lib/export-utils.ts`); теперь dnd5e заполняет их сам (этап 2).
 *
 * v1 → v2 для dnd5e — это только `systemId`/`schemaVersion`, их ставит хост;
 * собственных потерь полей у редакции нет, поэтому функция идемпотентна и не
 * меняет данные, если структуры уже на месте.
 */

type RawRecord = Record<string, unknown>;

const DEFAULT_STATS = {
  strength: 10,
  dexterity: 10,
  constitution: 10,
  intelligence: 10,
  wisdom: 10,
  charisma: 10,
};

export function normalizeDnd5e(
  raw: Readonly<Record<string, unknown>>,
  options: NormalizeOptions = {},
): NormalizeResult<DnD5eCharacter> {
  const character: RawRecord = { ...raw };
  const warnings: string[] = [];

  // `||`, как в прежнем ядре: поле перезаписывается только если оно пустое.
  // Дефолты нужны импорту/созданию листа, а не стартовой нормализации.
  if (!options.applyDefaults) {
    return {
      character: character as unknown as DnD5eCharacter,
      warnings,
    };
  }
  if (!character.stats) character.stats = { ...DEFAULT_STATS };
  if (!character.savingThrows) character.savingThrows = [];
  if (!character.skills) character.skills = [];
  if (!character.hitPoints) character.hitPoints = { current: 0, max: 0 };
  if (!character.deathSaves) {
    character.deathSaves = { successes: 0, failures: 0 };
  }
  if (!character.currency) {
    character.currency = { cp: 0, sp: 0, gp: 0, pp: 0, ep: 0 };
  }
  if (!character.equipment) character.equipment = [];
  if (!character.inventory) character.inventory = [];
  if (!character.spells) character.spells = [];
  if (!character.spellSlots) character.spellSlots = {};

  return {
    character: character as unknown as DnD5eCharacter,
    warnings,
  };
}
