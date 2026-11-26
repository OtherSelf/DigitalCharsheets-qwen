import fs from 'node:fs';
import path from 'node:path';

import { afterEach, beforeEach, describe, expect, it } from 'vitest';

import { POST as registerRoute } from '@/app/api/auth/register/route';
import {
  latestConsentVersion,
  markConsentsErased,
  pruneErasedConsents,
} from '@/lib/legal/consents';
import { PRIVACY_VERSION } from '@/lib/legal/privacy';
import { resetAuthRateLimits } from '@/lib/security/rate-limit';
import { resetWriteSeqGuard } from '@/lib/server-storage';

import { removeDir, useTempDataDir } from '@tests/support';

/**
 * ─── LANDMARK: REGISTER CONSENT ────────────────────────────────────────────
 * Регистрация без согласия или с устаревшей версией политики отклоняется, а
 * успешная пишет строку в `consents.jsonl` — доказательство согласия.
 */

let dataDir: string;

const request = (body: unknown) =>
  new Request('http://localhost/api/auth/register', {
    method: 'POST',
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify(body),
  });

const base = {
  username: 'consent-user',
  password: 'test-pass-1234',
  displayName: 'Consent',
  recoveryPhrase: 'amber cobalt lantern silver ember frost',
};

beforeEach(() => {
  dataDir = useTempDataDir();
  resetAuthRateLimits();
  resetWriteSeqGuard();
});

afterEach(() => {
  removeDir(dataDir);
  resetWriteSeqGuard();
});

describe('POST /api/auth/register: согласие', () => {
  it('без согласия — 400 consent_required', async () => {
    const res = await registerRoute(request(base));

    expect(res.status).toBe(400);
    expect((await res.json()).reason).toBe('consent_required');
    expect(fs.existsSync(path.join(dataDir, 'users'))).toBe(false);
  });

  it('устаревшая версия политики — 400 privacy_version_mismatch', async () => {
    const res = await registerRoute(
      request({ ...base, consent: true, privacyVersion: '2000-01-01' }),
    );

    expect(res.status).toBe(400);
    expect((await res.json()).reason).toBe('privacy_version_mismatch');
  });

  it('согласие пишется в consents.jsonl', async () => {
    const res = await registerRoute(
      request({ ...base, consent: true, privacyVersion: PRIVACY_VERSION }),
    );
    const body = await res.json();
    expect(res.status).toBe(200);
    expect(body.user.uid).toBeTruthy();

    const lines = fs
      .readFileSync(path.join(dataDir, 'consents.jsonl'), 'utf8')
      .trim()
      .split('\n');
    expect(lines).toHaveLength(1);
    expect(JSON.parse(lines[0])).toMatchObject({
      uid: body.user.uid,
      version: PRIVACY_VERSION,
      source: 'register',
    });
    expect(JSON.parse(lines[0]).at).toMatch(/^\d{4}-\d{2}-\d{2}T/);
  });
});

describe('журнал согласий после удаления аккаунта', () => {
  it('надгробие не считается принятием редакции', async () => {
    const res = await registerRoute(
      request({ ...base, consent: true, privacyVersion: PRIVACY_VERSION }),
    );
    const { user } = await res.json();

    expect(await latestConsentVersion(user.uid)).toBe(PRIVACY_VERSION);
    await markConsentsErased(user.uid);
    expect(await latestConsentVersion(user.uid)).toBe(PRIVACY_VERSION);
  });

  it('аккаунт без принятий не оставляет пустого надгробия', async () => {
    const file = path.join(dataDir, 'consents.jsonl');
    fs.writeFileSync(file, '');
    await markConsentsErased('00000000-0000-4000-8000-000000000000');
    expect(fs.readFileSync(file, 'utf8')).toBe('');
  });

  it('через три года строки удалённого аккаунта исчезают', async () => {
    const res = await registerRoute(
      request({ ...base, consent: true, privacyVersion: PRIVACY_VERSION }),
    );
    const { user } = await res.json();
    await markConsentsErased(user.uid);

    const olderThanThreeYears = Date.now() + 4 * 365 * 24 * 60 * 60 * 1000;
    const removed = await pruneErasedConsents(olderThanThreeYears);
    expect(removed).toBeGreaterThanOrEqual(2);
    expect(fs.readFileSync(path.join(dataDir, 'consents.jsonl'), 'utf8')).toBe(
      '',
    );
  });

  it('записи живого аккаунта чистка не трогает', async () => {
    const res = await registerRoute(
      request({ ...base, consent: true, privacyVersion: PRIVACY_VERSION }),
    );
    const { user } = await res.json();

    await pruneErasedConsents(Date.now() + 10 * 365 * 24 * 60 * 60 * 1000);
    expect(await latestConsentVersion(user.uid)).toBe(PRIVACY_VERSION);
  });
});
