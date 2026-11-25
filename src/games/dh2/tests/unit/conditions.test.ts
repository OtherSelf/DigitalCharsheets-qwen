import { describe, expect, it } from 'vitest';

import { createDh2Defaults } from '@/games/dh2/defaults';
import { buildDh2PortableJson } from '@/games/dh2/export';
import dh2En from '@/games/dh2/i18n/en.json';
import dh2Ru from '@/games/dh2/i18n/ru.json';
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
 * Проверка живёт рядом с редакцией: чужая игра на неё не влияет.
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

  it('DH2: имплант и благословение проходят схему', () => {
    const draft = {
      ...createDh2Defaults({}),
      id: 'dh2-positive-conditions',
      systemId: 'dh2',
    };
    const { character } = normalizeDh2(draft, { applyDefaults: true });
    character.conditions = [
      { id: 'c1', kind: 'implant', name: 'Имплант', source: 'manual' },
      { id: 'c2', kind: 'blessing', name: 'Благословение', source: 'manual' },
    ];

    expect(dh2CharacterSchema.parse(character).conditions).toHaveLength(2);
  });

  it('DH2: незнакомый kind не отбрасывается схемой', () => {
    const draft = {
      ...createDh2Defaults({}),
      id: 'dh2-foreign-condition',
      systemId: 'dh2',
    };
    const { character } = normalizeDh2(draft, { applyDefaults: true });
    character.conditions = [
      {
        id: 'x1',
        kind: 'possession' as never,
        name: 'Одержимость',
        source: 'manual',
      },
    ];

    expect(dh2CharacterSchema.parse(character).conditions?.[0].kind).toBe(
      'possession',
    );
  });

  it('DH2: подписи implant/blessing есть в обеих локалях', () => {
    for (const dictionary of [dh2Ru, dh2En] as Record<string, string>[]) {
      expect(dictionary['dh2.conditions.kind.implant']).toBeTruthy();
      expect(dictionary['dh2.conditions.kind.blessing']).toBeTruthy();
    }
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
