import fs from 'node:fs';
import path from 'node:path';

import { afterEach, beforeEach, describe, expect, it } from 'vitest';

import { POST as registerRoute } from '@/app/api/auth/register/route';
import { POST as loginRoute } from '@/app/api/auth/route';
import { PRIVACY_VERSION } from '@/lib/legal/privacy';
import { resetAuthRateLimits } from '@/lib/security/rate-limit';
import { resetWriteSeqGuard } from '@/lib/server-storage';

import { removeDir, useTempDataDir } from '@tests/support';
import { TEST_PASSWORD } from '@tests/support/api-auth';
import { json } from '@tests/support/http';

/**
 * ─── LANDMARK: LOGIN CONSENT GATE ──────────────────────────────────────────
 * Аккаунт, который не принял действующую редакцию политики, не получает
 * сессию: сервер отвечает `privacy_consent_required`, а принятие в том же
 * запросе входа дописывает строку в журнал согласий.
 *
 * «Старый» аккаунт моделируется удалением журнала: именно так выглядит
 * пользователь, зарегистрированный до появления согласия.
 */

let dataDir: string;

const base = {
  username: 'legacy-user',
  password: TEST_PASSWORD,
  displayName: 'Legacy',
  recoveryPhrase: 'amber cobalt lantern silver ember frost',
};

const register = () =>
  registerRoute(
    json({ ...base, consent: true, privacyVersion: PRIVACY_VERSION }),
  );

const login = (body: Record<string, unknown>) =>
  loginRoute(
    json({ username: base.username, password: base.password, ...body }),
  );

const consentsFile = () => path.join(dataDir, 'consents.jsonl');

const readConsents = (): Array<Record<string, unknown>> => {
  if (!fs.existsSync(consentsFile())) return [];
  return fs
    .readFileSync(consentsFile(), 'utf8')
    .trim()
    .split('\n')
    .filter(Boolean)
    .map((line) => JSON.parse(line));
};

beforeEach(async () => {
  dataDir = useTempDataDir();
  resetAuthRateLimits();
  resetWriteSeqGuard();
  const res = await register();
  expect(res.status).toBe(200);
  // Свежий аккаунт принимал политику при регистрации; удаляем журнал, чтобы
  // получить состояние «аккаунт есть, согласия нет».
  fs.rmSync(consentsFile(), { force: true });
});

afterEach(() => {
  removeDir(dataDir);
  resetWriteSeqGuard();
});

describe('POST /api/auth: политика для существующих аккаунтов', () => {
  it('без записи согласия — 403 privacy_consent_required и без cookie', async () => {
    const res = await login({});

    expect(res.status).toBe(403);
    expect((await res.json()).reason).toBe('privacy_consent_required');
    expect(res.headers.get('set-cookie')).toBeNull();
    expect(readConsents()).toHaveLength(0);
  });

  it('устаревшая версия в запросе — 400 privacy_version_mismatch', async () => {
    const res = await login({ consent: true, privacyVersion: '2000-01-01' });

    expect(res.status).toBe(400);
    expect((await res.json()).reason).toBe('privacy_version_mismatch');
    expect(res.headers.get('set-cookie')).toBeNull();
  });

  it('принятие в запросе входа пишет журнал и выдаёт сессию', async () => {
    const res = await login({ consent: true, privacyVersion: PRIVACY_VERSION });
    const body = await res.json();

    expect(res.status).toBe(200);
    expect(res.headers.get('set-cookie')).toContain('dcs_session');
    expect(readConsents()).toEqual([
      expect.objectContaining({
        uid: body.user.uid,
        version: PRIVACY_VERSION,
        source: 'login',
      }),
    ]);

    // Теперь редакция принята: следующий вход не требует галочки.
    const again = await login({});
    expect(again.status).toBe(200);
    expect(readConsents()).toHaveLength(1);
  });

  it('запись за другой редакцией не считается принятием действующей', async () => {
    fs.writeFileSync(
      consentsFile(),
      `${JSON.stringify({
        uid: 'someone-else',
        at: new Date().toISOString(),
        version: PRIVACY_VERSION,
        source: 'register',
      })}\n`,
    );

    const res = await login({});
    expect(res.status).toBe(403);
    expect((await res.json()).reason).toBe('privacy_consent_required');
  });

  it('битая строка в журнале не мешает принять политику', async () => {
    fs.writeFileSync(consentsFile(), '{не json}\n');

    const res = await login({});
    expect(res.status).toBe(403);

    const accepted = await login({
      consent: true,
      privacyVersion: PRIVACY_VERSION,
    });
    expect(accepted.status).toBe(200);
  });
});
