import type { CardSummary } from '@/games/types';

import { backgroundLabel, roleLabel } from '../dh2e-labels';
import type { DH2Character } from '../types';

/**
 * ─── LANDMARK: DH2 CARD SUMMARY ────────────────────────────────────────────
 * Подпись карточки на дашборде: бэкграунд и роль 2e. Карьер и рангов DH1
 * в модуле нет, поэтому и в подписи их быть не может.
 */
export function dh2CardSummary(
  character: DH2Character,
  t: (key: string) => string,
): CardSummary {
  const parts = [
    backgroundLabel(character.background, t),
    roleLabel(character.role, t),
  ].filter(Boolean);

  return {
    text: parts.join(' / ') || t('dh2.acolyte'),
    badgeVariant: 'secondary',
  };
}
