import fs from 'node:fs';
import fsp from 'node:fs/promises';
import path from 'node:path';

import { afterEach, beforeEach, describe, expect, it } from 'vitest';

import { POST as charactersPost } from '@/app/api/characters/route';
import { listGameModules } from '@/games/registry';
import { MAX_ACCOUNT_BYTES, MAX_SHEETS_PER_ACCOUNT } from '@/lib/quotas';
import { resetAuthRateLimits } from '@/lib/security/rate-limit';
import { resetWriteSeqGuard } from '@/lib/server-storage';

import {
  makeCharacter,
  removeDir,
  userPaths,
  useTempDataDir,
} from '@tests/support';
import { registerAs } from '@tests/support/api-auth';
import { json } from '@tests/support/http';

let dataDir: string;

beforeEach(() => {
  dataDir = useTempDataDir();
  resetWriteSeqGuard();
  resetAuthRateLimits();
});

afterEach(() => {
  removeDir(dataDir);
  resetWriteSeqGuard();
});

describe('/api/characters: квоты', () => {
  it('101-й лист — 409 quota_exceeded, файл не создаётся', async () => {
    const { uid, cookie } = await registerAs('quota-sheets');
    const charactersDir = userPaths(dataDir, uid).charactersDir;
    await fsp.mkdir(charactersDir, { recursive: true });

    for (let index = 0; index < MAX_SHEETS_PER_ACCOUNT; index += 1) {
      await fsp.writeFile(
        path.join(charactersDir, `sheet-${index}.json`),
        '{}',
      );
    }

    const res = await charactersPost(
      json(makeCharacter(listGameModules()[0].id), { cookie }),
    );
    expect(res.status).toBe(409);
    const body = await res.json();
    expect(body.reason).toBe('quota_exceeded');
    expect(body.limit).toBe('sheets');

    const files = await fsp.readdir(charactersDir);
    expect(files.filter((name) => name.endsWith('.json'))).toHaveLength(
      MAX_SHEETS_PER_ACCOUNT,
    );
  });

  it('рост объёма сверх 50 МиБ — 409 quota_exceeded', async () => {
    const { uid, cookie } = await registerAs('quota-bytes');
    const userDir = userPaths(dataDir, uid).userDir;
    await fsp.mkdir(userDir, { recursive: true });
    // Разреженный файл: занимает место в квоте, но не на диске.
    const big = path.join(userDir, 'history', 'big.jsonl');
    await fsp.mkdir(path.dirname(big), { recursive: true });
    const handle = await fsp.open(big, 'w');
    await handle.truncate(MAX_ACCOUNT_BYTES + 1);
    await handle.close();
    expect(fs.statSync(big).size).toBeGreaterThan(MAX_ACCOUNT_BYTES);

    const res = await charactersPost(
      json(makeCharacter(listGameModules()[0].id), { cookie }),
    );
    expect(res.status).toBe(409);
    expect((await res.json()).limit).toBe('bytes');
  });
});
