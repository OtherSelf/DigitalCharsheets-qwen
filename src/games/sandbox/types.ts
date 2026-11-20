import type { CharacterRecord } from '@/games/types';

/** ─── LANDMARK: EXAMPLE PLUGIN TYPES ──────────────────────────────────────
 * Тестовая игра: минимальный лист с именем, рангом, двумя
 * характеристиками и заметками. Показывает, что новая игра — это папка +
 * манифест + собственные типы/схема/лист/форма, без правок ядра (этап 3).
 */

/**
 * `systemId` песочницы: один источник для модуля, дефолтов и нормализации.
 * Два литерала в разных файлах разошлись бы при переименовании шаблона.
 */
export const SANDBOX_SYSTEM_ID = 'sandbox' as const;

export const SANDBOX_STATS = ['might', 'wits'] as const;
export type SandboxStat = (typeof SANDBOX_STATS)[number];

export interface SandboxCharacter extends CharacterRecord {
  systemId?: string;
  gameSystem?: string;
  rank: string;
  stats: Record<SandboxStat, number>;
  notes: string;
}
