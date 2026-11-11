import { NextResponse } from 'next/server';

import { getAppInfo } from '@/lib/app-info';

/**
 * ─── LANDMARK: VERSION ──────────────────────────────────────────────────────
 * GET /api/version — версия приложения и данные сборки.
 *
 * Без авторизации и без секретов: имя, SemVer из package.json, commit и дата
 * сборки из окружения (если заданы) и версия Node. Список зависимостей и
 * пути намеренно не отдаём.
 *
 * `commit`/`buildDate` задаются через DCS_GIT_COMMIT/DCS_BUILD_DATE (или
 * GIT_COMMIT/VERCEL_GIT_COMMIT_SHA для commit). Если переменных нет — null.
 */
export const dynamic = 'force-dynamic';

export function GET() {
  return NextResponse.json(getAppInfo(), {
    headers: { 'Cache-Control': 'public, max-age=300' },
  });
}
