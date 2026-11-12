import { createExampleDefaults, type ExampleDraft } from './defaults';

export function createExampleDemo(): ExampleDraft {
  return createExampleDefaults({ name: 'Example Hero', rank: 'Veteran' });
}
