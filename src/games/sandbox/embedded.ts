import type { SandboxCharacter, SandboxCompanion } from './types';

/**
 * ─── LANDMARK: EXAMPLE EMBEDDED ENTITY ───────────────────────────────────
 * Спутник — вложенная в лист сущность с виртуальным id `companion-<id>`.
 * Ядро не знает, что это, и хранит только формат id; поиск и обновление
 * описывает плагин. Так же устроены спутники D&D 5e.
 */
const COMPANION_PREFIX = 'companion-';

function companionIdFromVirtual(virtualId: string): string | undefined {
  if (!virtualId.startsWith(COMPANION_PREFIX)) return undefined;
  const id = virtualId.slice(COMPANION_PREFIX.length);
  return id || undefined;
}

export function sandboxFindEmbedded(
  character: SandboxCharacter,
  virtualId: string,
): Record<string, unknown> | undefined {
  const id = companionIdFromVirtual(virtualId);
  if (!id || character.companion?.id !== id) return undefined;
  return character.companion as unknown as Record<string, unknown>;
}

export function sandboxUpdateEmbedded(
  character: SandboxCharacter,
  virtualId: string,
  data: Readonly<Record<string, unknown>>,
):
  | { character: SandboxCharacter; patch: Partial<SandboxCharacter> }
  | undefined {
  const existing = sandboxFindEmbedded(character, virtualId);
  if (!existing) return undefined;

  const companion: SandboxCompanion = {
    ...(existing as unknown as SandboxCompanion),
    ...(data as Partial<SandboxCompanion>),
    // Виртуальный id не меняется: он адрес сущности в листе.
    id: (existing as unknown as SandboxCompanion).id,
  };
  const patch: Partial<SandboxCharacter> = { companion };
  return { character: { ...character, ...patch }, patch };
}
