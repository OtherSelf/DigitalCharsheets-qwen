import { describe, expect, it } from 'vitest';

import { createDh2Defaults } from '@/games/dh2/defaults';
import { buildDh2PortableJson } from '@/games/dh2/export';
import { migrateDh2V5toV6 } from '@/games/dh2/migrations';
import { normalizeDh2 } from '@/games/dh2/normalize';
import { getGameModule } from '@/games/registry';
import type { GameExportConfig } from '@/games/types';

/**
 * ─── LANDMARK: DH2 FREEZE DIVINATION TEXT ────────────────────────────────
 * Миграция v5 → v6 и бэкфилл 0.22.0: в лист добавляются необязательные
 * `divinationText`/`divinationEffectText` (обе локали). Шаг данных не меняет —
 * он разрешает полям существовать, чтобы старая сборка их не вычистила.
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
    ...createDh2Defaults(),
    id: 'dh2-frozen',
    userId: 'user-test',
    name: 'Acolyte Vex',
    divination: 'd100-10',
    divinationText: FROZEN,
    divinationEffectText: FROZEN,
    schemaVersion: 5,
    ...overrides,
  };
}

describe('DH2 v5 → v6: замороженный текст пророчества', () => {
  it('не теряет ни одного поля и не трогает значения', () => {
    const before = sheetWithFrozenText();
    const next = migrateDh2V5toV6(before, []);

    expect(next).toEqual(before);
    expect(next.divinationText).toEqual(FROZEN);
    expect(next.divinationEffectText).toEqual(FROZEN);
  });

  it('идемпотентна: повторный прогон даёт тот же документ', () => {
    const once = migrateDh2V5toV6(sheetWithFrozenText(), []);
    const twice = migrateDh2V5toV6(once, []);

    expect(twice).toEqual(once);
  });

  it('normalize сохраняет замороженный текст', () => {
    const { character } = normalizeDh2(sheetWithFrozenText());
    const cast = character as unknown as Record<string, unknown>;

    expect(cast.divinationText).toEqual(FROZEN);
    expect(cast.divinationEffectText).toEqual(FROZEN);
  });

  it('экспорт выводит замороженный текст рядом с id', () => {
    const { character } = normalizeDh2(sheetWithFrozenText());
    const json = buildDh2PortableJson(character, EXPORT_ALL);

    expect(json.divination).toBe('d100-10');
    expect(json.divinationText).toEqual(FROZEN);
    expect(json.divinationEffectText).toEqual(FROZEN);
  });

  it('модуль объявляет версию 6 и шаг 5 → 6', () => {
    const gameModule = getGameModule('dh2');

    expect(gameModule?.schemaVersion).toBe(6);
    expect(
      gameModule?.migrations?.some((step) => step.from === 5 && step.to === 6),
    ).toBe(true);
  });

  it('предупреждает о legacy-листе без замороженного текста', () => {
    const audit = getGameModule('dh2')?.auditCharacter;
    expect(audit).toBeDefined();
    expect(audit!({ divination: 'd100-10' } as never)).toHaveLength(1);
    expect(
      audit!({ divination: 'd100-10', divinationText: { ru: 'x' } } as never),
    ).toHaveLength(0);
    expect(audit!({ divination: '' } as never)).toHaveLength(0);
  });
});
