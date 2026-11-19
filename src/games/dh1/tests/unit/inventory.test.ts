import { describe, expect, it } from 'vitest';

import { buildDh1PortableJson } from '@/games/dh1/export';
import {
  DEFAULT_ITEM_QUANTITY,
  inventoryTotals,
  readPrice,
  readQuantity,
  readStatus,
  readWeight,
} from '@/games/dh1/inventory';
import { normalizeDh1 } from '@/games/dh1/normalize';
import { dh1CharacterSchema } from '@/games/dh1/schema';
import { dhCharacter } from '@/games/dh1/tests/fixtures/visual';
import type { InventoryItem } from '@/games/dh1/types';

/**
 * ─── LANDMARK: DH1 INVENTORY DEFAULTS ─────────────────────────────────────
 * Старые листы не знают quantity/weight/price. Умолчания читаются, но не
 * дописываются в файл: открытие без правок не меняет JSON, а id и порядок
 * строк сохраняются при нормализации и экспорте.
 */

const legacyItems: InventoryItem[] = [
  { id: 'inv-1', name: 'Bolter', status: 'default', notes: 'Ordo issue' },
  { id: 'inv-2', name: 'Rope', status: 'lost' },
];

function legacySheet() {
  return {
    ...structuredClone(dhCharacter),
    id: 'dh-inventory-test',
    inventory: structuredClone(legacyItems),
  };
}

describe('dh1: чтение полей инвентаря', () => {
  it('без новых полей подставляет количество 1 и статус «в наличии»', () => {
    const item = legacyItems[0];
    expect(readQuantity(item)).toBe(DEFAULT_ITEM_QUANTITY);
    expect(readStatus(item)).toBe('default');
    expect(readWeight(item)).toBeUndefined();
    expect(readPrice(item)).toBeUndefined();
  });

  it('суммы веса и цены не включают потерянные предметы', () => {
    const items: InventoryItem[] = [
      {
        id: 'a',
        name: 'Bolter',
        status: 'default',
        quantity: 1,
        weight: 4.5,
        price: 500,
      },
      {
        id: 'b',
        name: 'Ammo',
        status: 'default',
        quantity: 30,
        weight: 0.3,
        price: 12,
      },
      { id: 'c', name: 'Lost relic', status: 'lost', weight: 99, price: 999 },
      { id: 'd', name: 'Rope', status: 'default' },
    ];

    const totals = inventoryTotals(items);
    expect(totals.weight).toBeCloseTo(4.8, 5);
    expect(totals.price).toBe(512);
  });

  it('сохраняет заданные значения и нормализует мусор', () => {
    expect(readQuantity({ ...legacyItems[0], quantity: 30 })).toBe(30);
    expect(readQuantity({ ...legacyItems[0], quantity: 0 })).toBe(1);
    expect(readQuantity({ ...legacyItems[0], quantity: 2.9 })).toBe(2);
    expect(readStatus(legacyItems[1])).toBe('lost');
    expect(readWeight({ ...legacyItems[0], weight: 4.5 })).toBe(4.5);
    expect(readWeight({ ...legacyItems[0], weight: -1 })).toBeUndefined();
    expect(readPrice({ ...legacyItems[0], price: 0 })).toBe(0);
    expect(readPrice({ ...legacyItems[0], price: -5 })).toBeUndefined();
  });
});

describe('dh1: нормализация старого листа', () => {
  it('не дописывает новые поля и сохраняет id с порядком', () => {
    const { character } = normalizeDh1(legacySheet());

    expect(character.inventory).toStrictEqual(legacyItems);
    expect(character.inventory.map((item) => item.id)).toEqual([
      'inv-1',
      'inv-2',
    ]);
  });

  it('старый лист проходит схему dh1', () => {
    const { character } = normalizeDh1(legacySheet());
    const parsed = dh1CharacterSchema.safeParse(character);
    expect(parsed.success).toBe(true);
  });

  it('экспорт отдаёт инвентарь как есть, без подстановки умолчаний', () => {
    const { character } = normalizeDh1(legacySheet());
    const exported = buildDh1PortableJson(character, {
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
