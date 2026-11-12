import type { CardSummary } from '@/games/types';

import type { DnD5eCharacter } from '../types';

/**
 * ─── LANDMARK: DND5E CARD SUMMARY ──────────────────────────────────────────
 * Подпись карточки на дашборде («Lvl 3 Fighter») и цвет бейджа игры. Раньше
 * это знала `character-card.tsx`; теперь — плагин (слот `CardSummary`).
 */
export function dnd5eCardSummary(
  character: DnD5eCharacter,
  t: (key: string) => string,
): CardSummary {
  const characterClass = character.characterClass || '';
  const key = `dnd.class${characterClass}`;
  const translated = t(key);
  const className = translated === key ? characterClass : translated;

  return {
    text: `${t('dnd.lvl')}${character.level ?? ''} ${className}`,
    badgeVariant: 'default',
  };
}
