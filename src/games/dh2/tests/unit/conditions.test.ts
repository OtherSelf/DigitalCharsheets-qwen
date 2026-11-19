import { describe, expect, it } from 'vitest';

import { createDh2Defaults } from '@/games/dh2/defaults';
import { buildDh2PortableJson } from '@/games/dh2/export';
import { normalizeDh2 } from '@/games/dh2/normalize';
import { dh2CharacterSchema } from '@/games/dh2/schema';
import { DH2_SCHEMA_VERSION } from '@/games/dh2/schema-version';
import type { GameExportConfig } from '@/games/types';

/**
 * ─── LANDMARK: DH2 CONDITIONS TESTS ──────────────────────────────────────
 * Состояния 2e аддитивны: `conditions` — просто массив, миграции
 * текстов нет, старые счётчики Безумия/Порчи остаются. Проверяем, что пустой
 * лист получает пустой массив, а экспорт не теряет элементы.
 *
 * Проверки 2e живут рядом с редакцией: dh1 к этому файлу не причастен.
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

describe('состояния Безумия/Порчи', () => {
  it('DH2: условия аддитивны, по умолчанию пустой массив', () => {
    const draft = {
      ...createDh2Defaults({}),
      id: 'dh2-condition-test',
      systemId: 'dh2',
    };
    const { character } = normalizeDh2(draft, { applyDefaults: true });

    expect(character.conditions).toEqual([]);
    expect(dh2CharacterSchema.parse(character).conditions).toEqual([]);
    expect(DH2_SCHEMA_VERSION).toBeGreaterThanOrEqual(4);
  });

  it('DH2: conditions попадают в JSON-экспорт', () => {
    const draft = {
      ...createDh2Defaults({}),
      id: 'dh2-condition-test',
      systemId: 'dh2',
    };
    const { character } = normalizeDh2(draft, { applyDefaults: true });
    character.conditions = [
      {
        id: 'c1',
        kind: 'rudiment',
        name: 'Рудимент',
        severity: '1',
        source: 'manual',
      },
    ];

    expect(buildDh2PortableJson(character, EXPORT_ALL).conditions).toEqual(
      character.conditions,
    );
  });
});
