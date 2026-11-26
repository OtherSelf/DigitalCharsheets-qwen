import fs from 'node:fs';
import path from 'node:path';

import { NextRequest } from 'next/server';

import { afterEach, beforeEach, describe, expect, it } from 'vitest';

import { resetAuthRateLimits } from '@/lib/security/rate-limit';
import { resetWriteSeqGuard } from '@/lib/server-storage';
import { resetSiteSettingsCache, writeSiteSettings } from '@/lib/site-settings';
import { proxy } from '@/proxy';

import { removeDir, useTempDataDir } from '@tests/support';
import { registerAs } from '@tests/support/api-auth';

/**
 * ─── LANDMARK: MAINTENANCE GATE ────────────────────────────────────────────
 * Режим обслуживания: страницы уходят на `/maintenance`, API отвечает 503,
 * но вход и админ остаются доступными — иначе тумблер запирал бы сайт.
 */

let dataDir: string;

const openMaintenance = async () => {
  await writeSiteSettings({
    registration: { open: true },
    access: { loginRestrictedToStaff: false, maintenance: true },
  });
  resetSiteSettingsCache();
};

const request = (pathname: string, cookie?: string) =>
  new NextRequest(`http://localhost${pathname}`, {
    headers: cookie ? { cookie } : undefined,
  });

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

describe('proxy: режим обслуживания', () => {
  it('выключен — пропускает страницы', async () => {
    const response = await proxy(request('/'));
    expect(response.headers.get('x-middleware-next')).toBe('1');
  });

  it('включён — страницу переписывает на /maintenance', async () => {
    await openMaintenance();
    const response = await proxy(request('/'));
    const rewrite = response.headers.get('x-middleware-rewrite') ?? '';
    expect(rewrite).toContain('/maintenance');
  });

  it('вход и экран обслуживания остаются открытыми', async () => {
    await openMaintenance();
    expect(
      (await proxy(request('/login'))).headers.get('x-middleware-next'),
    ).toBe('1');
    expect(
      (await proxy(request('/maintenance'))).headers.get('x-middleware-next'),
    ).toBe('1');
    expect(
      (await proxy(request('/api/auth/session'))).headers.get(
        'x-middleware-next',
      ),
    ).toBe('1');
  });

  it('API отвечает 503 с reason maintenance', async () => {
    await openMaintenance();
    const response = await proxy(request('/api/characters'));
    expect(response.status).toBe(503);
    expect((await response.json()).reason).toBe('maintenance');
  });

  it('админ проходит на страницы', async () => {
    const { uid, cookie } = await registerAs('maint-admin');
    const profileFile = path.join(dataDir, 'users', uid, 'user.json');
    const profile = JSON.parse(fs.readFileSync(profileFile, 'utf8'));
    fs.writeFileSync(
      profileFile,
      JSON.stringify({ ...profile, role: 'admin' }),
    );

    await openMaintenance();

    const response = await proxy(request('/', cookie));
    expect(response.headers.get('x-middleware-next')).toBe('1');
  });

  it('обычный пользователь — нет', async () => {
    const { cookie } = await registerAs('maint-user');
    await openMaintenance();

    const response = await proxy(request('/', cookie));
    expect(response.headers.get('x-middleware-rewrite') ?? '').toContain(
      '/maintenance',
    );
  });
});
