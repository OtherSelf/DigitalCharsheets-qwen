import {
  createSandboxDefaults,
  sandboxTotal,
  type SandboxDraft,
} from './defaults';

/**
 * Демо-персонаж: не только имя/ранг, но и вложенный спутник с виртуальным id
 * `companion-*` — так проверяются `findEmbedded`/`updateEmbedded` без ручного
 * создания листа.
 */
export function createSandboxDemo(): SandboxDraft {
  const draft = createSandboxDefaults({
    name: 'Sandbox Hero',
    rank: 'Veteran',
  });
  const stats = { might: 35, wits: 30 };
  return {
    ...draft,
    stats,
    total: sandboxTotal(stats.might, stats.wits),
    notes: 'Demo character for the plugin contract.',
    companion: {
      id: 'servo-skull',
      name: 'Servo-skull',
      kind: 'familiar',
      notes: 'Floats, beeps, carries the lamp.',
    },
  };
}
