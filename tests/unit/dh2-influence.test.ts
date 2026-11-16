import { describe, expect, it } from 'vitest';

import { createDh2Defaults } from '@/games/dh2/defaults';
import { DH2E_AVAILABILITY, DH2E_CRAFTSMANSHIP } from '@/games/dh2/dh2e-rules';
import {
  availabilityById,
  creationAcquisitionLimit,
  influenceBonus,
  isCreationAvailability,
  requisitionTarget,
} from '@/games/dh2/influence';

/**
 * ─── LANDMARK: DH2 INFLUENCE TESTS ────────────────────────────────────────
 * Influence — достаток 2e: при создании до бонуса Influence приобретений с
 * Availability Scarce (−10) или лучше; Реквизиция считает цель из Influence
 * и модификаторов таблиц 5-1/5-2. Броска и блокировки в приложении нет.
 */

describe('лимит приобретений при создании', () => {
  it('бонус Influence — десятки итогового значения', () => {
    const character = createDh2Defaults({ influence: 30 });
    expect(influenceBonus(character)).toBe(3);
    expect(creationAcquisitionLimit(character)).toBe(3);

    const higher = createDh2Defaults({ influence: 39 });
    expect(influenceBonus(higher)).toBe(3);

    higher.stats = { ...higher.stats, influence: 45 };
    expect(influenceBonus(higher)).toBe(4);
    expect(creationAcquisitionLimit(higher)).toBe(4);
  });

  it('Scarce (−10) и лучше разрешены, Rare и хуже — нет', () => {
    expect(isCreationAvailability('ubiquitous')).toBe(true);
    expect(isCreationAvailability('abundant')).toBe(true);
    expect(isCreationAvailability('average')).toBe(true);
    expect(isCreationAvailability('scarce')).toBe(true);
    expect(isCreationAvailability('rare')).toBe(false);
    expect(isCreationAvailability('unique')).toBe(false);
    expect(isCreationAvailability('no-such-level')).toBe(false);
  });
});

describe('цель Реквизиции', () => {
  const character = createDh2Defaults({ influence: 30 });

  it('Influence + доступность + качество', () => {
    expect(requisitionTarget(character, 'average', 'common').total).toBe(30);
    expect(requisitionTarget(character, 'scarce', 'common').total).toBe(20);
    expect(requisitionTarget(character, 'average', 'good').total).toBe(10);
    expect(requisitionTarget(character, 'abundant', 'good').total).toBe(40);
    expect(requisitionTarget(character, 'rare', 'best').total).toBe(-20);
  });

  it('Ubiquitous — тест не требуется', () => {
    expect(requisitionTarget(character, 'ubiquitous', 'best')).toEqual({
      base: 30,
      availability: 0,
      craftsmanship: 0,
      total: 30,
      automatic: true,
    });
  });

  it('неизвестные id падают на Average/Common', () => {
    expect(requisitionTarget(character, 'unknown', 'unknown')).toMatchObject({
      base: 30,
      availability: 0,
      craftsmanship: 0,
      total: 30,
      automatic: false,
    });
  });
});

describe('данные таблиц 5-1 и 5-2', () => {
  it('одиннадцать ступеней доступности и четыре качества', () => {
    expect(DH2E_AVAILABILITY).toHaveLength(11);
    expect(DH2E_CRAFTSMANSHIP).toHaveLength(4);
    expect(availabilityById('scarce')?.modifier).toBe(-10);
    expect(availabilityById('ubiquitous')?.automatic).toBe(true);
    expect(DH2E_CRAFTSMANSHIP.map((entry) => entry.modifier)).toEqual([
      10, 0, -20, -30,
    ]);
  });
});
