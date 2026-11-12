import type { CharacterRecord } from '@/games/types';

/** ─── LANDMARK: EXAMPLE PLUGIN TYPES ──────────────────────────────────────
 * Эталонный плагин (фикстура): минимальная игра с именем, рангом, двумя
 * характеристиками и заметками. Показывает, что новая игра — это папка +
 * манифест + собственные типы/схема/лист/форма, без правок ядра (этап 3).
 */
export const EXAMPLE_STATS = ['might', 'wits'] as const;
export type ExampleStat = (typeof EXAMPLE_STATS)[number];

export interface ExampleCharacter extends CharacterRecord {
  systemId?: string;
  gameSystem?: string;
  rank: string;
  stats: Record<ExampleStat, number>;
  notes: string;
}
