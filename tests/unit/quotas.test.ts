import fs from 'node:fs/promises';
import path from 'node:path';

import { afterEach, beforeEach, describe, expect, it } from 'vitest';

import { getUserDir } from '@/lib/data-dir';
import { newUid } from '@/lib/ids';
import {
  evaluateQuota,
  getAccountUsage,
  MAX_ACCOUNT_BYTES,
  MAX_SHEETS_PER_ACCOUNT,
  QuotaExceededError,
} from '@/lib/quotas';

import { removeDir, useTempDataDir } from '@tests/support';

let dataDir: string;

beforeEach(() => {
  dataDir = useTempDataDir();
});

afterEach(() => {
  removeDir(dataDir);
});

describe('квоты аккаунта', () => {
  it('проверяет число листов на создании', () => {
    expect(
      evaluateQuota(
        { sheets: MAX_SHEETS_PER_ACCOUNT - 1, bytes: 0 },
        { isNewSheet: true, nextFileBytes: 10 },
      ).failure,
    ).toBeNull();
    expect(
      evaluateQuota(
        { sheets: MAX_SHEETS_PER_ACCOUNT, bytes: 0 },
        { isNewSheet: true, nextFileBytes: 10 },
      ).failure,
    ).toBe('sheets');
  });

  it('не мешает править существующий лист, пока аккаунт в лимите', () => {
    expect(
      evaluateQuota(
        { sheets: MAX_SHEETS_PER_ACCOUNT, bytes: 1_000 },
        { isNewSheet: false, currentFileBytes: 100, nextFileBytes: 200 },
      ).failure,
    ).toBeNull();
  });

  it('grandfather: сверх лимита можно уменьшать, но не расти', () => {
    const usage = { sheets: 5, bytes: MAX_ACCOUNT_BYTES + 1_000 };
    expect(
      evaluateQuota(usage, {
        isNewSheet: false,
        currentFileBytes: 5_000,
        nextFileBytes: 4_000,
      }).failure,
    ).toBeNull();
    expect(
      evaluateQuota(usage, {
        isNewSheet: false,
        currentFileBytes: 5_000,
        nextFileBytes: 6_000,
      }).failure,
    ).toBe('bytes');
    expect(
      evaluateQuota(usage, { isNewSheet: true, nextFileBytes: 1 }).failure,
    ).toBe('bytes');
  });

  it('сообщение ошибки зависит от причины', () => {
    const sheets = new QuotaExceededError('sheets', { sheets: 100, bytes: 0 });
    expect(sheets.message).toContain('100');
    const bytes = new QuotaExceededError('bytes', { sheets: 1, bytes: 0 });
    expect(bytes.message).toContain('MiB');
  });

  it('считает байты всего каталога и листы верхнего уровня', async () => {
    const uid = newUid();
    const userDir = getUserDir(uid);
    await fs.mkdir(path.join(userDir, 'characters'), { recursive: true });
    await fs.mkdir(path.join(userDir, 'history'), { recursive: true });
    await fs.writeFile(path.join(userDir, 'user.json'), '{"uid":"x"}');
    await fs.writeFile(path.join(userDir, 'characters', 'a.json'), '{}');
    await fs.writeFile(path.join(userDir, 'characters', 'b.json'), '{}');
    await fs.writeFile(path.join(userDir, 'characters', 'notes.txt'), 'x');
    await fs.writeFile(path.join(userDir, 'history', 'a.jsonl'), 'line\n');

    const usage = await getAccountUsage(uid);
    expect(usage.sheets).toBe(2);
    expect(usage.bytes).toBeGreaterThan(0);
    // История входит в байты, но не в счётчик листов.
    expect(usage.bytes).toBe(
      Buffer.byteLength('{"uid":"x"}') +
        Buffer.byteLength('{}') * 2 +
        Buffer.byteLength('x') +
        Buffer.byteLength('line\n'),
    );
  });
});
