import type { LegacyImportContext } from '@/games/types';

import { SANDBOX_SCHEMA_VERSION } from './schema-version';
import { SANDBOX_SYSTEM_ID } from './types';

/**
 * ─── LANDMARK: EXAMPLE LEGACY IMPORT ──────────────────────────────────────
 * Разовый перенос старых записей песочницы (плоские `might`/`wits` вместо
 * `stats`, без `systemId`) силами плагина. Ядро только раскладывает файл и
 * нормализует результат; конвертер игры не знает.
 *
 * Рантайм-роута импорта нет — сценарий используется офлайн-скриптом, поэтому
 * функции чистые и не трогают файловую систему.
 */
const LEGACY_GAME_SYSTEM = 'Sandbox — Test Game';

export function sandboxMatchesLegacyImport(
  raw: Readonly<Record<string, unknown>>,
): boolean {
  return (
    raw.systemId === SANDBOX_SYSTEM_ID ||
    raw.gameSystem === LEGACY_GAME_SYSTEM ||
    (typeof raw.might === 'number' && typeof raw.wits === 'number')
  );
}

export function sandboxLegacyImportName(
  raw: Readonly<Record<string, unknown>>,
  index: number,
): string {
  const name = typeof raw.name === 'string' ? raw.name.trim() : '';
  return name || `Sandbox ${index + 1}`;
}

function numberFrom(value: unknown, fallback: number): number {
  if (typeof value === 'number' && Number.isFinite(value)) return value;
  if (typeof value === 'string' && value.trim() !== '') {
    const parsed = Number(value);
    if (Number.isFinite(parsed)) return parsed;
  }
  return fallback;
}

export function sandboxConvertLegacyImport(
  raw: Readonly<Record<string, unknown>>,
  context: LegacyImportContext,
): Record<string, unknown> {
  const nested =
    raw.stats && typeof raw.stats === 'object'
      ? (raw.stats as Record<string, unknown>)
      : {};
  const might = numberFrom(raw.might ?? nested.might, 10);
  const wits = numberFrom(raw.wits ?? nested.wits, 10);

  return {
    id: context.createId(),
    userId: context.userId,
    name: context.name,
    systemId: SANDBOX_SYSTEM_ID,
    gameSystem: LEGACY_GAME_SYSTEM,
    schemaVersion: SANDBOX_SCHEMA_VERSION,
    rank: typeof raw.rank === 'string' ? raw.rank : 'Novice',
    stats: { might, wits },
    total: might + wits,
    notes: typeof raw.notes === 'string' ? raw.notes : '',
  };
}
