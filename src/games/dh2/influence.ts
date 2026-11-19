/**
 * ─── LANDMARK: DH2 INFLUENCE / REQUISITION ────────────────────────────────
 * Достаток 2e — Influence (деньги не механика). При создании можно взять
 * до бонуса Influence приобретений с Availability Scarce (−10) или лучше
 * (с. 81); в игре — Реквизиция: Influence + модификаторы доступности и
 * качества (с. 141). Приложение только считает цель, бросок делает игрок.
 */

import { DH2E_AVAILABILITY, DH2E_CRAFTSMANSHIP } from './dh2e-rules';
import type {
  Dh2eAvailabilityModifier,
  Dh2eCraftsmanshipModifier,
} from './dh2e-types';
import { statTotal } from './stats';
import type { DH2Character } from './types';

type InfluenceSource = Pick<DH2Character, 'stats' | 'statUpgrades'>;

/** Бонус Influence — десятки итогового значения характеристики. */
export function influenceBonus(character: InfluenceSource): number {
  return Math.floor(statTotal(character, 'influence') / 10);
}

/** Лимит приобретений при создании: не больше бонуса Influence. */
export function creationAcquisitionLimit(character: InfluenceSource): number {
  return influenceBonus(character);
}

/** Scarce (−10) и всё, что лучше (модификатор >= −10, включая Automatic). */
export function isCreationAvailability(id: string): boolean {
  const entry = availabilityById(id);
  if (!entry) return false;
  if (entry.automatic) return true;
  return entry.modifier !== null && entry.modifier >= -10;
}

export function availabilityById(
  id: string,
): Dh2eAvailabilityModifier | undefined {
  return DH2E_AVAILABILITY.find((entry) => entry.id === id);
}

export function craftsmanshipById(
  id: string,
): Dh2eCraftsmanshipModifier | undefined {
  return DH2E_CRAFTSMANSHIP.find((entry) => entry.id === id);
}

export interface RequisitionTarget {
  base: number;
  availability: number;
  craftsmanship: number;
  total: number;
  /** Ubiquitous: тест не нужен. */
  automatic: boolean;
}

/**
 * Цель Реквизиции: Influence + доступность + качество. У Ubiquitous теста нет,
 * поэтому модификаторы не применяются.
 */
export function requisitionTarget(
  character: InfluenceSource,
  availabilityId: string = 'average',
  craftsmanshipId: string = 'common',
): RequisitionTarget {
  const base = statTotal(character, 'influence');
  const availability =
    availabilityById(availabilityId) ??
    DH2E_AVAILABILITY.find((entry) => entry.id === 'average');
  const craftsmanship =
    craftsmanshipById(craftsmanshipId) ??
    DH2E_CRAFTSMANSHIP.find((entry) => entry.id === 'common');
  const availabilityModifier = availability?.modifier ?? 0;
  const craftsmanshipModifier = craftsmanship?.modifier ?? 0;

  if (availability?.automatic) {
    return {
      base,
      availability: 0,
      craftsmanship: 0,
      total: base,
      automatic: true,
    };
  }
  return {
    base,
    availability: availabilityModifier,
    craftsmanship: craftsmanshipModifier,
    total: base + availabilityModifier + craftsmanshipModifier,
    automatic: false,
  };
}
