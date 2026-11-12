import { resolveCharacterSystemId } from '@/games/character-system';
import {
  CURRENT_SCHEMA_VERSION,
  type NormalizeOptions,
} from '@/games/plugin-api';
import { getGameModule } from '@/games/registry';
import type { CharacterMigration } from '@/games/types';

import type { Character } from './types';

/**
 * ─── LANDMARK: CHARACTER SCHEMA NORMALIZATION ──────────────────────────────
 * Оркестратор нормализации листа (этап 2): определить редакцию (явный
 * `systemId` или legacy-алиасы из `plugin.json`), взять модуль из реестра и
 * отдать работу плагину — `module.normalize`. Дефолты, пророчества и перенос
 * полей между редакциями живут в `src/games/<id>/normalize.ts`; ядро больше
 * не знает ни одной игры по имени.
 *
 * Чистая (без fs) функция: используется и серверной миграцией файлов
 * (`character-schema.ts`), и клиентским импортом/экспортом.
 *
 * История:
 *   • v1 — DH-пророчества из английских фраз → стабильные ID, `schemaVersion`.
 *   • v2 — дискриминант `systemId` и разделение редакций DH (D3).
 *
 * D4: `gameSystem` остаётся в данных как legacy-поле; единственный
 * дискриминант — `systemId`.
 */

/** Текущая версия схемы листа; у плагина — `manifest.schemaVersion`. */
export const CHARACTER_SCHEMA_VERSION = CURRENT_SCHEMA_VERSION;

export interface ParsedCharacterRecord {
  character: Character;
  changed: boolean;
  issues: string[];
  /** Сколько шагов цепочки миграций применилось. */
  migrationsApplied: number;
}

/**
 * Применить упорядоченную цепочку миграций плагина к ещё не версионированному
 * листу. Порядок — массив `migrations` модуля; шаг применяется, если файл
 * старше его `to`. Возвращает число примененных шагов.
 */
export function applyCharacterMigrations(
  migrations: readonly CharacterMigration[],
  raw: Readonly<Record<string, unknown>>,
  incomingVersion: number,
): { character: Record<string, unknown>; applied: number } {
  let character = { ...raw };
  let applied = 0;
  for (const step of migrations) {
    if (incomingVersion >= step.to) continue;
    character = { ...character, ...step.migrate(character) };
    applied += 1;
  }
  return { character, applied };
}

export function normalizeCharacterRecord(
  raw: Record<string, unknown>,
  options: NormalizeOptions = {},
): ParsedCharacterRecord {
  const character = { ...raw };
  const issues: string[] = [];
  const before = JSON.stringify(character);

  const explicit =
    typeof character.systemId === 'string' ? character.systemId : undefined;
  // Явный systemId, для которого плагин не установлен: не теряем лист.
  if (explicit && !getGameModule(explicit)) {
    issues.push(
      `плагин "${explicit}" не установлен; файл оставлен без изменений`,
    );
    return {
      character: character as unknown as Character,
      changed: false,
      issues,
      migrationsApplied: 0,
    };
  }

  const systemId = explicit ?? resolveCharacterSystemId(character);
  const gameModule = systemId ? getGameModule(systemId) : undefined;
  if (!systemId || !gameModule) {
    issues.push(
      'не удалось определить редакцию (нет systemId/gameSystem); файл оставлен без изменений',
    );
    return {
      character: character as unknown as Character,
      changed: false,
      issues,
      migrationsApplied: 0,
    };
  }

  const targetVersion = gameModule.schemaVersion;
  const incomingVersion =
    typeof character.schemaVersion === 'number' ? character.schemaVersion : 0;
  if (incomingVersion > targetVersion) {
    issues.push(
      `schemaVersion ${incomingVersion} новее поддерживаемой ${targetVersion}; файл оставлен без изменений`,
    );
    return {
      character: character as unknown as Character,
      changed: false,
      issues,
      migrationsApplied: 0,
    };
  }

  if (typeof gameModule.normalize !== 'function') {
    issues.push(
      `плагин "${systemId}" не умеет нормализовать лист; файл оставлен без изменений`,
    );
    return {
      character: character as unknown as Character,
      changed: false,
      issues,
      migrationsApplied: 0,
    };
  }

  // Цепочка миграций (пока пустая у всех плагинов: v1→v2 — это нормализация).
  const migrated = applyCharacterMigrations(
    gameModule.migrations,
    character,
    incomingVersion,
  );
  Object.assign(character, migrated.character);

  character.systemId = systemId;
  character.schemaVersion = targetVersion;
  delete character.edition;

  const normalized = gameModule.normalize(character, options);
  issues.push(...(normalized.warnings ?? []));

  const result = {
    ...normalized.character,
    systemId,
    schemaVersion: targetVersion,
  } as unknown as Character;
  delete (result as { edition?: unknown }).edition;

  return {
    character: result,
    changed: JSON.stringify(result) !== before,
    issues,
    migrationsApplied: migrated.applied,
  };
}
