import { test } from 'vitest';

import { applyCharacterDerive } from '@/lib/character-derive';
import { normalizeCharacterRecord } from '@/lib/character-version';
import { diffCharacterRecords } from '@/lib/history-diff';

import { makeCharacter } from '@tests/support';

/**
 * Микробенчи чистого CPU-пути листа: normalize + derive на каждом чтении и
 * diff на каждом сохранении. Здесь нет fs — только то, что выполняется под
 * нагрузкой в route handler.
 */

function bigSheet(): Record<string, unknown> {
  const sheet = makeCharacter('dh1', { name: 'Bench Acolyte' });
  sheet.notes = 'x'.repeat(50_000);
  return sheet as Record<string, unknown>;
}

function changedPair(): {
  before: Record<string, unknown>;
  after: Record<string, unknown>;
} {
  const before = bigSheet();
  const after = structuredClone(before);
  const stats = after.stats as Record<string, number>;
  let index = 0;
  for (const key of Object.keys(stats)) {
    stats[key] = stats[key] + (index % 2 === 0 ? 1 : -1);
    index += 1;
  }
  (after as Record<string, unknown>).notes = 'y'.repeat(50_000);
  return { before, after };
}

test('normalize + derive', async ({ bench }) => {
  const sheet = bigSheet();
  await bench('normalizeCharacterRecord (DH1, ~50 КБ notes)', () => {
    normalizeCharacterRecord({ ...sheet });
  }).run();
  await bench('applyCharacterDerive (DH1)', () => {
    applyCharacterDerive(sheet);
  }).run();
});

test('diffCharacterRecords', async ({ bench }) => {
  const { before, after } = changedPair();
  await bench('DH1: все характеристики + notes', () => {
    diffCharacterRecords(before, after);
  }).run();
  await bench('DH1: без изменений (ранний выход)', () => {
    diffCharacterRecords(before, before);
  }).run();
});
