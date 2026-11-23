import { describe, expect, it } from 'vitest';

import { listGameModules } from '@/games/registry';
import { clampResourcePoints, clampWoundPoints } from '@/games/shared/points';
import { validateCharacterPatch } from '@/lib/character-payload';

import { makeCharacter } from '@tests/support';

/**
 * Вунды DH: нижний предел `-max`. Проверяются и арифметика UI, и схема
 * редакций — иначе кнопка «−» уводит значение в минус, а сервер отвечает
 * `400 invalid_payload` (так и было до этого изменения).
 */
describe('clampWoundPoints', () => {
  it('опускает до -max и не ниже', () => {
    expect(clampWoundPoints(0, 15)).toBe(0);
    expect(clampWoundPoints(-15, 15)).toBe(-15);
    expect(clampWoundPoints(-16, 15)).toBe(-15);
    expect(clampWoundPoints(16, 15)).toBe(15);
  });

  it('при max = 0 не уходит в минус', () => {
    expect(clampWoundPoints(-5, 0)).toBe(0);
  });

  it('защищает от NaN и дробей', () => {
    expect(clampWoundPoints(Number.NaN, 10)).toBe(0);
    expect(clampWoundPoints(2.9, 10)).toBe(2);
  });
});

describe('clampResourcePoints', () => {
  it('не опускается ниже нуля', () => {
    expect(clampResourcePoints(-1, 10)).toBe(0);
    expect(clampResourcePoints(11, 10)).toBe(10);
  });
});

describe('wounds в схемах редакций', () => {
  for (const gameModule of listGameModules()) {
    const base = makeCharacter(gameModule.id);
    if (!base.wounds || typeof base.wounds !== 'object') continue;

    it(`${gameModule.id}: принимает -max`, () => {
      const parsed = gameModule.schema.safeParse({
        ...base,
        wounds: { current: -15, max: 15 },
      });
      expect(parsed.success).toBe(true);
    });

    it(`${gameModule.id}: патч PUT с -max проходит валидацию`, () => {
      const patch = validateCharacterPatch(
        gameModule,
        base as unknown as Record<string, unknown>,
        { wounds: { current: -15, max: 15 } },
      );
      expect(patch.ok).toBe(true);
    });

    it(`${gameModule.id}: не принимает значение ниже -pool`, () => {
      const parsed = gameModule.schema.safeParse({
        ...base,
        wounds: { current: -1_000_000, max: 15 },
      });
      expect(parsed.success).toBe(false);
    });
  }
});
