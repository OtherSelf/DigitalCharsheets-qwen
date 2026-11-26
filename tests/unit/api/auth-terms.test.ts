import fs from 'node:fs';
import path from 'node:path';

import { afterEach, beforeEach, describe, expect, it } from 'vitest';

import { POST as registerRoute } from '@/app/api/auth/register/route';
import { POST as loginRoute } from '@/app/api/auth/route';
import { PRIVACY_VERSION } from '@/lib/legal/privacy';
import { TERMS_VERSION } from '@/lib/legal/terms';
import { resetAuthRateLimits } from '@/lib/security/rate-limit';
import { resetWriteSeqGuard } from '@/lib/server-storage';

import { removeDir, useTempDataDir } from '@tests/support';
import { TEST_PASSWORD } from '@tests/support/api-auth';
import { json } from '@tests/support/http';

/**
 * ─── LANDMARK: TERMS ACCEPTANCE ────────────────────────────────────────────
 * Соглашение — часть договора, поэтому его редакция проверяется вместе с
 * политикой: одна галочка, две версии, обе обязательны.
 */

let dataDir: string;

const base = {
  username: 'terms-user',
  password: TEST_PASSWORD,
  displayName: 'Terms',
  recoveryPhrase: 'amber cobalt lantern silver ember frost',
};

const register = (extra: Record<string, unknown>) =>
  registerRoute(json({ ...base, ...extra }));

const login = (extra: Record<string, unknown>) =>
  loginRoute(
    json({ username: base.username, password: TEST_PASSWORD, ...extra }),
  );

const consentsFile = () => path.join(dataDir, 'consents.jsonl');

beforeEach(() => {
  dataDir = useTempDataDir();
  resetAuthRateLimits();
  resetWriteSeqGuard();
});

afterEach(() => {
  removeDir(dataDir);
  resetWriteSeqGuard();
});

describe('соглашение при регистрации и входе', () => {
  it('без версии соглашения регистрация отклоняется', async () => {
    const res = await register({
      consent: true,
      privacyVersion: PRIVACY_VERSION,
    });

    expect(res.status).toBe(400);
    expect((await res.json()).reason).toBe('terms_version_mismatch');
  });

  it('устаревшая версия соглашения отклоняется', async () => {
    const res = await register({
      consent: true,
      privacyVersion: PRIVACY_VERSION,
      termsVersion: '2000-01-01',
    });

    expect(res.status).toBe(400);
    expect((await res.json()).reason).toBe('terms_version_mismatch');
  });

  it('обе версии пишутся в журнал', async () => {
    const res = await register({
      consent: true,
      privacyVersion: PRIVACY_VERSION,
      termsVersion: TERMS_VERSION,
    });
    const body = await res.json();
    expect(res.status).toBe(200);

    const record = JSON.parse(
      fs.readFileSync(consentsFile(), 'utf8').trim().split('\n').pop()!,
    );
    expect(record).toMatchObject({
      uid: body.user.uid,
      version: PRIVACY_VERSION,
      termsVersion: TERMS_VERSION,
      source: 'register',
    });
  });

  it('аккаунт со старым согласием проходит гейт только с обеими версиями', async () => {
    // Аккаунт «до появления соглашения»: запись есть, версии соглашения нет.
    await register({
      consent: true,
      privacyVersion: PRIVACY_VERSION,
      termsVersion: TERMS_VERSION,
    });
    fs.writeFileSync(
      consentsFile(),
      `${JSON.stringify({
        uid: 'some-uid',
        at: new Date().toISOString(),
        version: PRIVACY_VERSION,
        source: 'register',
      })}\n`,
    );

    const denied = await login({});
    expect(denied.status).toBe(403);
    expect((await denied.json()).reason).toBe('privacy_consent_required');

    const stale = await login({
      consent: true,
      privacyVersion: PRIVACY_VERSION,
      termsVersion: '2000-01-01',
    });
    expect(stale.status).toBe(400);
    expect((await stale.json()).reason).toBe('terms_version_mismatch');

    const accepted = await login({
      consent: true,
      privacyVersion: PRIVACY_VERSION,
      termsVersion: TERMS_VERSION,
    });
    expect(accepted.status).toBe(200);

    const record = JSON.parse(
      fs.readFileSync(consentsFile(), 'utf8').trim().split('\n').pop()!,
    );
    expect(record).toMatchObject({
      termsVersion: TERMS_VERSION,
      source: 'login',
    });
  });
});
