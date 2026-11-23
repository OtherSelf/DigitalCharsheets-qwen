import crypto from 'node:crypto';
import fs from 'node:fs';
import path from 'node:path';

import { afterEach, beforeEach, describe, expect, it } from 'vitest';

import { POST as loginRoute } from '@/app/api/auth/route';
import { POST as backupCodesRoute } from '@/app/api/auth/totp/backup-codes/route';
import { POST as disableRoute } from '@/app/api/auth/totp/disable/route';
import { POST as enableRoute } from '@/app/api/auth/totp/enable/route';
import { POST as setupRoute } from '@/app/api/auth/totp/setup/route';
import { resetAuthRateLimits } from '@/lib/security/rate-limit';
import { totpCodeForStep } from '@/lib/security/totp';
import { resetWriteSeqGuard } from '@/lib/server-storage';

import {
  readJson,
  removeDir,
  sessionHeaders,
  userPaths,
  useTempDataDir,
} from '@tests/support';
import { loginAs, TEST_PASSWORD } from '@tests/support/api-auth';
import { json } from '@tests/support/http';

let dataDir: string;

beforeEach(() => {
  dataDir = useTempDataDir();
  resetWriteSeqGuard();
  resetAuthRateLimits();
  process.env.DCS_TOTP_KEY = crypto.randomBytes(32).toString('base64');
});

afterEach(() => {
  delete process.env.DCS_TOTP_KEY;
  removeDir(dataDir);
  resetWriteSeqGuard();
});

describe('TOTP-роуты', () => {
  it('setup без сессии → 401, без пароля → 403', async () => {
    expect(
      (await setupRoute(json({ currentPassword: TEST_PASSWORD }))).status,
    ).toBe(401);

    const { uid } = await loginAs('totp-route');
    const res = await setupRoute(json({}, await sessionHeaders(uid)));
    expect(res.status).toBe(403);
    expect((await res.json()).reason).toBe('invalid_password');
  });

  it('setup без DCS_TOTP_KEY создаёт ключ в data-dir', async () => {
    delete process.env.DCS_TOTP_KEY;
    const { uid } = await loginAs('totp-file-key-route');
    const res = await setupRoute(
      json({ currentPassword: TEST_PASSWORD }, await sessionHeaders(uid)),
    );
    expect(res.status).toBe(200);
    expect((await res.json()).secret).toBeTruthy();
    expect(fs.existsSync(path.join(dataDir, '.totp-key'))).toBe(true);
  });

  it('полный цикл: setup → enable → вход с кодом → disable', async () => {
    const login = await loginAs('totp-cycle');
    const headers = await sessionHeaders(login.uid);
    const password = TEST_PASSWORD;

    const setup = await setupRoute(
      json({ currentPassword: password }, headers),
    );
    expect(setup.status).toBe(200);
    const setupBody = await setup.json();
    expect(setupBody.otpauthUri).toContain('otpauth://totp/');
    expect(setupBody.qrDataUrl).toMatch(/^data:image\/svg\+xml;base64,/);
    expect(
      fs.readFileSync(userPaths(dataDir, login.uid).userFile, 'utf8'),
    ).not.toContain(setupBody.secret);

    const step = Math.floor(Date.now() / 1000 / 30);
    const enabled = await enableRoute(
      json({ code: totpCodeForStep(setupBody.secret, step) }, headers),
    );
    expect(enabled.status).toBe(200);
    const enabledBody = await enabled.json();
    expect(enabledBody.backupCodes).toHaveLength(10);

    const withoutCode = await loginRoute(
      json({ username: 'totp-cycle', password }),
    );
    expect(withoutCode.status).toBe(401);
    expect((await withoutCode.json()).reason).toBe('totp_required');

    const withCode = await loginRoute(
      json({
        username: 'totp-cycle',
        password,
        totpCode: totpCodeForStep(setupBody.secret, step + 1),
      }),
    );
    expect(withCode.status).toBe(200);
    expect(withCode.headers.get('set-cookie')).toBeTruthy();

    const disabled = await disableRoute(
      json(
        {
          currentPassword: password,
          code: enabledBody.backupCodes[0],
        },
        headers,
      ),
    );
    expect(disabled.status).toBe(200);
    expect(
      readJson(userPaths(dataDir, login.uid).userFile).totp,
    ).toBeUndefined();

    const backupCodes = await backupCodesRoute(
      json({ currentPassword: password }, headers),
    );
    expect(backupCodes.status).toBe(409);
  });
});
