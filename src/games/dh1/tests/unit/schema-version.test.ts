import fs from 'node:fs';
import path from 'node:path';

import { describe, expect, it } from 'vitest';

import { createDh1Defaults } from '@/games/dh1/defaults';
import { DH1_SCHEMA_VERSION } from '@/games/dh1/schema-version';
import { normalizeCharacterRecord } from '@/lib/character-version';

/**
 * ─── LANDMARK: DH1 SCHEMA VERSION TESTS ──────────────────────────────────
 * Старые листы 1e (schemaVersion 2) обязаны открываться без потери данных:
 * лист добирает аддитивные блоки DH1APP, а версия формата у модуля своя —
 * глобальная `CURRENT_SCHEMA_VERSION` для этого не меняется.
 *
 * Легаси-фикстуры общие для хоста и редакций и лежат в `tests/unit/fixtures`
 * (AGENTS.md § 4), поэтому путь считается от корня воркспейса.
 */

const FIXTURES = path.join(process.cwd(), 'tests', 'unit', 'fixtures');

function fixture(name: string): Record<string, unknown> {
  return JSON.parse(fs.readFileSync(path.join(FIXTURES, name), 'utf8'));
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
    // Пол нормализуется в канонический код, подпись в данных не живёт.
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

describe('создание dh1: пол, безумие, порча', () => {
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
});
