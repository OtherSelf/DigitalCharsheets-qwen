import { describe, expect, it } from 'vitest';

import {
  fateRangeFromText,
  WORLD_STARTING_PROFILE,
  woundsRangeFromFormula,
} from '@/games/dh1/dark-heresy-data';
import { createDh1Defaults } from '@/games/dh1/defaults';

/**
 * ─── LANDMARK: DH1 STARTING RANGES TESTS ─────────────────────────────────
 * Раны и Судьба зависят от мира; приложение показывает таблицу/диапазон и
 * подставляет минимум, бросок вводит игрок. Проверяем все миры 1e,
 * чтобы «10/1 из воздуха» не вернулись.
 */

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
