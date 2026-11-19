/**
 * ─── LANDMARK: DH2E STARTING PROFILE ──────────────────────────────────────
 * Раны и Судьба 2e зависят от мира: бросок делает игрок, приложение
 * показывает формулу и диапазон, а по умолчанию подставляет минимум.
 * Судьба — порог мира плюс возможное «Благословение Императора»: игрок
 * бросает 1d10 и при результате >= значения благословения получает +1.
 */

import { DH2E_HOMEWORLDS } from './dh2e-data';
import type { Dh2eHomeWorld } from './dh2e-types';

export interface Dh2eWoundsRange {
  /** Формула мира как в книге (`8+1d5`). */
  readonly formula: string;
  readonly min: number;
  readonly max: number;
}

export interface Dh2eFateRange {
  readonly threshold: number;
  readonly blessing: number;
  readonly min: number;
  readonly max: number;
}

function findWorld(homeWorld: string): Dh2eHomeWorld | undefined {
  return DH2E_HOMEWORLDS.find((item) => item.id === homeWorld);
}

/** Диапазон ран мира: `8+1d5` → 9–13. */
export function woundsRangeFor(homeWorld: string): Dh2eWoundsRange | undefined {
  const world = findWorld(homeWorld);
  if (!world) return undefined;
  const match = world.wounds.match(/^(\d+)\+1d5$/);
  if (!match) return undefined;
  const base = Number(match[1]);
  return { formula: world.wounds, min: base + 1, max: base + 5 };
}

/** Диапазон Судьбы мира: порог и +1 при успешном благословении. */
export function fateRangeFor(homeWorld: string): Dh2eFateRange | undefined {
  const world = findWorld(homeWorld);
  if (!world) return undefined;
  return {
    threshold: world.fateThreshold,
    blessing: world.emperorsBlessing,
    min: world.fateThreshold,
    max: world.fateThreshold + 1,
  };
}
