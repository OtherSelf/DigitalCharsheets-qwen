import { afterEach, beforeEach, describe, expect, it } from 'vitest';

import { POST as recoverVerifyRoute } from '@/app/api/auth/recover/verify/route';
import { resetAuthRateLimits } from '@/lib/security/rate-limit';
import { authenticateUser, setRecoveryPhrase } from '@/lib/server-auth';
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

describe('лимит recovery на аккаунт', () => {
  it('не обходится сменой X-Forwarded-For', async () => {
    const uid = (
      await authenticateUser('distributed-recovery', 'pass-1234-5678')
    ).user!.uid;
    await setRecoveryPhrase(uid, 'amber cobalt lantern silver ember frost');

    const statuses: number[] = [];
    for (let attempt = 1; attempt <= 6; attempt += 1) {
      const res = await recoverVerifyRoute(
        json(
          {
            username: 'distributed-recovery',
            recoveryPhrase: 'wrong phrase here silver ember',
          },
          { 'x-forwarded-for': `198.51.100.${attempt}` },
        ),
      );
      statuses.push(res.status);
    }

    expect(statuses.slice(0, 5).every((status) => status === 400)).toBe(true);
    expect(statuses[5]).toBe(429);
  });
});
