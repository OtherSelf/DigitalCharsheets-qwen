import fs from 'fs';

import { NextResponse } from 'next/server';

import { getAppInfo } from '@/lib/app-info';
import { getDataDir } from '@/lib/data-dir';

/**
 * ─── LANDMARK: HEALTH ───────────────────────────────────────────────────────
 * GET /api/health — liveness/readiness для Docker, reverse proxy и мониторинга.
 *
 * Без авторизации: пробники не умеют логиниться. Отдаём только минимум:
 * статус, версию, uptime, время и результат проверки data-dir. Пути, тексты
 * ошибок и секреты наружу не попадают.
 *
 * 200 — всё в порядке; 503 — data-dir отсутствует или недоступен на запись.
 * Ответ не кэшируется.
 */
export const dynamic = 'force-dynamic';

function checkDataDir(): 'ok' | 'error' {
  try {
    // accessSync проверяет и существование, и права; каталог не создаём —
    // healthcheck не должен иметь побочных эффектов.
    fs.accessSync(getDataDir(), fs.constants.W_OK);
    return 'ok';
  } catch {
    return 'error';
  }
}

export function GET() {
  const checks = { dataDir: checkDataDir() };
  const healthy = checks.dataDir === 'ok';
  const info = getAppInfo();

  return NextResponse.json(
    {
      status: healthy ? 'ok' : 'degraded',
      version: info.version,
      uptime: Math.round(process.uptime()),
      timestamp: new Date().toISOString(),
      checks,
    },
    {
      status: healthy ? 200 : 503,
      headers: { 'Cache-Control': 'no-store' },
    },
  );
}
