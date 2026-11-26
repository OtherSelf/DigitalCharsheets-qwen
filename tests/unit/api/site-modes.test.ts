import fs from 'node:fs';
import path from 'node:path';

import { afterEach, beforeEach, describe, expect, it } from 'vitest';

import {
  GET as settingsGet,
  PUT as settingsPut,
} from '@/app/api/admin/settings/route';
import { POST as registerRoute } from '@/app/api/auth/register/route';
import { POST as loginRoute } from '@/app/api/auth/route';
import { PRIVACY_VERSION } from '@/lib/legal/privacy';
import { TERMS_VERSION } from '@/lib/legal/terms';
import { resetAuthRateLimits } from '@/lib/security/rate-limit';
import { resetWriteSeqGuard } from '@/lib/server-storage';
import {
  readSiteSettings,
  resetSiteSettingsCache,
  writeSiteSettings,
} from '@/lib/site-settings';

import { removeDir, useTempDataDir } from '@tests/support';
import { registerAs, TEST_PASSWORD } from '@tests/support/api-auth';
import { json } from '@tests/support/http';

/**
 * ─── LANDMARK: SITE MODES ──────────────────────────────────────────────────
 * Переключатели инстанса: регистрация, вход только для админов/тестеров,
 * режим обслуживания. Проверяются и хранилище, и отказы API.
 */

let dataDir: string;

const DEFAULTS = {
  registration: { open: true },
  access: { loginRestrictedToStaff: false, maintenance: false },
};

const siteSettingsFile = () => path.join(dataDir, 'site-settings.json');

const registration = (username: string) =>
  json({
    username,
    password: TEST_PASSWORD,
    displayName: 'Mode',
    recoveryPhrase: 'amber cobalt lantern silver ember frost',
    consent: true,
    privacyVersion: PRIVACY_VERSION,
    termsVersion: TERMS_VERSION,
  });

const login = (username: string) => json({ username, password: TEST_PASSWORD });

beforeEach(() => {
  dataDir = useTempDataDir();
  resetAuthRateLimits();
  resetWriteSeqGuard();
  resetSiteSettingsCache();
});

afterEach(() => {
  removeDir(dataDir);
  resetWriteSeqGuard();
  resetSiteSettingsCache();
});

describe('site settings store', () => {
  it('без файла — значения по умолчанию: всё открыто', async () => {
    expect(await readSiteSettings()).toEqual(DEFAULTS);
  });

  it('битый файл не роняет сайт и не открывает лишнего', async () => {
    fs.writeFileSync(siteSettingsFile(), '{ oops');
    expect(await readSiteSettings()).toEqual(DEFAULTS);
  });

  it('запись и чтение круга', async () => {
    await writeSiteSettings({
      registration: { open: false },
      access: { loginRestrictedToStaff: true, maintenance: false },
    });

    resetSiteSettingsCache();
    expect(await readSiteSettings()).toEqual({
      registration: { open: false },
      access: { loginRestrictedToStaff: true, maintenance: false },
    });
  });
});

describe('режимы через API', () => {
  it('закрытая регистрация → 403 registration_closed', async () => {
    await writeSiteSettings({
      registration: { open: false },
      access: { loginRestrictedToStaff: false, maintenance: false },
    });
    resetSiteSettingsCache();

    const res = await registerRoute(registration('closed-user'));
    expect(res.status).toBe(403);
    expect((await res.json()).reason).toBe('registration_closed');
    expect(fs.existsSync(path.join(dataDir, 'users'))).toBe(false);
  });

  it('вход только для персонала → 403 login_restricted без cookie', async () => {
    const registered = await registerAs('plain-user');
    expect(registered.res.status).toBe(200);

    await writeSiteSettings({
      registration: { open: true },
      access: { loginRestrictedToStaff: true, maintenance: false },
    });
    resetSiteSettingsCache();

    const res = await loginRoute(login('plain-user'));
    expect(res.status).toBe(403);
    expect((await res.json()).reason).toBe('login_restricted');
    expect(res.headers.get('set-cookie')).toBeNull();
  });

  it('вход только для персонала пускает админа', async () => {
    await registerAs('boss-user');
    // Роль меняется файлом профиля: отдельного API для этого в тесте нет.
    const { uid } = await registerAs('boss-user-2');
    const usersDir = path.join(dataDir, 'users');
    const profileFile = path.join(usersDir, uid, 'user.json');
    const profile = JSON.parse(fs.readFileSync(profileFile, 'utf8'));
    fs.writeFileSync(
      profileFile,
      JSON.stringify({ ...profile, role: 'admin' }),
    );

    await writeSiteSettings({
      registration: { open: true },
      access: { loginRestrictedToStaff: true, maintenance: false },
    });
    resetSiteSettingsCache();

    const res = await loginRoute(login('boss-user-2'));
    expect(res.status).toBe(200);
  });
});

describe('GET/PUT /api/admin/settings', () => {
  it('без сессии — 401', async () => {
    expect(
      (await settingsGet(new Request('http://localhost/api/admin/settings')))
        .status,
    ).toBe(401);
  });

  it('невалидный объект — 400', async () => {
    const { uid } = await registerAs('admin-user');
    const profileFile = path.join(dataDir, 'users', uid, 'user.json');
    const profile = JSON.parse(fs.readFileSync(profileFile, 'utf8'));
    fs.writeFileSync(
      profileFile,
      JSON.stringify({ ...profile, role: 'admin' }),
    );

    // Админская сессия: входим тем же аккаунтом.
    const auth = await loginRoute(login('admin-user'));
    const cookie = (auth.headers.get('set-cookie') || '').split(';')[0];
    expect(cookie).toContain('dcs_session');

    const bad = await settingsPut(
      new Request('http://localhost/api/admin/settings', {
        method: 'PUT',
        headers: { 'content-type': 'application/json', cookie },
        body: JSON.stringify({ registration: { open: 'нет' } }),
      }),
    );
    expect(bad.status).toBe(400);

    const good = await settingsPut(
      new Request('http://localhost/api/admin/settings', {
        method: 'PUT',
        headers: { 'content-type': 'application/json', cookie },
        body: JSON.stringify({
          registration: { open: false },
          access: { loginRestrictedToStaff: false, maintenance: false },
        }),
      }),
    );
    expect(good.status).toBe(200);
    expect((await readSiteSettings()).registration.open).toBe(false);
  });
});
