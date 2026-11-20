import { createSandboxDefaults, type SandboxDraft } from './defaults';

export function createSandboxDemo(): SandboxDraft {
  return createSandboxDefaults({ name: 'Sandbox Hero', rank: 'Veteran' });
}
