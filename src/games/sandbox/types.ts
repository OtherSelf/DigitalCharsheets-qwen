import type { CharacterRecord } from '@/games/types';

/** ─── LANDMARK: EXAMPLE PLUGIN TYPES ──────────────────────────────────────
 * Тестовая игра: минимальный лист с именем, рангом, двумя характеристиками,
 * заметками и необязательным спутником. Показывает, что новая игра — это
 * папка + манифест + собственные типы/схема/лист/форма, без правок ядра.
 */

/**
 * `systemId` песочницы: один источник для модуля, дефолтов и нормализации.
 * Два литерала в разных файлах разошлись бы при переименовании шаблона.
 */
export const SANDBOX_SYSTEM_ID = 'sandbox' as const;

export const SANDBOX_STATS = ['might', 'wits'] as const;
export type SandboxStat = (typeof SANDBOX_STATS)[number];

/**
 * Вложенная сущность листа с виртуальным id `companion-<id>`: ядро знает
 * только формат id, а ищет и обновляет её плагин (`findEmbedded` /
 * `updateEmbedded`).
 */
export interface SandboxCompanion {
  id: string;
  name: string;
  kind: string;
  notes: string;
}

export interface SandboxCharacter extends CharacterRecord {
  systemId?: string;
  gameSystem?: string;
  rank: string;
  stats: Record<SandboxStat, number>;
  /** Производное поле: сумма характеристик (`derive`). */
  total: number;
  notes: string;
  companion?: SandboxCompanion;
}
