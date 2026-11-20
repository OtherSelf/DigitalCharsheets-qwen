import type { GameExportConfig } from '@/games/types';

import type { SandboxCharacter } from './types';

export function buildSandboxPortableJson(
  character: SandboxCharacter,
  config: GameExportConfig,
): Record<string, unknown> {
  const json: Record<string, unknown> = { name: character.name };
  if (config.includeBasicInfo) json.rank = character.rank;
  if (config.includeStats) json.stats = character.stats;
  if (config.includeNarrative) json.notes = character.notes;
  return json;
}
