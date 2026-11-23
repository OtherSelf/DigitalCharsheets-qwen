import { afterEach, beforeEach, describe, expect, it } from 'vitest';

import { POST as loginRoute } from '@/app/api/auth/route';
import { resetAuthRateLimits } from '@/lib/security/rate-limit';
import { resetWriteSeqGuard } from '@/lib/server-storage';

import { removeDir, useTempDataDir } from '@tests/support';
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

describe('лимит входа на аккаунт', () => {
  it('не обходится сменой X-Forwarded-For', async () => {
    const statuses: number[] = [];
    for (let attempt = 1; attempt <= 11; attempt += 1) {
      const res = await loginRoute(
        json(
          { username: 'distributed-brute', password: 'wrong-pass-1234' },
          { 'x-forwarded-for': `203.0.113.${attempt}` },
        ),
      );
      statuses.push(res.status);
    }

    expect(statuses.slice(0, 10).every((status) => status === 401)).toBe(true);
    expect(statuses[10]).toBe(429);
  });
});
