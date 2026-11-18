/**
 * GET /api/auth/session: актуальная роль и 401 для заблокированного.
 */

import { afterEach, beforeEach, describe, expect, it } from 'vitest';

import { GET as sessionRoute } from '@/app/api/auth/session/route';
import { resetWriteSeqGuard } from '@/lib/server-storage';

import { removeDir, sessionHeaders, useTempDataDir } from '@tests/support';
import { get, seedAdmin } from '@tests/support/admin-flows';

let dataDir: string;

beforeEach(() => {
  dataDir = useTempDataDir();
  resetWriteSeqGuard();
});

afterEach(() => {
  removeDir(dataDir);
  resetWriteSeqGuard();
});

describe('GET /api/auth/session', () => {
  it('отдаёт актуальную роль и 401 без сессии', async () => {
    const admin = seedAdmin();
    const res = await sessionRoute(
      get('http://localhost/api/auth/session', sessionHeaders(admin.uid)),
    );
    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body.user).toMatchObject({
      uid: admin.uid,
      username: 'admin',
      role: 'admin',
    });

    const anonymous = await sessionRoute(
      get('http://localhost/api/auth/session'),
    );
    expect(anonymous.status).toBe(401);
  });
});
