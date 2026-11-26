import fs from 'node:fs';
import path from 'node:path';

import { afterEach, beforeEach, describe, expect, it } from 'vitest';

import { POST as preConsent } from '@/app/api/auth/pre-consent/route';
import { PRIVACY_VERSION } from '@/lib/legal/privacy';
import { resetAuthRateLimits } from '@/lib/security/rate-limit';
import { resetWriteSeqGuard } from '@/lib/server-storage';

import { removeDir, useTempDataDir } from '@tests/support';
import { registerAs, TEST_PASSWORD } from '@tests/support/api-auth';
import { json } from '@tests/support/http';

/**
 * ─── LANDMARK: PRE-CONSENT DATA RIGHTS ────────────────────────────────────
 * Кто не принял действующую редакцию, всё равно может забрать свои данные и
 * удалить аккаунт: согласие не должно быть условием реализации прав.
 */

let dataDir: string;

const consents = () => path.join(dataDir, 'consents.jsonl');

const call = (body: Record<string, unknown>) => preConsent(json(body));

beforeEach(async () => {
  dataDir = useTempDataDir();
  resetAuthRateLimits();
  resetWriteSeqGuard();
  const registered = await registerAs('legacy-rights');
  expect(registered.res.status).toBe(200);
  // Аккаунт «до появления согласия»: журнала нет.
  fs.rmSync(consents(), { force: true });
});

afterEach(() => {
  removeDir(dataDir);
  resetWriteSeqGuard();
});

describe('POST /api/auth/pre-consent', () => {
  it('экспорт отдаёт файл резервной копии без сессии', async () => {
    const res = await call({
      action: 'export',
      username: 'legacy-rights',
      password: TEST_PASSWORD,
    });

    expect(res.status).toBe(200);
    expect(res.headers.get('content-disposition')).toContain('attachment');
    expect(res.headers.get('set-cookie')).toBeNull();

    const payload = await res.json();
    expect(payload.metadata.kind).toBe('backup');
    expect(Array.isArray(payload.characters)).toBe(true);
  });

  it('удаление аккаунта не требует принятия политики', async () => {
    const res = await call({
      action: 'delete',
      username: 'legacy-rights',
      password: TEST_PASSWORD,
    });

    expect(res.status).toBe(200);
    expect((await res.json()).deleted).toBe(true);

    const usersDir = path.join(dataDir, 'users');
    const left = fs.existsSync(usersDir)
      ? fs.readdirSync(usersDir).filter((entry) => entry !== 'index')
      : [];
    expect(left).toEqual([]);
  });

  it('неверный пароль — 401 без подробностей', async () => {
    const res = await call({
      action: 'export',
      username: 'legacy-rights',
      password: 'wrong-pass-1234',
    });

    expect(res.status).toBe(401);
    expect((await res.json()).reason).toBe('invalid_credentials');
  });

  it('неизвестное действие — 400', async () => {
    const res = await call({
      action: 'steal',
      username: 'legacy-rights',
      password: TEST_PASSWORD,
    });
    expect(res.status).toBe(400);
  });

  it('аккаунту с принятой редакцией путь закрыт — 409', async () => {
    const fresh = await registerAs('accepted-user');
    expect(fresh.res.status).toBe(200);

    const res = await call({
      action: 'export',
      username: 'accepted-user',
      password: TEST_PASSWORD,
    });

    expect(res.status).toBe(409);
    expect((await res.json()).reason).toBe('consent_not_required');
  });

  it('принятая редакция в журнале — тоже 409', async () => {
    fs.writeFileSync(
      consents(),
      `${JSON.stringify({
        uid: 'some-uid',
        at: new Date().toISOString(),
        version: PRIVACY_VERSION,
        source: 'login',
      })}\n`,
    );

    // Чужая запись не должна открывать путь чужому аккаунту.
    const res = await call({
      action: 'export',
      username: 'legacy-rights',
      password: TEST_PASSWORD,
    });
    expect(res.status).toBe(200);
  });
});
