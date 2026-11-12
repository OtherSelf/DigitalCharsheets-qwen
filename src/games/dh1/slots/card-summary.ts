import type { CardSummary } from '@/games/types';

import { CAREER_KEYS, dhLocalizedKey, RANK_KEYS } from '../dark-heresy-data';
import type { DH1Character } from '../types';

/**
 * ─── LANDMARK: DH1 CARD SUMMARY ────────────────────────────────────────────
 * Подпись карточки на дашборде и бейдж 1-й редакции. Раньше это знала
 * `character-card.tsx` (плюс `dh.`-ключи из общих данных DH);
 * теперь — плагин и его собственные данные (этап 3, `CardSummary`).
 */
export function dh1CardSummary(
  character: DH1Character,
  t: (key: string) => string,
): CardSummary {
  const rank = character.rank || '';
  const characterClass = character.characterClass || '';

  const rankText = t(RANK_KEYS[rank] || rank);
  const classText = t(
    dhLocalizedKey(CAREER_KEYS[characterClass] || characterClass, 'dh1'),
  );

  return {
    text: `${rankText ? `${rankText} ` : ''}${classText}`,
    badgeVariant: 'secondary',
  };
}
