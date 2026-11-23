import { afterEach, beforeEach, describe, expect, it } from 'vitest';

import { PUT as profileRoute } from '@/app/api/auth/profile/route';
import {
  isRecoveryPhraseHash,
  recoveryPhraseMatches,
} from '@/lib/security/phrase';
import { resetAuthRateLimits } from '@/lib/security/rate-limit';
import { resetWriteSeqGuard } from '@/lib/server-storage';

import {
  readJson,
  removeDir,
  sessionHeaders,
  userPaths,
  useTempDataDir,
} from '@tests/support';
import { loginAs } from '@tests/support/api-auth';
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

/**
 * PUT /api/auth/profile: смена recovery-фразы требует текущий пароль и
 * проходит ту же политику, что регистрация и /api/auth/phrase.
 */
describe('recovery-фраза через профиль (SEC-21, SEC-14)', () => {
  it('отвергает короткую фразу в профиле даже с текущим паролем', async () => {
    const { uid } = await loginAs('short-phrase-profile');
    const before = readJson(userPaths(dataDir, uid).userFile).recoveryPhrase;
    const res = await profileRoute(
      json(
        {
          newUsername: 'short-phrase-profile',
          newDisplayName: 'Name',
          newRecoveryPhrase: '12345',
          currentPassword: 'test-pass-1234',
        },
        await sessionHeaders(uid),
      ),
    );

    expect(res.status).toBe(400);
    expect((await res.json()).reason).toBe('invalid_phrase');
    expect(readJson(userPaths(dataDir, uid).userFile).recoveryPhrase).toBe(
      before,
    );
  });

  it('смена фразы без текущего пароля — 403, с паролем — 200', async () => {
    const { uid, cookie } = await loginAs('phrase-login');
    const headers = await sessionHeaders(uid);
    expect(cookie).toContain('dcs_session=');

    const denied = await profileRoute(
      json(
        {
          newUsername: 'phrase-login',
          newDisplayName: 'Name',
          newRecoveryPhrase: 'amber cobalt lantern silver ember frost',
        },
        headers,
      ),
    );
    expect(denied.status).toBe(403);
    expect((await denied.json()).reason).toBe('invalid_password');

    const allowed = await profileRoute(
      json(
        {
          newUsername: 'phrase-login',
          newDisplayName: 'Name',
          newRecoveryPhrase: 'amber cobalt lantern silver ember frost',
          currentPassword: 'test-pass-1234',
        },
        headers,
      ),
    );
    expect(allowed.status).toBe(200);
    const stored = readJson(userPaths(dataDir, uid).userFile).recoveryPhrase;
    expect(isRecoveryPhraseHash(stored)).toBe(true);
    expect(
      recoveryPhraseMatches(stored, 'amber cobalt lantern silver ember frost'),
    ).toBe(true);
  });
});
