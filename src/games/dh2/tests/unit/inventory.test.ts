import { describe, expect, it } from 'vitest';

import { createDh2Defaults } from '@/games/dh2/defaults';
import { buildDh2PortableJson } from '@/games/dh2/export';
import {
  DEFAULT_ITEM_QUANTITY,
  readQuantity,
  readStatus,
  readWeight,
} from '@/games/dh2/inventory';
import { normalizeDh2 } from '@/games/dh2/normalize';
import { dh2CharacterSchema } from '@/games/dh2/schema';
import type { InventoryItem } from '@/games/dh2/types';

/**
 * ─── LANDMARK: DH2 INVENTORY DEFAULTS ─────────────────────────────────────
 * В DH2 у предмета есть количество и вес, цены нет. Умолчания читаются, но
 * не дописываются; id и порядок строк сохраняются.
 */

const legacyItems: InventoryItem[] = [
  { id: 'dh2-inv-1', name: 'Autopistol', status: 'default', notes: 'Spare' },
  { id: 'dh2-inv-2', name: 'Medkit', status: 'lost' },
];

function legacySheet() {
  return {
    id: 'dh2-inventory-test',
    ...createDh2Defaults({ name: 'Acolyte Vex', careerPath: 'Adept' }),
    inventory: structuredClone(legacyItems),
  };
}

describe('dh2: чтение полей инвентаря', () => {
  it('без новых полей подставляет количество 1 и статус «в наличии»', () => {
    const item = legacyItems[0];
    expect(readQuantity(item)).toBe(DEFAULT_ITEM_QUANTITY);
    expect(readStatus(item)).toBe('default');
    expect(readWeight(item)).toBeUndefined();
  });

  it('сохраняет заданные значения и нормализует мусор', () => {
    expect(readQuantity({ ...legacyItems[0], quantity: 3 })).toBe(3);
    expect(readQuantity({ ...legacyItems[0], quantity: -2 })).toBe(1);
    expect(readStatus(legacyItems[1])).toBe('lost');
    expect(readWeight({ ...legacyItems[0], weight: 1.5 })).toBe(1.5);
    expect(readWeight({ ...legacyItems[0], weight: -1 })).toBeUndefined();
  });
});

describe('dh2: нормализация старого листа', () => {
  it('не дописывает новые поля и сохраняет id с порядком', () => {
    const { character } = normalizeDh2(legacySheet());

    expect(character.inventory).toStrictEqual(legacyItems);
    expect(character.inventory.map((item) => item.id)).toEqual([
      'dh2-inv-1',
      'dh2-inv-2',
    ]);
  });

  it('старый лист проходит схему dh2', () => {
    const { character } = normalizeDh2(legacySheet());
    expect(dh2CharacterSchema.safeParse(character).success).toBe(true);
  });

  it('экспорт отдаёт инвентарь как есть, без подстановки умолчаний', () => {
    const { character } = normalizeDh2(legacySheet());
    const exported = buildDh2PortableJson(character, {
      includeBasicInfo: false,
      includeStats: false,
      includeCombat: false,
      includeEquipment: false,
      includeInventory: true,
      includeSpells: false,
      includeNarrative: false,
      includeProgression: false,
      includeCompanions: false,
      includeQuestLog: false,
      includeCustomHouseRules: false,
    });

    expect(exported.inventory).toStrictEqual(legacyItems);
  });
});
