/**
 * ─── LANDMARK: DH2 PSY ─────────────────────────────────────────────────────
 * Пси 2e ведёт игрок: приложение подсказывает цену рейтинга
 * (`200 × новый рейтинг`, книга с. 90/193) и пишет покупку в ручной журнал,
 * но не блокирует списание. Дисциплины и силы — свободный текст из
 * книги правил.
 */

import { DH2E_PSY_RATING_MULTIPLIER } from './dh2e-rules';
import type { DH2Character, DH2ExperienceEntry, DH2PsyProfile } from './types';

/** Цена повышения до рейтинга `newRating`: 200 × новый рейтинг. */
export function psyRatingCost(newRating: number): number {
  const rating = Math.floor(newRating);
  return rating > 0 ? DH2E_PSY_RATING_MULTIPLIER * rating : 0;
}

/** Разбор свободного списка: через запятую, с обрезкой и без повторов. */
export function parsePsyList(value: string): string[] {
  const result: string[] = [];
  for (const part of value.split(',')) {
    const item = part.trim();
    if (item && !result.includes(item)) result.push(item);
  }
  return result;
}

export function formatPsyList(values: readonly string[]): string {
  return values.join(', ');
}

export interface PsyRatingPurchase {
  rating: number;
  cost: number;
  entry: DH2ExperienceEntry;
  patch: Pick<DH2Character, 'psy' | 'totalExpSpent' | 'experienceLog'>;
}

/**
 * Покупка следующего рейтинга: возвращает патч листа и строку журнала.
 * Проверки доступного опыта нет — это решает стол.
 */
export function buyPsyRating(
  character: Pick<DH2Character, 'psy' | 'totalExpSpent' | 'experienceLog'>,
  label: string,
  now: string = new Date().toISOString(),
): PsyRatingPurchase {
  const rating = Math.max(0, Math.floor(character.psy?.rating ?? 0)) + 1;
  const cost = psyRatingCost(rating);
  const entry: DH2ExperienceEntry = {
    id: `psy-rating:${now}:${rating}`,
    kind: 'psy-rating',
    ref: `${label} ${rating}`,
    cost,
    createdAt: now,
  };
  const psy: DH2PsyProfile = { ...character.psy, rating };
  return {
    rating,
    cost,
    entry,
    patch: {
      psy,
      totalExpSpent: (character.totalExpSpent ?? 0) + cost,
      experienceLog: [...(character.experienceLog ?? []), entry],
    },
  };
}
