import { describe, expect, it } from 'vitest';

import { createDh1Defaults } from '@/games/dh1/defaults';
import { buildDh1PortableJson } from '@/games/dh1/export';
import { migrateDh1V6toV7 } from '@/games/dh1/migrations';
import { normalizeDh1 } from '@/games/dh1/normalize';
import { getGameModule } from '@/games/registry';
import type { GameExportConfig } from '@/games/types';

/**
 * ─── LANDMARK: DH1 FREEZE DIVINATION TEXT ────────────────────────────────
 * Миграция v6 → v7 и бэкфилл 0.22.0: в листе появляются необязательные
 * `divinationText`/`divinationEffectText` (обе локали). Шаг ничего не
 * переписывает — он только разрешает полям существовать, чтобы старая
 * сборка не вычистила замороженный текст при сохранении.
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

const FROZEN = {
  en: 'Ash keeps no names.',
  ru: 'Пепел не помнит имён.',
};

function sheetWithFrozenText(overrides: Record<string, unknown> = {}) {
  return {
    ...createDh1Defaults(),
    id: 'dh1-frozen',
    userId: 'user-test',
    name: 'Acolyte Vex',
    divination: 'painOfBullet',
    divinationEffect: 'toughness1',
    divinationText: FROZEN,
    divinationEffectText: FROZEN,
    schemaVersion: 6,
    ...overrides,
  };
}

describe('DH1 v6 → v7: замороженный текст пророчества', () => {
  it('не теряет ни одного поля и не трогает значения', () => {
    const before = sheetWithFrozenText();
    const next = migrateDh1V6toV7(before, []);

    expect(next).toEqual(before);
    expect(next.divinationText).toEqual(FROZEN);
    expect(next.divinationEffectText).toEqual(FROZEN);
  });

  it('идемпотентна: повторный прогон даёт тот же документ', () => {
    const once = migrateDh1V6toV7(sheetWithFrozenText(), []);
    const twice = migrateDh1V6toV7(once, []);

    expect(twice).toEqual(once);
  });

  it('normalize сохраняет замороженный текст', () => {
    const { character } = normalizeDh1(sheetWithFrozenText());
    const cast = character as unknown as Record<string, unknown>;

    expect(cast.divinationText).toEqual(FROZEN);
    expect(cast.divinationEffectText).toEqual(FROZEN);
  });

  it('экспорт выводит замороженный текст рядом с id', () => {
    const { character } = normalizeDh1(sheetWithFrozenText());
    const json = buildDh1PortableJson(character, EXPORT_ALL);

    expect(json.divination).toBe('painOfBullet');
    expect(json.divinationText).toEqual(FROZEN);
    expect(json.divinationEffectText).toEqual(FROZEN);
  });

  it('модуль объявляет версию 7 и шаг 6 → 7', () => {
    const module = getGameModule('dh1');

    expect(module?.schemaVersion).toBe(7);
    expect(
      module?.migrations?.some((step) => step.from === 6 && step.to === 7),
    ).toBe(true);
  });
});
