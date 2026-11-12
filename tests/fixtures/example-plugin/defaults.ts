import { CURRENT_SCHEMA_VERSION } from '@/games/plugin-api';

import type { ExampleCharacter } from './types';

/** Черновик листа: `id` присваивает сервер. */
export type ExampleDraft = Omit<ExampleCharacter, 'id'>;

export function createExampleDefaults(
  input: Readonly<Record<string, unknown>> = {},
): ExampleDraft {
  const name = typeof input.name === 'string' ? input.name : '';
  const rank = typeof input.rank === 'string' ? input.rank : 'Novice';
  return {
    name,
    systemId: 'example',
    gameSystem: 'Example Game',
    schemaVersion: CURRENT_SCHEMA_VERSION,
    rank,
    stats: { might: 10, wits: 10 },
    notes: '',
  };
}
