import fs from 'node:fs';
import path from 'node:path';

import { describe, expect, it } from 'vitest';

import { createDh1Defaults } from '@/games/dh1/defaults';
import { DH1_SCHEMA_VERSION } from '@/games/dh1/schema-version';
import { createDh2Defaults } from '@/games/dh2/defaults';
import { DH2_SCHEMA_VERSION } from '@/games/dh2/schema-version';
import { normalizeCharacterRecord } from '@/lib/character-version';

/**
 * ─── LANDMARK: DH SCHEMA v3 TESTS ─────────────────────────────────────────
 * Старые листы обеих редакций (schemaVersion 2) обязаны открываться без
 * потери данных: DH1 добирает аддитивные блоки DH1APP, DH2 переводит поля
 * DH1 в `notes` и строки 2-9. Версия формата у DH-модулей своя (3), глобальная
 * `CURRENT_SCHEMA_VERSION` не меняется — у dnd5e формат остался прежним.
 */
function fixture(name: string): Record<string, unknown> {
  return JSON.parse(
    fs.readFileSync(path.join(__dirname, 'fixtures', name), 'utf8'),
  );
}

describe('DH1: миграция листа v2', () => {
  it('сохраняет поля 1e и поднимает версию до модульной', () => {
    const raw = fixture('dh1-legacy-v2.json');
    const { character, changed } = normalizeCharacterRecord(raw);
    const dh = character as unknown as Record<string, unknown>;

    expect(changed).toBe(true);
    expect(dh.systemId).toBe('dh1');
    expect(dh.schemaVersion).toBe(DH1_SCHEMA_VERSION);
    expect(DH1_SCHEMA_VERSION).toBeGreaterThan(2);
    expect(dh.careerPath).toBe('Adept');
    expect(dh.rank).toBe('Scholar');
    expect(dh.divination).toBe('trustYourFear');
    expect(dh.divinationEffect).toBe('agility2Fate1');
    expect(dh.quirk).toBe('Suspicious of psykers.');
    // «Имя игрока» — legacy-ключ: в контракте листа его нет, но старые
    // данные не переписываются и проходят looseObject.
    expect((dh.identity as Record<string, unknown>).playerName).toBe('Игрок');
    // Пол нормализуется в канонический код (D3), подпись в данных не живёт.
    expect((dh.identity as Record<string, unknown>).gender).toBe('male');
    expect(dh.insanityPoints).toEqual({ total: 3, notes: '' });
    expect(dh.corruptionPoints).toEqual({ total: 1, notes: '' });
    expect(dh.traits).toHaveLength(1);
    expect(dh.fatigue1st).toEqual({ current: 1 });
    // Журнал опыта добавлен аддитивно: старый лист получает пустой массив.
    expect(dh.experienceLog).toEqual([]);
  });

  it('повторный прогон идемпотентен', () => {
    const first = normalizeCharacterRecord(fixture('dh1-legacy-v2.json'));
    const second = normalizeCharacterRecord(
      first.character as unknown as Record<string, unknown>,
    );
    expect(second.changed).toBe(false);
    expect(
      (second.character as unknown as Record<string, unknown>).schemaVersion,
    ).toBe(first.character.schemaVersion);
  });
});

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

describe('создание dh1/dh2: пол, безумие, порча', () => {
  it('dh1 берёт значения из формы создания', () => {
    const draft = createDh1Defaults({
      name: 'A',
      gender: 'female',
      insanity: 3,
      corruption: 2,
    });
    expect(draft.identity?.gender).toBe('female');
    expect(draft.insanityPoints.total).toBe(3);
    expect(draft.corruptionPoints.total).toBe(2);
    expect(draft.experienceLog).toEqual([]);
  });

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
