import crypto from 'crypto';
import fs from 'fs/promises';
import path from 'path';

import { getHistoryFile } from './data-dir';
import { withDataLock } from './data-lock';
import {
  emptyHistorySummary,
  HISTORY_DEFAULT_MAX_BYTES,
  HISTORY_FORMAT_VERSION,
  HISTORY_MAX_BYTES_CEILING,
  HISTORY_MAX_BYTES_FLOOR,
  type HistoryChange,
  type HistoryReadResult,
  type HistoryRevision,
  type HistorySource,
  type HistorySummary,
  type HistoryTruncationMarker,
} from './history-types';
import { isUid } from './ids';

/**
 * ─── LANDMARK: CHARACTER HISTORY STORE ──────────────────────────────────────
 * Append-only журнал изменений листа: `<data-dir>/users/<uid>/history/<id>.jsonl`.
 * Одна строка — одна ревизия; отдельного файла/БД нет, схема листа не меняется.
 *
 * Запись best-effort: вызывающий (server-storage) ловит ошибки, поэтому сбой
 * журнала не отменяет сохранение листа. При превышении лимита файл
 * компактится: старые ревизии удаляются, первой строкой остаётся маркер с их
 * количеством. Полные снимки листа не хранятся — это история изменений, а не
 * бэкап.
 */

const MAX_LINE_BYTES = 256 * 1024;
const COMPACT_KEEP_RATIO = 0.7;
export interface HistoryDiffInput {
  changes: readonly HistoryChange[];
  summary: HistorySummary;
}

export interface AppendHistoryOptions {
  source?: HistorySource;
  nowMs?: number;
  /** Только для тестов; иначе env `DCS_HISTORY_MAX_BYTES`/дефолт. */
  maxBytes?: number;
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return value !== null && typeof value === 'object' && !Array.isArray(value);
}

function isHistoryChange(value: unknown): value is HistoryChange {
  if (!isRecord(value)) return false;
  if (typeof value.path !== 'string') return false;
  if (
    value.kind !== 'changed' &&
    value.kind !== 'added' &&
    value.kind !== 'removed' &&
    value.kind !== 'array-add' &&
    value.kind !== 'array-remove' &&
    value.kind !== 'bulk'
  ) {
    return false;
  }
  return true;
}

function isHistoryRevision(value: unknown): value is HistoryRevision {
  if (!isRecord(value)) return false;
  if (value.v !== HISTORY_FORMAT_VERSION) return false;
  if (typeof value.id !== 'string' || value.id.trim() === '') return false;
  if (typeof value.at !== 'string' || !Number.isFinite(Date.parse(value.at))) {
    return false;
  }
  if (
    value.source !== 'save' &&
    value.source !== 'create' &&
    value.source !== 'migration'
  ) {
    return false;
  }
  if (!Array.isArray(value.changes) || !value.changes.every(isHistoryChange)) {
    return false;
  }
  if (!isRecord(value.summary)) return false;
  for (const key of ['changed', 'added', 'removed', 'bulk'] as const) {
    if (typeof value.summary[key] !== 'number') return false;
  }
  return true;
}

/** Лимит из env/опции с зажимом в безопасный диапазон. */
export function getHistoryMaxBytes(override?: number): number {
  const raw =
    override ??
    (process.env.DCS_HISTORY_MAX_BYTES
      ? Number(process.env.DCS_HISTORY_MAX_BYTES)
      : NaN);
  if (!Number.isFinite(raw)) return HISTORY_DEFAULT_MAX_BYTES;
  return Math.min(
    Math.max(Math.floor(raw), HISTORY_MAX_BYTES_FLOOR),
    HISTORY_MAX_BYTES_CEILING,
  );
}

function makeRevisionId(nowMs: number): string {
  return `${nowMs.toString(36)}-${crypto.randomBytes(3).toString('hex')}`;
}

function emptyReadResult(bytes = 0): HistoryReadResult {
  return {
    revisions: [],
    truncated: false,
    dropped: 0,
    bytes,
    oldestAt: null,
    parseErrors: 0,
  };
}

function historyFileFor(userId: string, characterId: string): string {
  if (!isUid(userId)) throw new Error('History requires a valid uid.');
  const file = getHistoryFile(userId, characterId);
  if (!file) throw new Error('History requires a safe character id.');
  return file;
}

async function endsWithNewline(file: string): Promise<boolean> {
  const stat = await fs.stat(file);
  if (stat.size === 0) return true;
  const handle = await fs.open(file, 'r');
  try {
    const buffer = Buffer.alloc(1);
    await handle.read(buffer, 0, 1, stat.size - 1);
    return buffer[0] === 0x0a;
  } finally {
    await handle.close();
  }
}

async function writeTextAtomic(file: string, content: string): Promise<void> {
  const tmp = `${file}.${process.pid.toString(36)}.${Date.now().toString(36)}.tmp`;
  try {
    await fs.writeFile(tmp, content, 'utf8');
    await fs.rename(tmp, file);
  } catch (error) {
    try {
      await fs.unlink(tmp);
    } catch {
      /* best effort */
    }
    throw error;
  }
}

async function compactHistory(
  file: string,
  maxBytes: number,
  nowMs: number,
): Promise<void> {
  await withDataLock(async () => {
    let raw = '';
    try {
      raw = await fs.readFile(file, 'utf8');
    } catch {
      return;
    }

    let existingDropped = 0;
    const validLines: string[] = [];
    for (const line of raw.split('\n')) {
      const trimmed = line.trim();
      if (!trimmed) continue;
      try {
        const parsed = JSON.parse(trimmed) as unknown;
        if (
          isRecord(parsed) &&
          parsed.kind === 'truncated' &&
          typeof parsed.dropped === 'number'
        ) {
          existingDropped += parsed.dropped;
          continue;
        }
        if (isHistoryRevision(parsed)) validLines.push(trimmed);
      } catch {
        // Битая/обрезанная строка не должна пережить компакцию.
      }
    }

    const keepTarget = Math.max(
      HISTORY_MAX_BYTES_FLOOR,
      maxBytes * COMPACT_KEEP_RATIO,
    );
    const kept: string[] = [];
    let keptBytes = 0;
    for (let index = validLines.length - 1; index >= 0; index -= 1) {
      const line = validLines[index];
      const bytes = Buffer.byteLength(`${line}\n`, 'utf8');
      if (kept.length > 0 && keptBytes + bytes > keepTarget) break;
      kept.push(line);
      keptBytes += bytes;
    }
    kept.reverse();

    const dropped = existingDropped + (validLines.length - kept.length);
    const marker: HistoryTruncationMarker = {
      v: HISTORY_FORMAT_VERSION,
      kind: 'truncated',
      at: new Date(nowMs).toISOString(),
      dropped,
    };
    await writeTextAtomic(
      file,
      `${JSON.stringify(marker)}\n${kept.length > 0 ? `${kept.join('\n')}\n` : ''}`,
    );
  });
}

function toRecord(
  diff: HistoryDiffInput,
  options: AppendHistoryOptions,
): HistoryRevision {
  const nowMs = options.nowMs ?? Date.now();
  return {
    v: HISTORY_FORMAT_VERSION,
    id: makeRevisionId(nowMs),
    at: new Date(nowMs).toISOString(),
    source: options.source ?? 'save',
    changes: [...diff.changes],
    summary: { ...diff.summary },
  };
}

function reduceOversizedRecord(record: HistoryRevision): HistoryRevision {
  return {
    ...record,
    changes: [
      {
        kind: 'bulk',
        path: '',
        count: record.changes.length,
      },
    ],
    summary: {
      ...record.summary,
      bulk: record.summary.bulk + 1,
    },
  };
}

/**
 * Дописать ревизию. Для `source: 'save'` пустой diff не пишется; маркеры
 * `create`/`migration` могут быть пустыми. Ошибки файловой системы
 * пробрасываются — вызывающий решает, считать ли историю best-effort.
 */
export async function appendHistory(
  userId: string,
  characterId: string,
  diff: HistoryDiffInput,
  options: AppendHistoryOptions = {},
): Promise<void> {
  const source = options.source ?? 'save';
  if (source === 'save' && diff.changes.length === 0) return;

  const file = historyFileFor(userId, characterId);
  const nowMs = options.nowMs ?? Date.now();
  const maxBytes = getHistoryMaxBytes(options.maxBytes);

  let record = toRecord(diff, { ...options, source, nowMs });
  let line = JSON.stringify(record);
  if (Buffer.byteLength(line, 'utf8') > MAX_LINE_BYTES) {
    record = reduceOversizedRecord(record);
    line = JSON.stringify(record);
  }
  const lineBytes = Buffer.byteLength(`${line}\n`, 'utf8');

  await fs.mkdir(path.dirname(file), { recursive: true });

  let currentBytes = 0;
  try {
    currentBytes = (await fs.stat(file)).size;
  } catch {
    /* файла ещё нет */
  }
  if (currentBytes > 0 && currentBytes + lineBytes > maxBytes) {
    await compactHistory(file, maxBytes, nowMs);
  }

  const prefix = currentBytes > 0 && !(await endsWithNewline(file)) ? '\n' : '';
  const handle = await fs.open(file, 'a');
  try {
    await handle.write(`${prefix}${line}\n`);
  } finally {
    await handle.close();
  }
}

/** Маркер создания листа (без полного diff). */
export async function appendCreateMarker(
  userId: string,
  characterId: string,
  options: Omit<AppendHistoryOptions, 'source'> = {},
): Promise<void> {
  await appendHistory(
    userId,
    characterId,
    { changes: [], summary: emptyHistorySummary() },
    { ...options, source: 'create' },
  );
}

/** Маркер миграции листа (без полного diff). */
export async function appendMigrationMarker(
  userId: string,
  characterId: string,
  options: Omit<AppendHistoryOptions, 'source'> = {},
): Promise<void> {
  await appendHistory(
    userId,
    characterId,
    { changes: [], summary: emptyHistorySummary() },
    { ...options, source: 'migration' },
  );
}

/** Прочитать журнал; битые строки пропускаются, маркер компакции учитывается. */
export async function readHistory(
  userId: string,
  characterId: string,
): Promise<HistoryReadResult> {
  const file = getHistoryFile(userId, characterId);
  if (!file) return emptyReadResult();

  let bytes = 0;
  try {
    bytes = (await fs.stat(file)).size;
  } catch {
    return emptyReadResult();
  }

  let raw: string;
  try {
    raw = await fs.readFile(file, 'utf8');
  } catch {
    return emptyReadResult(bytes);
  }

  const revisions: HistoryRevision[] = [];
  let truncated = false;
  let dropped = 0;
  let parseErrors = 0;

  for (const line of raw.split('\n')) {
    const trimmed = line.trim();
    if (!trimmed) continue;
    try {
      const parsed = JSON.parse(trimmed) as unknown;
      if (
        isRecord(parsed) &&
        parsed.kind === 'truncated' &&
        typeof parsed.dropped === 'number'
      ) {
        truncated = true;
        dropped += parsed.dropped;
        continue;
      }
      if (isHistoryRevision(parsed)) {
        revisions.push(parsed);
      } else {
        parseErrors += 1;
      }
    } catch {
      parseErrors += 1;
    }
  }

  return {
    revisions,
    truncated,
    dropped,
    bytes,
    oldestAt: revisions[0]?.at ?? null,
    parseErrors,
  };
}

/** Удалить журнал вместе с листом; ошибки не должны ломать удаление. */
export async function deleteCharacterHistory(
  userId: string,
  characterId: string,
): Promise<boolean> {
  const file = getHistoryFile(userId, characterId);
  if (!file) return false;
  try {
    await fs.unlink(file);
    return true;
  } catch (error) {
    if ((error as NodeJS.ErrnoException)?.code === 'ENOENT') return false;
    console.error(`Failed to delete history for ${characterId}:`, error);
    return false;
  }
}
