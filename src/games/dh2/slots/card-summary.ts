import type { CardSummary } from '@/games/types';

import { CAREER_KEYS, dhLocalizedKey, RANK_KEYS } from '../dark-heresy-data';
import type { DH2Character } from '../types';

/**
 * ─── LANDMARK: DH2 CARD SUMMARY ────────────────────────────────────────────
 * Подпись карточки на дашборде и бейдж 2-й редакции. Раньше это знала
 * `character-card.tsx` (плюс `dh.`-ключи из общих данных DH);
 * теперь — плагин и его собственные данные (этап 3, `CardSummary`).
 */
export function dh2CardSummary(
  character: DH2Character,
  t: (key: string) => string,
): CardSummary {
  const rank = character.rank || '';
  const characterClass = character.characterClass || '';

  const rankText = t(RANK_KEYS[rank] || rank);
  const classText = t(
    dhLocalizedKey(CAREER_KEYS[characterClass] || characterClass, 'dh2'),
  );

  return {
    text: `${rankText ? `${rankText} ` : ''}${classText}`,
    badgeVariant: 'secondary',
  };
}
