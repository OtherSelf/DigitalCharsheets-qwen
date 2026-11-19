import { describe, expect, it } from 'vitest';

import { buildDh1ExcelSections } from '@/games/dh1/excel';
import { buildDh1PortableJson } from '@/games/dh1/export';
import { normalizeDh1 } from '@/games/dh1/normalize';
import { dh1CharacterSchema } from '@/games/dh1/schema';
import { DH1_SCHEMA_VERSION } from '@/games/dh1/schema-version';
import type { GameExportConfig } from '@/games/types';

import { makeDhCharacter } from '@tests/support';

/**
 * ─── LANDMARK: DH1 CONDITIONS TESTS ──────────────────────────────────────
 * Состояния Безумия/Порчи 1e: миграция переносит текстовые
 * mutations/disorders/defilements в структурированные `conditions` без
 * потерь, повторная нормализация не дублирует элементы, а JSON/Excel-экспорт
 * показывают подписи, а не коды.
 *
 * Проверки 1e живут рядом с редакцией: состояния DH1 переносит своя
 * миграция, dh2 к этой проверке не причастен.
 */

const EXPORT_ALL: GameExportConfig = {
  includeBasicInfo: true,
  includeStats: true,
  includeCombat: true,
  includeEquipment: true,
  includeInventory: true,
  includeSpells: true,
  includeNarrative: true,
  includeProgression: true,
  includeCompanions: true,
  includeQuestLog: true,
  includeCustomHouseRules: true,
};

/**
 * Полный лист 1e: `makeDhCharacter` — облегчённая заготовка миграций, в ней
 * нет обязательных полей базы, которые требует схема.
 */
function baseDh1(overrides: Record<string, unknown> = {}) {
  return {
    ...makeDhCharacter(overrides),
    characterClass: 'Adept',
    backstory: '',
    notes: '',
    questLog: [],
    worldVariant: '',
    divination: '',
    divinationEffect: '',
    quirk: '',
    height: '',
    weight: '',
    age: '',
    skinColor: '',
    hairColor: '',
    eyeColor: '',
    alternatePath: null,
    advancedPath: null,
    criticalConditions: [],
    fatigue1st: { current: 0 },
    ...overrides,
  };
}

/** Legacy-лист DH1 с текстовыми состояниями, которые переносит миграция. */
function legacyDh1(): Record<string, unknown> {
  return baseDh1({
    systemId: 'dh1',
    name: 'Legacy',
    mutations: [
      { id: 'm1', name: 'Третья рука', notes: 'Скрывает' },
      { id: 'm2', name: 'Жабры' },
    ],
    insanityDetails: {
      degree: '2',
      traumaModifier: '1',
      disorders: 'Фобия\nПаранойя',
      severity: '3',
    },
    corruptionDetails: {
      degree: '1',
      test: 'Провален',
      defilements: 'Шёпот; Печать',
    },
  });
}

describe('состояния Безумия/Порчи', () => {
  it('DH1: миграция переносит mutations/disorders/defilements без потерь', () => {
    const { character } = normalizeDh1(legacyDh1(), { applyDefaults: true });
    const conditions = character.conditions ?? [];

    expect(
      conditions.map((condition) => [condition.kind, condition.name]),
    ).toEqual([
      ['mutation', 'Третья рука'],
      ['mutation', 'Жабры'],
      ['disorder', 'Фобия'],
      ['disorder', 'Паранойя'],
      ['corruption', 'Шёпот'],
      ['corruption', 'Печать'],
    ]);
    expect(conditions.every((entry) => entry.source === 'legacy')).toBe(true);
    expect(conditions[0].notes).toBe('Скрывает');
    expect(conditions[2].effect).toBe('Фобия');

    // Исходные поля не удаляются: degree/trauma/test и старые тексты на месте.
    expect(character.mutations).toHaveLength(2);
    expect(character.insanityDetails?.disorders).toBe('Фобия\nПаранойя');
    expect(character.insanityDetails?.degree).toBe('2');
    expect(character.corruptionDetails?.test).toBe('Провален');
    expect(character.corruptionDetails?.defilements).toBe('Шёпот; Печать');
  });

  it('DH1: повторная нормализация не дублирует состояния', () => {
    const first = normalizeDh1(legacyDh1(), { applyDefaults: true });
    const second = normalizeDh1(
      first.character as unknown as Record<string, unknown>,
      { applyDefaults: true },
    );

    expect(second.character.conditions).toEqual(first.character.conditions);
    expect(second.character.conditions).toHaveLength(6);
  });

  it('DH1: лист без conditions проходит схему и получает пустой массив', () => {
    const { character } = normalizeDh1(
      baseDh1({ systemId: 'dh1', name: 'Без состояний' }),
      { applyDefaults: true },
    );

    expect(character.conditions).toEqual([]);
    expect(dh1CharacterSchema.parse(character).conditions).toEqual([]);
    // `conditions` появились в версии 4: тест про аддитивность, не про текущую.
    expect(DH1_SCHEMA_VERSION).toBeGreaterThanOrEqual(4);
  });

  it('DH1: conditions попадают в JSON- и Excel-экспорт', () => {
    const { character } = normalizeDh1(legacyDh1(), { applyDefaults: true });
    const translate = (key: string) => key;

    const portable = buildDh1PortableJson(character, EXPORT_ALL);
    expect(portable.conditions).toEqual(character.conditions);

    const excel = buildDh1ExcelSections(character, EXPORT_ALL, translate);
    const cells = excel
      .flatMap((section) => section.rows)
      .flat()
      .map((cell) => String(cell ?? '').trim());
    expect(cells).toContain('Третья рука');
    expect(cells).toContain('dh1.conditions.kind.mutation');
    expect(cells).toContain('dh1.conditions.source.legacy');
  });
});
