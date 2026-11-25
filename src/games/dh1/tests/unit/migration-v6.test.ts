import { describe, expect, it } from 'vitest';

import { createDh1Defaults } from '@/games/dh1/defaults';
import { buildDh1PortableJson } from '@/games/dh1/export';
import { migrateDh1V5toV6 } from '@/games/dh1/migrations';
import { normalizeDh1 } from '@/games/dh1/normalize';
import { dh1CharacterSchema } from '@/games/dh1/schema';
import type { GameExportConfig } from '@/games/types';

/**
 * ─── LANDMARK: DH1 LEGACY → NOTES TAB ────────────────────────────────────
 * Миграция v5 → v6: шесть legacy-полей бумажного листа (`TRAITS`,
 * `Elite Advances`, степень/модификатор Безумия, степень/тест Порчи) уходят
 * во вкладку заметок «Наследие», а сами поля удаляются из листа.
 *
 * Главное свойство — данные не теряются: значения переносятся строками
 * «Поле: значение», повторный прогон ничего не дублирует, старые экспорты
 * принимаются схемой, а новые не выводят вытесненные поля.
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

function legacySheet(overrides: Record<string, unknown> = {}) {
  return {
    id: 'dh1-legacy-sheet',
    userId: 'user-test',
    ...createDh1Defaults(),
    name: 'Acolyte Vex',
    characterClass: 'Adept',
    backstory: '',
    notes: 'Основные заметки',
    questLog: [],
    schemaVersion: 5,
    traumaModifierFree: undefined,
    traits: [
      { id: 't1', name: 'Железное Нутро' },
      { id: 't2', name: 'Твёрдая Рука' },
    ],
    eliteAdvances: [{ id: 'e1', name: 'Присяга Радикала' }],
    insanityDetails: { degree: '2', traumaModifier: '1', severity: '3' },
    corruptionDetails: { degree: '1', test: 'Провален' },
    ...overrides,
  };
}

function tabBody(character: Record<string, unknown>): string {
  const tabs = (character.noteTabs ?? []) as Array<{
    title: string;
    body: string;
  }>;
  const tab = tabs.find((entry) => entry.title === 'Наследие');
  return tab?.body ?? '';
}

describe('DH1: миграция v5 → v6 (наследие в заметки)', () => {
  it('переносит значения шести полей во вкладку «Наследие»', () => {
    const warnings: string[] = [];
    const next = migrateDh1V5toV6(legacySheet(), warnings);

    expect(tabBody(next)).toBe(
      [
        'Черты: Железное Нутро, Твёрдая Рука',
        'Элитные наборы: Присяга Радикала',
        'Степень безумия: 2',
        'Модификатор травмы: 1',
        'Степень порчи: 1',
        'Тест на осквернение: Провален',
      ].join('\n'),
    );
    // Вкладка одна и лежит рядом с основными заметками.
    expect((next.noteTabs as unknown[]).length).toBe(1);
    expect(next.notes).toBe('Основные заметки');
    expect(warnings.length).toBeGreaterThan(0);
  });

  it('удаляет вытесненные поля, но сохраняет прочие legacy-ключи', () => {
    const next = migrateDh1V5toV6(legacySheet(), []);

    expect(next).not.toHaveProperty('traits');
    expect(next).not.toHaveProperty('eliteAdvances');
    expect(next.insanityDetails).toEqual({ severity: '3' });
    expect(next.corruptionDetails).toBeUndefined();
  });

  it('повторный прогон идемпотентен', () => {
    const once = migrateDh1V5toV6(legacySheet(), []);
    const twice = migrateDh1V5toV6(once, []);

    expect(tabBody(twice)).toBe(tabBody(once));
    expect((twice.noteTabs as unknown[]).length).toBe(1);
    expect(twice).toEqual(once);
  });

  it('не трогает лист без legacy-значений', () => {
    const clean = legacySheet({
      traits: [],
      eliteAdvances: [],
      insanityDetails: {},
      corruptionDetails: {},
    });
    const next = migrateDh1V5toV6(clean, []);

    expect(next).not.toHaveProperty('traits');
    expect(next.noteTabs).toBeUndefined();
  });

  it('дописывает недостающие строки в уже существующую вкладку', () => {
    const sheet = legacySheet({
      noteTabs: [
        {
          id: 'dh1-legacy',
          title: 'Наследие',
          body: 'Черты: Железное Нутро, Твёрдая Рука',
        },
      ],
    });
    const next = migrateDh1V5toV6(sheet, []);
    const body = tabBody(next);

    expect(body.startsWith('Черты: Железное Нутро, Твёрдая Рука')).toBe(true);
    expect(body.split('\n')).toHaveLength(6);
  });

  it('при лимите вкладок пишет в основные заметки, а не теряет значения', () => {
    const full = Array.from({ length: 10 }, (_, index) => ({
      id: `tab-${index}`,
      title: `Вкладка ${index}`,
      body: '',
    }));
    const warnings: string[] = [];
    const next = migrateDh1V5toV6(legacySheet({ noteTabs: full }), warnings);

    expect(next.notes).toContain('Наследие:');
    expect(next.notes).toContain('Степень порчи: 1');
    expect(warnings.join(' ')).toContain('лимит');
  });

  it('после миграции лист проходит нормализацию и схему', () => {
    const migrated = migrateDh1V5toV6(legacySheet(), []);
    const { character } = normalizeDh1(migrated, { applyDefaults: true });
    const schema = dh1CharacterSchema.parse(character);

    expect(schema.noteTabs?.[0].title).toBe('Наследие');
    expect(schema.traits).toBeUndefined();
    expect(schema.eliteAdvances).toBeUndefined();
  });

  it('экспорт не выводит вытесненные поля', () => {
    const next = migrateDh1V5toV6(legacySheet(), []);
    const exported = buildDh1PortableJson(next as never, EXPORT_ALL);

    expect(exported).not.toHaveProperty('traits');
    expect(exported).not.toHaveProperty('eliteAdvances');
    // Блок остаётся, но без вытесненных ключей: severity — не наше поле.
    expect(exported.insanityDetails).toEqual({ severity: '3' });
    expect(exported).not.toHaveProperty('corruptionDetails');
    expect(exported.noteTabs).toEqual(next.noteTabs);
  });

  it('старый экспорт с полями принимается схемой', () => {
    const parsed = dh1CharacterSchema.parse(legacySheet());
    expect(parsed.traits?.[0].name).toBe('Железное Нутро');
    expect(parsed.insanityDetails?.degree).toBe('2');
  });
});
