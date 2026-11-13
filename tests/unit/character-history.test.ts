import fs from 'fs';

import { afterEach, beforeEach, describe, expect, it } from 'vitest';

import {
  appendCreateMarker,
  appendHistory,
  appendMigrationMarker,
  deleteCharacterHistory,
  getHistoryMaxBytes,
  readHistory,
} from '@/lib/character-history';
import { getHistoryFile } from '@/lib/data-dir';
import type { HistoryChange, HistorySummary } from '@/lib/history-types';
import { newUid } from '@/lib/ids';

import { removeDir, useTempDataDir } from './helpers';

const NOW = Date.parse('2026-05-12T18:00:00.000Z');
const CHARACTER_ID = 'char-1';

let dataDir: string;
let uid: string;

function changed(path: string, before: unknown, after: unknown): HistoryChange {
  return {
    kind: 'changed',
    path,
    before: { value: before },
    after: { value: after },
  };
}

function summary(changedCount = 1): HistorySummary {
  return { changed: changedCount, added: 0, removed: 0, bulk: 0 };
}

function historyFile(): string {
  const file = getHistoryFile(uid, CHARACTER_ID);
  expect(file).not.toBeNull();
  return file!;
}

beforeEach(() => {
  dataDir = useTempDataDir();
  uid = newUid();
});

afterEach(() => {
  removeDir(dataDir);
  delete process.env.DCS_HISTORY_MAX_BYTES;
});

describe('appendHistory/readHistory', () => {
  it('пишет ревизию и читает её обратно', () => {
    appendHistory(
      uid,
      CHARACTER_ID,
      {
        changes: [changed('stats.strength', 10, 12)],
        summary: summary(),
      },
      { nowMs: NOW },
    );

    const read = readHistory(uid, CHARACTER_ID);

    expect(read.revisions).toHaveLength(1);
    expect(read.revisions[0]).toMatchObject({
      v: 1,
      source: 'save',
      at: new Date(NOW).toISOString(),
      changes: [changed('stats.strength', 10, 12)],
      summary: summary(),
    });
    expect(read.revisions[0].id.length).toBeGreaterThan(8);
    expect(read.bytes).toBeGreaterThan(0);
    expect(read.oldestAt).toBe(new Date(NOW).toISOString());
    expect(read.truncated).toBe(false);
    expect(read.parseErrors).toBe(0);
  });

  it('не создаёт файл для пустого save, но пишет create/migration маркеры', () => {
    appendHistory(
      uid,
      CHARACTER_ID,
      { changes: [], summary: summary(0) },
      { nowMs: NOW },
    );
    expect(fs.existsSync(historyFile())).toBe(false);

    appendCreateMarker(uid, CHARACTER_ID, { nowMs: NOW });
    appendMigrationMarker(uid, CHARACTER_ID, { nowMs: NOW + 1000 });

    const read = readHistory(uid, CHARACTER_ID);
    expect(read.revisions.map((revision) => revision.source)).toEqual([
      'create',
      'migration',
    ]);
  });

  it('пропускает битый хвост и чинит перевод строки перед append', () => {
    appendHistory(
      uid,
      CHARACTER_ID,
      { changes: [changed('name', 'A', 'B')], summary: summary() },
      { nowMs: NOW },
    );
    fs.appendFileSync(historyFile(), '{"broken"', 'utf8');

    const afterBroken = readHistory(uid, CHARACTER_ID);
    expect(afterBroken.revisions).toHaveLength(1);
    expect(afterBroken.parseErrors).toBe(1);

    appendHistory(
      uid,
      CHARACTER_ID,
      { changes: [changed('name', 'B', 'C')], summary: summary() },
      { nowMs: NOW + 1000 },
    );

    const read = readHistory(uid, CHARACTER_ID);
    expect(read.revisions).toHaveLength(2);
    expect(read.parseErrors).toBe(1);
    expect(fs.readFileSync(historyFile(), 'utf8').endsWith('\n')).toBe(true);
  });

  it('компактит файл по лимиту и оставляет маркер обрезки', () => {
    const big = 'a'.repeat(4000);
    const maxBytes = 64 * 1024;
    for (let index = 0; index < 12; index += 1) {
      appendHistory(
        uid,
        CHARACTER_ID,
        {
          changes: [
            {
              kind: 'changed',
              path: 'notes',
              before: { value: `${big}${index}` },
              after: { value: `${big}${index + 1}` },
            },
          ],
          summary: summary(),
        },
        { nowMs: NOW + index, maxBytes },
      );
    }

    const read = readHistory(uid, CHARACTER_ID);
    expect(read.truncated).toBe(true);
    expect(read.dropped).toBeGreaterThan(0);
    expect(read.revisions.length).toBeLessThan(12);
    expect(fs.statSync(historyFile()).size).toBeLessThanOrEqual(maxBytes * 1.2);
  });

  it('зажимает DCS_HISTORY_MAX_BYTES в безопасный диапазон', () => {
    expect(getHistoryMaxBytes(1)).toBe(64 * 1024);
    expect(getHistoryMaxBytes(100 * 1024 * 1024)).toBe(64 * 1024 * 1024);
    expect(getHistoryMaxBytes()).toBe(2 * 1024 * 1024);

    process.env.DCS_HISTORY_MAX_BYTES = '1024';
    expect(getHistoryMaxBytes()).toBe(64 * 1024);
  });
});

describe('deleteCharacterHistory', () => {
  it('удаляет файл и не падает повторно', () => {
    appendHistory(
      uid,
      CHARACTER_ID,
      { changes: [changed('name', 'A', 'B')], summary: summary() },
      { nowMs: NOW },
    );

    expect(deleteCharacterHistory(uid, CHARACTER_ID)).toBe(true);
    expect(fs.existsSync(historyFile())).toBe(false);
    expect(deleteCharacterHistory(uid, CHARACTER_ID)).toBe(false);
    expect(readHistory(uid, CHARACTER_ID).revisions).toHaveLength(0);
  });
});
