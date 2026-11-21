import crypto from 'node:crypto';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';

import { afterAll, beforeAll, describe, test } from 'vitest';

import { appendHistory, readHistory } from '@/lib/character-history';
import { writeJsonAtomic } from '@/lib/fs-atomic';
import { countActiveSessions } from '@/lib/security/sessions';

/**
 * Микробенчи файлового хранилища. Гоняются отдельно от verify (`npm run bench`):
 * fsync и 2 MiB JSONL — не то, что должно удлинять каждый pre-deploy прогон.
 *
 * `await` у синхронных сейчас функций стоит намеренно: после перевода storage
 * на fs/promises те же бенчи должны продолжать работать без правок.
 */

const uid = crypto.randomUUID();
const historyId = 'bench-history';

let dataDir = '';

function sessionFile(records: number): void {
  const sessions: Record<string, unknown> = {};
  const now = Date.now();
  for (let index = 0; index < records; index += 1) {
    sessions[`jti-${index}`] = {
      uid: `user-${index % 50}`,
      createdAt: new Date(now - index * 1000).toISOString(),
      expiresAt: new Date(now + 14 * 24 * 60 * 60 * 1000).toISOString(),
    };
  }
  fs.mkdirSync(dataDir, { recursive: true });
  fs.writeFileSync(
    path.join(dataDir, 'sessions.json'),
    JSON.stringify({ version: 1, sessions }),
    'utf8',
  );
}

function historyFile(bytes: number): string {
  const file = path.join(
    dataDir,
    'users',
    uid,
    'history',
    `${historyId}.jsonl`,
  );
  fs.mkdirSync(path.dirname(file), { recursive: true });
  const line = `${JSON.stringify({
    v: 1,
    id: 'm3k2-7f3c',
    at: new Date('2026-01-01T00:00:00.000Z').toISOString(),
    source: 'save',
    changes: [{ kind: 'changed', path: 'notes', before: 'a', after: 'b' }],
    summary: { changed: 1, added: 0, removed: 0, bulk: 0 },
  })}\n`;
  const count = Math.max(1, Math.floor(bytes / Buffer.byteLength(line)));
  fs.writeFileSync(file, line.repeat(count), 'utf8');
  return file;
}

beforeAll(() => {
  dataDir = fs.mkdtempSync(path.join(os.tmpdir(), 'dcs-bench-storage-'));
  process.env.DCS_DATA_DIR = dataDir;
});

afterAll(() => {
  fs.rmSync(dataDir, { recursive: true, force: true });
});

describe('writeJsonAtomic', () => {
  test('100 КБ + fsync', async ({ bench }) => {
    const payload = {
      name: 'Bench',
      notes: 'x'.repeat(100_000),
      items: Array.from({ length: 500 }, (_, index) => ({ id: index })),
    };
    (
      await bench('100 КБ + fsync', async () => {
        await writeJsonAtomic(path.join(dataDir, 'bench-write.json'), payload);
      })
    ).run({ iterations: 10, warmupIterations: 2 });
  });
});

describe('character history', () => {
  test('appendHistory при файле ~2 MiB', async ({ bench }) => {
    (
      await bench(
        'appendHistory при файле ~2 MiB',
        {
          beforeEach: () => {
            historyFile(2 * 1024 * 1024);
          },
        },
        async () => {
          await appendHistory(
            uid,
            historyId,
            {
              changes: [
                { kind: 'changed', path: 'notes', before: 'a', after: 'b' },
              ],
              summary: { changed: 1, added: 0, removed: 0, bulk: 0 },
            },
            { maxBytes: 2 * 1024 * 1024 },
          );
        },
      )
    ).run({ iterations: 5, warmupIterations: 1 });
  });

  test('readHistory при файле ~2 MiB', async ({ bench }) => {
    (
      await bench(
        'readHistory при файле ~2 MiB',
        {
          beforeEach: () => {
            historyFile(2 * 1024 * 1024);
          },
        },
        async () => {
          await readHistory(uid, historyId);
        },
      )
    ).run();
  });
});

for (const records of [100, 1_000, 10_000]) {
  describe(`sessions.json: ${records} записей`, () => {
    beforeAll(async () => sessionFile(records));

    test('isSessionActive читает и валидирует файл', async ({ bench }) => {
      (
        await bench(
          'isSessionActive читает и валидирует файл',
          async () => await countActiveSessions('user-0'),
        )
      ).run();
    });
  });
}
