import { CURRENT_SCHEMA_VERSION } from '@/games/plugin-api';

import { SANDBOX_SYSTEM_ID, type SandboxCharacter } from './types';

/** Черновик листа: `id` присваивает сервер. */
export type SandboxDraft = Omit<SandboxCharacter, 'id'>;

export function createSandboxDefaults(
  input: Readonly<Record<string, unknown>> = {},
): SandboxDraft {
  const name = typeof input.name === 'string' ? input.name : '';
  const rank = typeof input.rank === 'string' ? input.rank : 'Novice';
  return {
    name,
    systemId: SANDBOX_SYSTEM_ID,
    gameSystem: 'Sandbox — Test Game',
    schemaVersion: CURRENT_SCHEMA_VERSION,
    rank,
    stats: { might: 10, wits: 10 },
    notes: '',
  };
}
