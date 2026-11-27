import type { ExperienceLogRow } from '@/games/plugin-host';

import { removeEliteJournalEntry } from './elite';
import type { DH2Character, DH2ExperienceEntry } from './types';

type Translate = (key: string) => string;

/**
 * Адаптер журнала DH2: запись хранит `kind` и `ref`. Главная строка — текст
 * игрока (`ref`), вид покупки идёт подписью, как в прежнем диалоге.
 */
export function dh2ExperienceRows(
  entries: readonly DH2ExperienceEntry[] | undefined,
  t: Translate,
): ExperienceLogRow[] {
  return (entries ?? []).map((entry) => {
    const kindLabel = t(`dh2.experienceKind.${entry.kind}`);
    return {
      id: entry.id,
      // Уточнение игрока — главная строка, вид покупки — подпись под ней;
      // пустое уточнение заменяется видом, чтобы строка не была пустой.
      label: entry.ref || kindLabel,
      kind: kindLabel,
      cost: entry.cost,
      createdAt: entry.createdAt,
    };
  });
}

interface DH2ExperienceRemoval {
  experience?: number;
  totalExpSpent?: number;
  experienceLog?: DH2ExperienceEntry[];
  eliteAdvances?: string[];
}

/**
 * ─── LANDMARK: EXPERIENCE ENTRY REMOVAL ────────────────────────────────────
 * Журнал и поля опыта могут разойтись: игрок правит «Текущий опыт» вручную
 * и начисление становится больше остатка. Удаление строки журнала возвращает
 * ровно её стоимость, но не уводит поле ниже нуля — схема отклоняет
 * отрицательный опыт, и сохранение падало бы с `invalid_payload`.
 * Покупки списывают `totalExpSpent`, начисления — `experience`; у записи
 * есть только одно из полей, поэтому второе остаётся нетронутым.
 * Элитное продвижение снимает ещё и id профиля — это делает `elite.ts`,
 * чтобы оба пути удаления оставались симметричными.
 */
export function removeDh2ExperienceEntry(
  character: Pick<
    DH2Character,
    'experience' | 'totalExpSpent' | 'experienceLog' | 'eliteAdvances'
  >,
  entryId: string,
): DH2ExperienceRemoval | undefined {
  const log = character.experienceLog ?? [];
  const entry = log.find((item) => item.id === entryId);
  if (!entry) return undefined;

  if (entry.kind === 'elite-advance') {
    return removeEliteJournalEntry(character, entryId);
  }

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
