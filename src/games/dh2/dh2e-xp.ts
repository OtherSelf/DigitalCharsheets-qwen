/**
 * ─── LANDMARK: DH2E XP ─────────────────────────────────────────────────────
 * Стоимость покупок 2e по таблицам 2-2 (характеристики), 2-4 (навыки) и
 * 2-6 (таланты). Считаем и предупреждаем, но не блокируем: домашние правила
 * и ручной ввод должны оставаться возможными (D4).
 */

import { countAptitudeMatches } from './dh2e-aptitudes';
import { DH2E_CHARACTERISTICS } from './dh2e-data';
import {
  DH2E_ELITE_COSTS,
  DH2E_SKILL_TIERS,
  DH2E_STAT_STEPS,
  DH2E_TALENT_TIERS,
  DH2E_XP_COST_TABLES,
} from './dh2e-rules';
import type {
  DarkHeresyStatUpgrade,
  DH2Character,
  DH2ExperienceEntry,
  DH2ExperienceKind,
} from './types';

type Matches = 0 | 1 | 2;

function rowKey(matches: Matches): 'zero' | 'one' | 'two' {
  if (matches >= 2) return 'two';
  if (matches === 1) return 'one';
  return 'zero';
}

export function toMatches(count: number): Matches {
  return Math.min(Math.max(count, 0), 2) as Matches;
}

/** Цена следующей ступени характеристики: `stepIndex` — 0..4 (Simple…Expert). */
export function characteristicStepCost(
  matches: Matches,
  stepIndex: number,
): number {
  return DH2E_XP_COST_TABLES.characteristic[rowKey(matches)][stepIndex] ?? 0;
}

/** Цена следующего ранга навыка: `rankIndex` — 0..3 (Known…Veteran). */
export function skillRankCost(matches: Matches, rankIndex: number): number {
  return DH2E_XP_COST_TABLES.skill[rowKey(matches)][rankIndex] ?? 0;
}

/** Цена таланта: `tier` — 1..3. */
export function talentCost(matches: Matches, tier: number): number {
  return DH2E_XP_COST_TABLES.talent[rowKey(matches)][tier - 1] ?? 0;
}

/** Повышение пси-рейтинга: 200 × новый рейтинг (с. 90). */
export function psyRatingCost(newRating: number): number {
  return 200 * Math.max(newRating, 1);
}

export function eliteAdvanceCost(id: string): number {
  return DH2E_ELITE_COSTS[id] ?? 0;
}

export function statStepsTotal(): number {
  return DH2E_STAT_STEPS.length;
}

export function skillTiersTotal(): number {
  return DH2E_SKILL_TIERS.length;
}

export function talentTierMax(): number {
  return DH2E_TALENT_TIERS.length;
}

/** Сколько совпадений аптитюд у характеристики (таблица 2-2). */
export function characteristicMatches(
  character: DH2Character,
  statKey: string,
): Matches {
  const characteristic = DH2E_CHARACTERISTICS.find(
    (item) => item.id === statKey,
  );
  if (!characteristic) return 0;
  return toMatches(
    countAptitudeMatches(
      characteristic.aptitudeIds,
      character.aptitudes.profile,
    ),
  );
}

/** Сколько совпадений у навыка (таблица 2-4). */
export function skillMatches(
  character: DH2Character,
  aptitudeIds: readonly string[],
): Matches {
  return toMatches(
    countAptitudeMatches(aptitudeIds, character.aptitudes.profile),
  );
}

function newEntry(
  kind: DH2ExperienceKind,
  ref: string,
  cost: number,
): DH2ExperienceEntry {
  return {
    id: `${kind}:${ref}:${Date.now()}`,
    kind,
    ref,
    cost,
    createdAt: new Date().toISOString(),
  };
}

export interface PurchaseResult {
  patch: Partial<DH2Character>;
  cost: number;
  warning: string | null;
}

function patchWithPurchase(
  character: DH2Character,
  kind: DH2ExperienceKind,
  ref: string,
  cost: number,
): PurchaseResult {
  const available = character.experience - character.totalExpSpent;
  const warning = cost > available ? 'dh2.xpWarningNegative' : null;
  return {
    patch: {
      experienceLog: [...character.experienceLog, newEntry(kind, ref, cost)],
      totalExpSpent: character.totalExpSpent + cost,
    },
    cost,
    warning,
  };
}

/** Покупка следующей ступени характеристики (+5). */
export function purchaseCharacteristicStep(
  character: DH2Character,
  statKey: string,
): PurchaseResult | null {
  const current =
    character.statUpgrades[statKey as keyof typeof character.statUpgrades];
  const steps = Array.isArray(current) ? current : [];
  const nextIndex = steps.filter(Boolean).length;
  if (nextIndex >= DH2E_STAT_STEPS.length) return null;

  const cost = characteristicStepCost(
    characteristicMatches(character, statKey),
    nextIndex,
  );
  const upgrade: DarkHeresyStatUpgrade = [
    ...steps,
    ...Array(DH2E_STAT_STEPS.length - steps.length).fill(false),
  ].map((value, index) =>
    index <= nextIndex ? true : Boolean(value),
  ) as DarkHeresyStatUpgrade;

  const purchase = patchWithPurchase(
    character,
    'characteristic',
    `${statKey}.${DH2E_STAT_STEPS[nextIndex]?.id ?? nextIndex}`,
    cost,
  );
  return {
    ...purchase,
    patch: {
      ...purchase.patch,
      statUpgrades: { ...character.statUpgrades, [statKey]: upgrade },
    },
  };
}
