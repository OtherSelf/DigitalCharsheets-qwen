import {
  copyDefinedFields,
  mergeShallow,
  NARRATIVE_FIELDS,
  type MergeSource,
  type MergeTarget,
} from '@/games/shared/merge';
import type { GameExportConfig } from '@/games/types';

import type { SandboxCharacter } from './types';

/**
 * ─── LANDMARK: EXAMPLE MERGE ───────────────────────────────────────────────
 * Слияние импортированных данных в лист песочницы. Цель и источник уже
 * нормализованы хостом и относятся к одной редакции, поэтому модулю остаётся
 * перенести свои поля по секциям `GameExportConfig`.
 *
 * Требование контракта (SDK v1): `merge` есть у каждого плагина — иначе
 * импорт ветвится по игре в ядре.
 */

const BASIC_FIELDS = ['name', 'rank'] as const;

export function mergeSandboxData(
  target: SandboxCharacter,
  source: Readonly<Record<string, unknown>>,
  config: GameExportConfig,
): SandboxCharacter {
  const merged = { ...(target as unknown as MergeTarget) };
  const src = source as MergeSource;

  if (config.includeBasicInfo) {
    copyDefinedFields(merged, src, BASIC_FIELDS);
  }
  if (config.includeStats) {
    mergeShallow(merged, src, 'stats');
  }
  if (config.includeNarrative) {
    copyDefinedFields(merged, src, NARRATIVE_FIELDS);
  }

  return merged as unknown as SandboxCharacter;
}
