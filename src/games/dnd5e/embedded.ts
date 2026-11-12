import type { DnD5eCharacter, DnDCompanion } from './types';

/**
 * ─── LANDMARK: DND5E EMBEDDED (COMPANIONS) ────────────────────────────────
 * Спутники D&D живут внутри листа (`character.companions`) и открываются
 * виртуальным id `companion-*`. Раньше эту логику знал `character-context`;
 * теперь — плагин (этап 3): ядро только спрашивает модуль по id.
 */
const COMPANION_PREFIX = 'companion-';

function companionIdFromVirtualId(id: string): string | undefined {
  if (!id.startsWith(COMPANION_PREFIX)) return undefined;
  const companionId = id.slice(COMPANION_PREFIX.length);
  return companionId || undefined;
}

export function dnd5eFindEmbedded(
  character: DnD5eCharacter,
  id: string,
): Record<string, unknown> | undefined {
  const companionId = companionIdFromVirtualId(id);
  if (!companionId) return undefined;
  const companion = character.companions?.find(
    (item: DnDCompanion) => item.id === companionId,
  );
  return companion as unknown as Record<string, unknown> | undefined;
}

export function dnd5eUpdateEmbedded(
  character: DnD5eCharacter,
  id: string,
  data: Readonly<Record<string, unknown>>,
): { character: DnD5eCharacter; patch: Partial<DnD5eCharacter> } | undefined {
  const companionId = companionIdFromVirtualId(id);
  if (!companionId) return undefined;
  if (
    !Array.isArray(character.companions) ||
    !character.companions.some((item) => item.id === companionId)
  ) {
    return undefined;
  }
  const companions = character.companions.map((item) =>
    item.id === companionId
      ? { ...item, ...(data as Partial<DnDCompanion>) }
      : item,
  );
  return {
    character: { ...character, companions },
    patch: { companions },
  };
}
