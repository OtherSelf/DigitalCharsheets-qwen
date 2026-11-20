import type { NormalizeOptions, NormalizeResult } from '@/games/types';

import type { SandboxCharacter } from './types';

/**
 * ─── LANDMARK: EXAMPLE NORMALIZE ───────────────────────────────────────────
 * Приведение legacy/импортированного листа песочницы к её типу. Без
 * `applyDefaults` это только копия записи (нормализация при старте); с ним
 * пустые структуры заполняются, как при импорте.
 *
 * Идемпотентна: повторный вызов на уже нормализованном листе ничего не
 * меняет и не порождает предупреждений. Требование контракта (SDK v1):
 * `normalize` есть у каждого плагина, иначе импорт legacy-данных ветвится
 * по игре в ядре.
 */

const DEFAULT_STATS = { might: 10, wits: 10 } as const;

/** Запись после нормализации: `stats` всегда с обеими характеристиками. */
function withStats(value: unknown): Record<string, number> {
  const stats =
    value && typeof value === 'object' && !Array.isArray(value)
      ? (value as Record<string, unknown>)
      : {};
  return {
    might: typeof stats.might === 'number' ? stats.might : DEFAULT_STATS.might,
    wits: typeof stats.wits === 'number' ? stats.wits : DEFAULT_STATS.wits,
  };
}

export function normalizeSandbox(
  raw: Readonly<Record<string, unknown>>,
  options: NormalizeOptions = {},
): NormalizeResult<SandboxCharacter> {
  const character: Record<string, unknown> = { ...raw };
  const warnings: string[] = [];

  if (options.applyDefaults) {
    if (typeof character.rank !== 'string' || character.rank === '') {
      character.rank = 'Novice';
    }
    if (typeof character.notes !== 'string') character.notes = '';
  }

  // Структура характеристик нужна и без `applyDefaults`: лист без `stats`
  // не пройдёт схему, а частичный объект терял бы вторую характеристику.
  character.stats = withStats(character.stats);

  return {
    character: character as unknown as SandboxCharacter,
    warnings,
  };
}
