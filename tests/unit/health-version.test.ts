import path from 'node:path';

import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

import { GET as healthRoute } from '@/app/api/health/route';
import { GET as versionRoute } from '@/app/api/version/route';
import { APP_NAME, APP_VERSION, shortenCommit } from '@/lib/app-info';

import { removeDir, useTempDataDir } from './helpers';

/**
 * /api/health и /api/version.
 *
 * Покрыто: 200/503 и вид проверок health, отсутствие путей/секретов в ответе,
 * no-store; версия/имя/commit/buildDate/commitShort/runtime и короткий кэш
 * version. Data-dir — временный каталог, реальные данные не трогаются.
 */
let dataDir: string;

beforeEach(() => {
  dataDir = useTempDataDir();
});

afterEach(() => {
  vi.unstubAllEnvs();
  delete process.env.DCS_DATA_DIR;
  removeDir(dataDir);
});

describe('GET /api/health', () => {
  it('200 и ok, когда data-dir доступен на запись', async () => {
    const response = healthRoute();
    expect(response.status).toBe(200);
    expect(response.headers.get('cache-control')).toContain('no-store');

    const body = await response.json();
    expect(body).toMatchObject({
      status: 'ok',
      version: APP_VERSION,
      checks: { dataDir: 'ok' },
    });
    expect(Number.isInteger(body.uptime)).toBe(true);
    expect(body.uptime).toBeGreaterThanOrEqual(0);
    expect(Number.isNaN(Date.parse(body.timestamp))).toBe(false);

    // Пробник не должен раскрывать путь к data-dir.
    expect(JSON.stringify(body)).not.toContain(dataDir);
  });

  it('503 и degraded, когда data-dir недоступен', async () => {
    process.env.DCS_DATA_DIR = path.join(dataDir, 'missing-data-dir');

    const response = healthRoute();
    expect(response.status).toBe(503);
    expect(response.headers.get('cache-control')).toContain('no-store');

    const body = await response.json();
    expect(body).toMatchObject({
      status: 'degraded',
      version: APP_VERSION,
      checks: { dataDir: 'error' },
    });
    expect(JSON.stringify(body)).not.toContain(dataDir);
    expect(JSON.stringify(body)).not.toContain('missing-data-dir');
  });
});

describe('GET /api/version', () => {
  it('отдаёт имя, версию, commit/buildDate, commitShort и runtime', async () => {
    // Полный SHA в верхнем регистре — как приходит VERCEL_GIT_COMMIT_SHA:
    // в ответе commit остаётся как есть, а commitShort уже обрезан и в нижнем.
    const sha = 'A077AEF1234567890ABCDEF1234567890ABCDEF';
    vi.stubEnv('DCS_GIT_COMMIT', sha);
    vi.stubEnv('DCS_BUILD_DATE', '2026-01-01T00:00:00.000Z');

    const response = versionRoute();
    expect(response.status).toBe(200);
    expect(response.headers.get('cache-control')).toContain('max-age=300');

    const body = await response.json();
    expect(body).toEqual({
      name: APP_NAME,
      version: APP_VERSION,
      commit: sha,
      commitShort: 'a077aef',
      buildDate: '2026-01-01T00:00:00.000Z',
      runtime: { node: process.version },
    });
    expect(JSON.stringify(body)).not.toContain(dataDir);
  });

  it('не выдумывает commit/buildDate/commitShort, если переменные пусты', async () => {
    vi.stubEnv('DCS_GIT_COMMIT', '');
    vi.stubEnv('GIT_COMMIT', '');
    vi.stubEnv('VERCEL_GIT_COMMIT_SHA', '');
    vi.stubEnv('DCS_BUILD_DATE', '');

    const body = await versionRoute().json();
    expect(body.commit).toBeNull();
    expect(body.commitShort).toBeNull();
    expect(body.buildDate).toBeNull();
  });
});

describe('shortenCommit', () => {
  it('обрезает до 7 символов и приводит к нижнему регистру', () => {
    expect(shortenCommit('A077AEF1234567890ABCDEF')).toBe('a077aef');
    // Короткий commit не трогаем — меняется только регистр.
    expect(shortenCommit('a077aef')).toBe('a077aef');
    expect(shortenCommit(null)).toBeNull();
  });
});
