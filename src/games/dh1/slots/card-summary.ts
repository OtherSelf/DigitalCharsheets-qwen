import type { CardSummary } from '@/games/types';

import { CAREER_KEYS, RANK_KEYS } from '../dark-heresy-data';
import {
  rankForCharacter,
  rankStateForCharacter,
  resolveCharacterClass,
} from '../dark-heresy-ranks';
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
  const rank = rankForCharacter(character);
  const characterClass = resolveCharacterClass(character);
  const node = rankStateForCharacter(character).node;

  // Узел графа знает карьерно-зависимую подпись; RANK_KEYS — только для
  // legacy-листа без известной карьеры.
  const rankText = node ? t(node.labelKey) : t(RANK_KEYS[rank] || rank);
  const classText = t(CAREER_KEYS[characterClass] || characterClass);

  // Новый лист может быть создан только с именем: ранг и карьера ещё не
  // выбраны, но карточка не должна оставаться с пустой подписью.
  const text = `${rankText ? `${rankText} ` : ''}${classText}`.trim();
  return {
    text: text || t('dh1.unknownRank'),
    badgeVariant: 'secondary',
  };
}
