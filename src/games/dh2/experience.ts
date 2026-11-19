import type { ExperienceLogRow } from '@/games/plugin-host';

import type { DH2ExperienceEntry } from './types';

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
