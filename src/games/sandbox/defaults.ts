import { SANDBOX_SCHEMA_VERSION } from './schema-version';
import { SANDBOX_SYSTEM_ID, type SandboxCharacter } from './types';

/** Черновик листа: `id` присваивает сервер. */
export type SandboxDraft = Omit<SandboxCharacter, 'id'>;

/** Сумма характеристик — то же правило, что в `deriveSandbox`. */
export function sandboxTotal(might: number, wits: number): number {
  return might + wits;
}

export function createSandboxDefaults(
  input: Readonly<Record<string, unknown>> = {},
): SandboxDraft {
  const name = typeof input.name === 'string' ? input.name : '';
  const rank = typeof input.rank === 'string' ? input.rank : 'Novice';
  const stats = { might: 10, wits: 10 };
  return {
    name,
    systemId: SANDBOX_SYSTEM_ID,
    gameSystem: 'Sandbox — Test Game',
    schemaVersion: SANDBOX_SCHEMA_VERSION,
    rank,
    stats,
    total: sandboxTotal(stats.might, stats.wits),
    notes: '',
  };
}
