import {
  effectIdForDivination,
  resolveDivinationEffectId,
  resolveDivinationId,
} from './divination-i18n';
import type { Character } from './types';

/**
 * ─── LANDMARK: CHARACTER SCHEMA v2 ─────────────────────────────────────────
 * Чистая (без fs) нормализация листа: используется и серверной миграцией
 * файлов, и клиентским импортом/экспортом. Серверный обход файлов —
 * в `character-schema.ts`.
 *
 * История:
 *   • v1 — DH-пророчества из английских фраз → стабильные ID, `schemaVersion`.
 *   • v2 — дискриминант `systemId` (`dnd5e`/`dh1`/`dh2`) и разделение
 *     редакций DH: у dh1 больше нет `influence` и `fatigue2nd`, у dh2 —
 *     `fatigue1st`; поле `edition` удалено (📌 D3). Значения, которые нельзя
 *     сохранить в целевой редакции, не теряются — уходят в `notes` блоком
 *     `[migration v2]` и в отчёт (📌 D8).
 *
 * 📌 D4 (уточнение): `gameSystem` пока остаётся в данных как legacy-поле для
 * потребителей, ещё не переведённых на реестр (этап 3/5). Удаляется на
 * этапе 7, когда `systemId` станет единственным дискриминантом.
 */
export const CHARACTER_SCHEMA_VERSION = 2;

const MIGRATION_NOTE_MARKER = '[migration v2]';

export interface ParsedCharacterRecord {
  character: Character;
  changed: boolean;
  issues: string[];
}

type RawRecord = Record<string, unknown>;

function isRecord(value: unknown): value is RawRecord {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}

/** Машинный ID редакции; для legacy — по `gameSystem` + `edition` (📌 D3). */
function resolveSystemId(raw: RawRecord): string | undefined {
  const explicit = raw.systemId;
  if (explicit === 'dnd5e' || explicit === 'dh1' || explicit === 'dh2') {
    return explicit;
  }

  if (raw.gameSystem === 'Dungeons & Dragons') return 'dnd5e';
  if (raw.gameSystem === 'Dark Heresy') {
    // '2nd' → dh2; '1st' | 'hybrid' | отсутствие → dh1.
    return raw.edition === '2nd' ? 'dh2' : 'dh1';
  }

  return undefined;
}

function asRecord(value: unknown): RawRecord {
  return isRecord(value) ? value : {};
}

/** Нормализация пророчеств DH (v1) — общая для обеих редакций. */
function normalizeDivination(raw: RawRecord, issues: string[]): void {
  const divinationRaw =
    typeof raw.divination === 'string' ? raw.divination : '';
  const effectRaw =
    typeof raw.divinationEffect === 'string' ? raw.divinationEffect : '';

  const divinationId = resolveDivinationId(divinationRaw);
  if (divinationId) {
    raw.divination = divinationId;
    // Эффект — производное от пророчества; канонизируем его, чтобы старые
    // или рассинхронизированные пары не разъезжались.
    const canonicalEffect = effectIdForDivination(divinationId);
    if (canonicalEffect) raw.divinationEffect = canonicalEffect;
  } else if (divinationRaw) {
    issues.push(`неизвестное пророчество оставлено как есть: ${divinationRaw}`);
    raw.divination = divinationRaw;
  }

  const resolvedEffect = resolveDivinationEffectId(effectRaw);
  if (resolvedEffect) {
    if (!divinationId) raw.divinationEffect = resolvedEffect;
  } else if (effectRaw) {
    raw.divinationEffect = effectRaw;
  }
}

/** Влияние по умолчанию (30) не считается потерей: так писал старый тип. */
function hasMeaningfulInfluence(value: unknown): boolean {
  return typeof value === 'number' && value !== 30 && value !== 0;
}

function hasMeaningfulValue(value: unknown): boolean {
  if (value === undefined || value === null) return false;
  if (typeof value === 'boolean') return value;
  if (typeof value === 'number') return value !== 0;
  if (typeof value === 'string') return value.trim() !== '';
  if (Array.isArray(value)) return value.some(hasMeaningfulValue);
  if (isRecord(value)) return Object.values(value).some(hasMeaningfulValue);
  return true;
}

/**
 * Добавить строку миграции в `notes` один раз (идемпотентность): повторный
 * прогон не должен дублировать блок.
 */
function appendMigrationNote(raw: RawRecord, line: string): void {
  const notes = typeof raw.notes === 'string' ? raw.notes : '';
  if (notes.includes(line)) return;
  const block = `${MIGRATION_NOTE_MARKER} ${line}`;
  raw.notes = notes.trim() ? `${notes.trimEnd()}\n\n${block}` : block;
}

/**
 * Разделить поля DH по редакции. Ничего не удаляем молча: значимые значения
 * чужой редакции попадают в `notes` и в `issues`.
 */
function migrateDarkHeresyFields(
  raw: RawRecord,
  systemId: 'dh1' | 'dh2',
  issues: string[],
): void {
  const stats = asRecord(raw.stats);
  const upgrades = asRecord(raw.statUpgrades);
  const notes = asRecord(raw.statNotes);

  const sharedStatKeys = [
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

  // Общие ключи приводим к числам/корректным типам, чтобы схема v2
  // проходила; незнакомые ключи не выбрасываем (читаемость важнее строгости).
  const nextStats: RawRecord = { ...stats };
  for (const key of sharedStatKeys) {
    nextStats[key] = typeof stats[key] === 'number' ? stats[key] : 0;
  }
  const nextUpgrades: RawRecord = { ...upgrades };
  for (const key of sharedStatKeys) {
    nextUpgrades[key] = Array.isArray(upgrades[key])
      ? upgrades[key]
      : [false, false, false, false];
  }
  const nextNotes: RawRecord = { ...notes };

  if (systemId === 'dh2') {
    delete nextStats.fatigue1st;
    nextStats.influence =
      typeof stats.influence === 'number' ? stats.influence : 30;
    nextUpgrades.influence = Array.isArray(upgrades.influence)
      ? upgrades.influence
      : [false, false, false, false];
    if (typeof notes.influence === 'string') {
      nextNotes.influence = notes.influence;
    }

    const legacyFatigue = raw.fatigue1st;
    if (hasMeaningfulValue(legacyFatigue)) {
      appendMigrationNote(
        raw,
        `усталость 1-й редакции сохранена здесь: ${JSON.stringify(legacyFatigue)}`,
      );
      issues.push(
        'dh2: fatigue1st перенесена в notes (поля в листе больше нет)',
      );
    }
    delete raw.fatigue1st;
    if (!isRecord(raw.fatigue2nd)) raw.fatigue2nd = { current: 0 };
  } else {
    delete nextStats.influence;
    delete nextUpgrades.influence;
    delete nextNotes.influence;
    // dh1: значения 2e-полей не выбрасываем, а фиксируем в notes.
    const coldLegacy: string[] = [];
    if (hasMeaningfulInfluence(stats.influence)) {
      coldLegacy.push(`influence=${String(stats.influence)}`);
    }
    if (hasMeaningfulValue(upgrades.influence)) {
      coldLegacy.push(
        `influence upgrades=${JSON.stringify(upgrades.influence)}`,
      );
    }
    if (hasMeaningfulValue(notes.influence)) {
      coldLegacy.push(`influence note=${String(notes.influence)}`);
    }
    if (hasMeaningfulValue(raw.fatigue2nd)) {
      coldLegacy.push(`fatigue2nd=${JSON.stringify(raw.fatigue2nd)}`);
    }
    if (coldLegacy.length > 0) {
      appendMigrationNote(
        raw,
        `поля 2-й редакции убраны из dh1 и сохранены: ${coldLegacy.join('; ')}`,
      );
      issues.push(`dh1: поля 2e перенесены в notes (${coldLegacy.join('; ')})`);
    }
    delete raw.fatigue2nd;
    if (!isRecord(raw.fatigue1st)) raw.fatigue1st = { current: 0 };
  }

  raw.stats = nextStats;
  raw.statUpgrades = nextUpgrades;
  raw.statNotes = nextNotes;

  // Тренировка навыка: `plus30` стало обязательным в типе v2, а старые файлы
  // могли его не иметь. Недостающее — false, существующее сохраняем.
  if (Array.isArray(raw.skills)) {
    raw.skills = raw.skills.map((skill) => {
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

export function normalizeCharacterRecord(
  raw: Record<string, unknown>,
): ParsedCharacterRecord {
  const character = { ...raw };
  const issues: string[] = [];
  const before = JSON.stringify(character);

  const incomingVersion =
    typeof character.schemaVersion === 'number' ? character.schemaVersion : 0;
  if (incomingVersion > CHARACTER_SCHEMA_VERSION) {
    issues.push(
      `schemaVersion ${incomingVersion} новее поддерживаемой ${CHARACTER_SCHEMA_VERSION}; файл оставлен без изменений`,
    );
    return {
      character: character as unknown as Character,
      changed: false,
      issues,
    };
  }

  const systemId = resolveSystemId(character);
  if (!systemId) {
    issues.push(
      'не удалось определить редакцию (нет systemId/gameSystem); файл оставлен без изменений',
    );
    return {
      character: character as unknown as Character,
      changed: false,
      issues,
    };
  }
  character.systemId = systemId;

  if (systemId === 'dh1' || systemId === 'dh2') {
    normalizeDivination(character, issues);
    migrateDarkHeresyFields(character, systemId, issues);
  }
  delete character.edition;

  character.schemaVersion = CHARACTER_SCHEMA_VERSION;
  return {
    character: character as unknown as Character,
    changed: JSON.stringify(character) !== before,
    issues,
  };
}
