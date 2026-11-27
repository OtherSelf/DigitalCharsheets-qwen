import type { ExperienceLogRow } from '@/games/plugin-host';

import type { DH1Character, DH1ExperienceEntry } from './types';

/**
 * Адаптер журнала DH1: записи уже хранят готовую подпись (`label`), поэтому
 * остаётся только привести их к общему виду правого Sheet.
 */
export function dh1ExperienceRows(
  entries: readonly DH1ExperienceEntry[] | undefined,
): ExperienceLogRow[] {
  return (entries ?? []).map(({ id, label, cost, createdAt }) => ({
    id,
    label,
    cost,
    createdAt,
  }));
}

interface DH1ExperienceRemoval {
  experience?: number;
  totalExpSpent?: number;
  experienceLog: DH1ExperienceEntry[];
}

/**
 * ─── LANDMARK: EXPERIENCE ENTRY REMOVAL ────────────────────────────────────
 * Журнал и поля опыта могут разойтись: игрок правит «Текущий опыт» вручную
 * и начисление становится больше остатка. Удаление строки журнала возвращает
 * ровно её стоимость, но не уводит поле ниже нуля — схема отклоняет
 * отрицательный опыт, и сохранение падало бы с `invalid_payload`.
 * Покупки списывают `totalExpSpent`, начисления — `experience`; у записи
 * есть только одно из полей, поэтому второе остаётся нетронутым.
 */
export function removeDh1ExperienceEntry(
  character: Pick<
    DH1Character,
    'experience' | 'totalExpSpent' | 'experienceLog'
  >,
  entryId: string,
): DH1ExperienceRemoval | undefined {
  const log = character.experienceLog ?? [];
  const entry = log.find((item) => item.id === entryId);
  if (!entry) return undefined;

  const experienceLog = log.filter((item) => item.id !== entryId);
  if (entry.kind === 'award') {
    return {
      experience: Math.max(0, (character.experience ?? 0) - entry.cost),
      experienceLog,
    };
  }

  return {
    totalExpSpent: Math.max(0, (character.totalExpSpent ?? 0) - entry.cost),
    experienceLog,
  };
}
