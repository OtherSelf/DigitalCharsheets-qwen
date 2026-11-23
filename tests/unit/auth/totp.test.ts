import crypto from 'node:crypto';
import fs from 'node:fs';
import path from 'node:path';

import { afterEach, beforeEach, describe, expect, it } from 'vitest';

import { issueRecoveryToken } from '@/lib/security/tokens';
import { totpCodeForStep } from '@/lib/security/totp';
import { authenticateUser, resetCredentialsWithToken } from '@/lib/server-auth';
import {
  disableTotp,
  enableTotp,
  regenerateBackupCodes,
  startTotpSetup,
} from '@/lib/totp-service';

import { readJson, removeDir, userPaths, useTempDataDir } from '@tests/support';

let dataDir: string;
const PASSWORD = 'totp-pass-1234';

beforeEach(() => {
  dataDir = useTempDataDir();
  process.env.DCS_TOTP_KEY = crypto.randomBytes(32).toString('base64');
});

afterEach(() => {
  delete process.env.DCS_TOTP_KEY;
  removeDir(dataDir);
});

async function createUser(login = 'totp-user') {
  const result = await authenticateUser(login, PASSWORD);
  return result.user!.uid;
}

const currentStep = () => Math.floor(Date.now() / 1000 / 30);
const codeFor = (secret: string, delta = 1) =>
  totpCodeForStep(secret, currentStep() + delta);

describe('TOTP: enrollment, вход и backup-коды', () => {
  it('включает TOTP, требует код на входе и отвергает повтор', async () => {
    const uid = await createUser();
    const setup = await startTotpSetup(uid, PASSWORD);
    expect(setup.success).toBe(true);
    if (!setup.success) return;

    const stored = readJson(userPaths(dataDir, uid).userFile);
    expect(stored.totp?.secret).toBeTruthy();
    expect(stored.totp.secret).not.toContain(setup.secret);
    expect(
      fs.readFileSync(userPaths(dataDir, uid).userFile, 'utf8'),
    ).not.toContain(setup.secret);

    const enabled = await enableTotp(uid, codeFor(setup.secret, 0));
    expect(enabled.success).toBe(true);
    if (!enabled.success) return;
    expect(enabled.backupCodes).toHaveLength(10);

    const withoutCode = await authenticateUser('totp-user', PASSWORD);
    expect(withoutCode.success).toBe(false);
    expect(withoutCode.reason).toBe('totp_required');

    const withCode = await authenticateUser('totp-user', PASSWORD, undefined, {
      totpCode: codeFor(setup.secret, 1),
    });
    expect(withCode.success).toBe(true);

    // Тот же код повторно не принимается (anti-replay по lastStep).
    const replay = await authenticateUser('totp-user', PASSWORD, undefined, {
      totpCode: codeFor(setup.secret, 1),
    });
    expect(replay.success).toBe(false);
    expect(replay.reason).toBe('totp_invalid');
  });

  it('backup-код одноразовый', async () => {
    const uid = await createUser('totp-backup');
    const setup = await startTotpSetup(uid, PASSWORD);
    if (!setup.success) throw new Error('setup failed');
    const enabled = await enableTotp(uid, codeFor(setup.secret, 0));
    if (!enabled.success) throw new Error('enable failed');
    const backup = enabled.backupCodes[0];

    const first = await authenticateUser('totp-backup', PASSWORD, undefined, {
      totpCode: backup,
    });
    expect(first.success).toBe(true);

    const second = await authenticateUser('totp-backup', PASSWORD, undefined, {
      totpCode: backup,
    });
    expect(second.success).toBe(false);
    expect(second.reason).toBe('totp_invalid');
  });

  it('перегенерация и выключение требуют пароль/код', async () => {
    const uid = await createUser('totp-manage');
    const setup = await startTotpSetup(uid, PASSWORD);
    if (!setup.success) throw new Error('setup failed');
    const enabled = await enableTotp(uid, codeFor(setup.secret, 0));
    if (!enabled.success) throw new Error('enable failed');

    const wrongPassword = await regenerateBackupCodes(uid, 'wrong-pass-1234');
    expect(wrongPassword.success).toBe(false);
    if (wrongPassword.success) throw new Error('expected failure');
    expect(wrongPassword.reason).toBe('invalid_password');

    const regenerated = await regenerateBackupCodes(uid, PASSWORD);
    expect(regenerated.success).toBe(true);
    if (!regenerated.success) return;
    expect(regenerated.backupCodes[0]).not.toBe(enabled.backupCodes[0]);

    const disabled = await disableTotp(uid, PASSWORD, codeFor(setup.secret, 1));
    expect(disabled.success).toBe(true);
    expect(readJson(userPaths(dataDir, uid).userFile).totp).toBeUndefined();
    expect((await authenticateUser('totp-manage', PASSWORD)).success).toBe(
      true,
    );
  });

  it('работает без DCS_TOTP_KEY: ключ создаётся в data-dir', async () => {
    delete process.env.DCS_TOTP_KEY;
    const uid = await createUser('totp-file-key');
    const setup = await startTotpSetup(uid, PASSWORD);
    expect(setup.success).toBe(true);
    if (!setup.success) return;

    const keyFile = path.join(dataDir, '.totp-key');
    expect(fs.existsSync(keyFile)).toBe(true);
    expect(fs.statSync(keyFile).mode & 0o777).toBe(0o600);

    const enabled = await enableTotp(uid, codeFor(setup.secret, 0));
    expect(enabled.success).toBe(true);
  });

  it('восстановление доступа отключает TOTP', async () => {
    const uid = await createUser('totp-recover');
    const setup = await startTotpSetup(uid, PASSWORD);
    if (!setup.success) throw new Error('setup failed');
    await enableTotp(uid, codeFor(setup.secret, 0));

    const { token } = await issueRecoveryToken(uid);
    const reset = await resetCredentialsWithToken(
      token,
      'new-pass-1234',
      'new phrase here silver ember frost',
    );
    expect(reset.success).toBe(true);
    expect(readJson(userPaths(dataDir, uid).userFile).totp).toBeUndefined();
    expect(
      (await authenticateUser('totp-recover', 'new-pass-1234')).success,
    ).toBe(true);
  });

  it('без DCS_TOTP_KEY вход не обходится паролем', async () => {
    const uid = await createUser('totp-nokey');
    const setup = await startTotpSetup(uid, PASSWORD);
    if (!setup.success) throw new Error('setup failed');
    await enableTotp(uid, codeFor(setup.secret, 0));

    delete process.env.DCS_TOTP_KEY;
    const unavailable = await authenticateUser('totp-nokey', PASSWORD);
    expect(unavailable.success).toBe(false);
    expect(unavailable.reason).toBe('totp_required');
  });
});
