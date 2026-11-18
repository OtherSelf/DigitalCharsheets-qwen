import fs from 'node:fs';
import path from 'node:path';

import { describe, expect, it } from 'vitest';

import { createDh2Defaults } from '@/games/dh2/defaults';
import { DH2_SCHEMA_VERSION } from '@/games/dh2/schema-version';
import { normalizeCharacterRecord } from '@/lib/character-version';

/**
 * ─── LANDMARK: DH2 SCHEMA VERSION TESTS ──────────────────────────────────
 * Старые листы 2e (schemaVersion 2) обязаны открываться без потери данных:
 * поля DH1 уходят в `notes`, строки 2-9 дополняются, а версия формата у
 * модуля своя — глобальная `CURRENT_SCHEMA_VERSION` для этого не меняется.
 *
 * Легаси-фикстуры общие для хоста и редакций и лежат в `tests/unit/fixtures`
 * (AGENTS.md § 4), поэтому путь считается от корня воркспейса.
 */

const FIXTURES = path.join(process.cwd(), 'tests', 'unit', 'fixtures');

function fixture(name: string): Record<string, unknown> {
  return JSON.parse(fs.readFileSync(path.join(FIXTURES, name), 'utf8'));
}

describe('DH2: миграция листа v2', () => {
  it('переводит поля DH1 в notes и строки 2-9, версия модульная', () => {
    const raw = fixture('dh2-legacy-v2.json');
    const { character, changed } = normalizeCharacterRecord(raw);
    const dh = character as unknown as Record<string, unknown>;

    expect(changed).toBe(true);
    expect(dh.systemId).toBe('dh2');
    expect(dh.schemaVersion).toBe(DH2_SCHEMA_VERSION);
    expect(DH2_SCHEMA_VERSION).toBeGreaterThan(2);
    expect(dh.careerPath).toBeUndefined();
    expect(dh.rank).toBeUndefined();
    expect(dh.quirk).toBeUndefined();
    expect(dh.worldVariant).toBeUndefined();
    expect(dh.divinationEffect).toBeUndefined();
    expect(dh.homeWorld).toBe('hive-world');
    expect(dh.divination).toBe('d100-01');
    const notes = String(dh.notes);
    expect(notes).toContain('[migration v2]');
    expect(notes).toContain('карьера DH1: Adept');
    expect(notes).toContain('ранг DH1: Rank 2');
    expect(dh.statUpgrades).toBeTruthy();
    const upgrades = dh.statUpgrades as Record<string, boolean[]>;
    expect(upgrades.intelligence).toHaveLength(5);
    expect(dh.background).toBe('');
    expect(dh.role).toBe('');
    expect(dh.gender).toBe('');
    expect(dh.psy).toEqual({ rating: 0, disciplines: [], powers: [] });
  });

  it('повторный прогон идемпотентен', () => {
    const first = normalizeCharacterRecord(fixture('dh2-legacy-v2.json'));
    const second = normalizeCharacterRecord(
      first.character as unknown as Record<string, unknown>,
    );
    expect(second.changed).toBe(false);
    expect(
      (second.character as unknown as Record<string, unknown>).schemaVersion,
    ).toBe(first.character.schemaVersion);
  });
});

describe('создание dh2: пол, безумие, порча', () => {
  it('dh2 берёт значения из формы создания', () => {
    const draft = createDh2Defaults({
      name: 'B',
      gender: 'male',
      insanity: 4,
      corruption: 1,
    });
    expect(draft.gender).toBe('male');
    expect(draft.insanityPoints.total).toBe(4);
    expect(draft.corruptionPoints.total).toBe(1);
    expect(draft.experienceLog).toEqual([]);
  });
});
