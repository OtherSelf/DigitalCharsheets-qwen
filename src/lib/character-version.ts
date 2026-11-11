import {
  effectIdForDivination,
  resolveDivinationEffectId,
  resolveDivinationId,
} from './divination-i18n';
import type { Character } from './types';

/**
 * ─── LANDMARK: CHARACTER SCHEMA v1 ─────────────────────────────────────────
 * Чистая (без fs) нормализация листа: используется и серверной миграцией
 * файлов, и клиентским импортом/экспортом. Серверный обход файлов —
 * в `character-schema.ts`.
 *
 * До v1 у DH-листа не было версии, а пророчества хранились английскими
 * фразами. С v1 `schemaVersion: 1`, а `divination`/`divinationEffect` —
 * стабильные ID (`mutationWithout`, `insanity2`).
 */
export const CHARACTER_SCHEMA_VERSION = 1;

export interface ParsedCharacterRecord {
  character: Character;
  changed: boolean;
  issues: string[];
}

export function normalizeCharacterRecord(
  raw: Record<string, unknown>,
): ParsedCharacterRecord {
  const character = { ...raw } as unknown as Character;
  const issues: string[] = [];
  const before = JSON.stringify(character);

  const incomingVersion =
    typeof character.schemaVersion === 'number' ? character.schemaVersion : 0;
  if (incomingVersion > CHARACTER_SCHEMA_VERSION) {
    issues.push(
      `schemaVersion ${incomingVersion} новее поддерживаемой ${CHARACTER_SCHEMA_VERSION}; файл оставлен без изменений`,
    );
    return { character, changed: false, issues };
  }

  if (character.gameSystem === 'Dark Heresy') {
    const divinationRaw =
      typeof character.divination === 'string' ? character.divination : '';
    const effectRaw =
      typeof character.divinationEffect === 'string'
        ? character.divinationEffect
        : '';

    const divinationId = resolveDivinationId(divinationRaw);
    if (divinationId) {
      character.divination = divinationId;
      // Эффект — производное от пророчества; канонизируем его, чтобы
      // старые/рассинхронизированные пары не разъезжались.
      const canonicalEffect = effectIdForDivination(divinationId);
      if (canonicalEffect) character.divinationEffect = canonicalEffect;
    } else if (divinationRaw) {
      issues.push(
        `неизвестное пророчество оставлено как есть: ${divinationRaw}`,
      );
      character.divination = divinationRaw;
    }

    const resolvedEffect = resolveDivinationEffectId(effectRaw);
    if (resolvedEffect) {
      if (!divinationId) character.divinationEffect = resolvedEffect;
    } else if (effectRaw) {
      character.divinationEffect = effectRaw;
    }
  }

  character.schemaVersion = CHARACTER_SCHEMA_VERSION;
  return { character, changed: JSON.stringify(character) !== before, issues };
}
