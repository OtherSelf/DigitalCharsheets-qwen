/**
 * ─── LANDMARK: DH2 ELITE ADVANCES ─────────────────────────────────────────
 * Элитные продвижения 2e (с. 86): пререквизиты и разрешение ГМ показываем, но
 * автоматически применяем только то, что игрок вносит на лист вручную (D15).
 * Покупка пишется в журнал опыта; удаление не откатывает характеристики и
 * опыт — это осознанно (D1/D15).
 */

import { DH2E_ELITES } from './dh2e-reference';
import type { Dh2eEliteAdvance } from './dh2e-types';
import type { DH2Character, DH2ExperienceEntry } from './types';

export function eliteById(id: string): Dh2eEliteAdvance | undefined {
  return DH2E_ELITES.find((elite) => elite.id === id);
}

/** Элитные, которых у персонажа ещё нет. */
export function availableEliteAdvances(
  taken: readonly string[],
): readonly Dh2eEliteAdvance[] {
  return DH2E_ELITES.filter((elite) => !taken.includes(elite.id));
}

export interface ElitePurchase {
  elite: Dh2eEliteAdvance;
  entry: DH2ExperienceEntry;
  patch: Pick<
    DH2Character,
    'eliteAdvances' | 'totalExpSpent' | 'experienceLog'
  >;
}

/**
 * Покупка элитного продвижения: id в `eliteAdvances`, цена в журнал.
 * Никаких правок характеристик/талантов — instant changes остаются памяткой.
 */
export function buyEliteAdvance(
  character: Pick<
    DH2Character,
    'eliteAdvances' | 'totalExpSpent' | 'experienceLog'
  >,
  eliteId: string,
  label: string,
  now: string = new Date().toISOString(),
): ElitePurchase | undefined {
  const elite = eliteById(eliteId);
  if (!elite || character.eliteAdvances.includes(eliteId)) return undefined;

  const entry: DH2ExperienceEntry = {
    id: `elite-advance:${now}:${eliteId}`,
    kind: 'elite-advance',
    ref: label,
    cost: elite.cost,
    createdAt: now,
  };
  return {
    elite,
    entry,
    patch: {
      eliteAdvances: [...character.eliteAdvances, eliteId],
      totalExpSpent: (character.totalExpSpent ?? 0) + elite.cost,
      experienceLog: [...(character.experienceLog ?? []), entry],
    },
  };
}

/** Удаление элитного: только id, опыт и характеристики не трогаем (D15). */
export function removeEliteAdvance(
  character: Pick<DH2Character, 'eliteAdvances'>,
  eliteId: string,
): Pick<DH2Character, 'eliteAdvances'> {
  return {
    eliteAdvances: character.eliteAdvances.filter((id) => id !== eliteId),
  };
}
