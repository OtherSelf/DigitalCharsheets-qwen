import type { NormalizeOptions, NormalizeResult } from '@/games/types';

import { sandboxTotal } from './defaults';
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
 *
 * `total` пересчитывается всегда: это производное поле, и старый лист без
 * него не должен попадать в файл, пока сервер не сделал derive.
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

/** Спутник необязателен; если он есть, поля приводятся к строкам. */
function withCompanion(value: unknown): Record<string, string> | undefined {
  if (!value || typeof value !== 'object' || Array.isArray(value)) {
    return undefined;
  }
  const companion = value as Record<string, unknown>;
  const id = typeof companion.id === 'string' ? companion.id.trim() : '';
  if (!id) return undefined;
  return {
    id,
    name: typeof companion.name === 'string' ? companion.name : '',
    kind: typeof companion.kind === 'string' ? companion.kind : '',
    notes: typeof companion.notes === 'string' ? companion.notes : '',
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
  const stats = withStats(character.stats);
  character.stats = stats;
  character.total = sandboxTotal(stats.might, stats.wits);

  const companion = withCompanion(character.companion);
  if (companion) {
    character.companion = companion;
  } else {
    delete character.companion;
  }

  return {
    character: character as unknown as SandboxCharacter,
    warnings,
  };
}
