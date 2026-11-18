import { describe, expect, it } from 'vitest';

import { createDh2Defaults } from '@/games/dh2/defaults';
import { DH2E_HOMEWORLDS } from '@/games/dh2/dh2e-data';
import {
  fateRangeFor,
  woundsRangeFor,
} from '@/games/dh2/dh2e-starting-profile';

/**
 * ─── LANDMARK: DH2 STARTING RANGES TESTS ─────────────────────────────────
 * Раны и Судьба зависят от мира; приложение показывает формулу/диапазон и
 * подставляет минимум, бросок вводит игрок (D12). Проверяем все миры 2e,
 * чтобы «10/1 из воздуха» не вернулись.
 */

describe('DH2: диапазоны ран и Судьбы', () => {
  it('у каждого мира есть формула, минимум и максимум', () => {
    for (const world of DH2E_HOMEWORLDS) {
      const wounds = woundsRangeFor(world.id);
      const fate = fateRangeFor(world.id);
      expect(wounds, world.id).toBeDefined();
      expect(fate, world.id).toBeDefined();
      expect(wounds?.formula, world.id).toBe(world.wounds);
      expect(wounds?.min, world.id).toBeGreaterThan(0);
      expect(wounds!.max - wounds!.min, world.id).toBe(4);
      expect(fate, world.id).toEqual({
        threshold: world.fateThreshold,
        blessing: world.emperorsBlessing,
        min: world.fateThreshold,
        max: world.fateThreshold + 1,
      });
    }
  });

  it('явный пример: 8+1d5 → 9–13, Судьба 2 (6+) → 2–3', () => {
    expect(woundsRangeFor('hive-world')).toEqual({
      formula: '8+1d5',
      min: 9,
      max: 13,
    });
    expect(fateRangeFor('hive-world')).toEqual({
      threshold: 2,
      blessing: 6,
      min: 2,
      max: 3,
    });
    expect(woundsRangeFor('unknown-world')).toBeUndefined();
    expect(fateRangeFor('unknown-world')).toBeUndefined();
  });

  it('дефолты создания берут минимум мира, явный бросок сохраняется', () => {
    for (const world of DH2E_HOMEWORLDS) {
      const draft = createDh2Defaults({ homeWorld: world.id });
      expect(draft.wounds, world.id).toEqual({
        current: woundsRangeFor(world.id)!.min,
        max: woundsRangeFor(world.id)!.min,
      });
      expect(draft.fatePoints, world.id).toEqual({
        current: fateRangeFor(world.id)!.min,
        max: fateRangeFor(world.id)!.min,
      });
    }

    const rolled = createDh2Defaults({
      homeWorld: 'hive-world',
      wounds: 13,
      fatePoints: 3,
    });
    expect(rolled.wounds.current).toBe(13);
    expect(rolled.fatePoints.current).toBe(3);
  });
});
