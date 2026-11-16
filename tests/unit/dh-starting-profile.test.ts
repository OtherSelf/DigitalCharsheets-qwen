import { describe, expect, it } from 'vitest';

import {
  fateRangeFromText,
  WORLD_STARTING_PROFILE,
  woundsRangeFromFormula,
} from '@/games/dh1/dark-heresy-data';
import { createDh1Defaults } from '@/games/dh1/defaults';
import { createDh2Defaults } from '@/games/dh2/defaults';
import { DH2E_HOMEWORLDS } from '@/games/dh2/dh2e-data';
import {
  fateRangeFor,
  woundsRangeFor,
} from '@/games/dh2/dh2e-starting-profile';

/**
 * ─── LANDMARK: DH STARTING RANGES TESTS ───────────────────────────────────
 * Раны и Судьба зависят от мира; приложение показывает формулу/диапазон и
 * подставляет минимум, бросок вводит игрок (D12). Проверяем все миры обеих
 * редакций, чтобы «10/1 из воздуха» не вернулись.
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

describe('DH1: диапазоны ран и Судьбы', () => {
  it('формула и таблица Судьбы дают минимум/максимум', () => {
    expect(woundsRangeFromFormula('1d5+9')).toEqual({ min: 10, max: 14 });
    expect(woundsRangeFromFormula('2d10+1')).toEqual({ min: 3, max: 21 });
    expect(woundsRangeFromFormula('broken')).toBeUndefined();
    expect(fateRangeFromText('1–4: 1, 5–8: 2, 9–10: 2')).toEqual({
      min: 1,
      max: 2,
    });
    expect(fateRangeFromText('нет чисел')).toBeUndefined();
  });

  it('каждый мир 1e предзаполняет минимум, а не 10/1', () => {
    for (const [world, profile] of Object.entries(WORLD_STARTING_PROFILE)) {
      const wounds = woundsRangeFromFormula(profile.wounds);
      const fate = fateRangeFromText(profile.fate);
      expect(wounds, world).toBeDefined();
      expect(fate, world).toBeDefined();

      const draft = createDh1Defaults({ homeWorld: world });
      expect(draft.wounds.current, world).toBe(wounds!.min);
      expect(draft.fatePoints.current, world).toBe(fate!.min);
    }
  });

  it('Feral World: 1d5+9 → 10–14, Судьба 1–2', () => {
    const draft = createDh1Defaults({ homeWorld: 'Feral World' });
    expect(draft.wounds).toEqual({ current: 10, max: 10 });
    expect(draft.fatePoints).toEqual({ current: 1, max: 1 });
  });

  it('явный бросок игрока сохраняется', () => {
    const rolled = createDh1Defaults({
      homeWorld: 'Feral World',
      wounds: 14,
      fatePoints: 2,
    });
    expect(rolled.wounds.current).toBe(14);
    expect(rolled.fatePoints.current).toBe(2);
  });
});
