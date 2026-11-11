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
 * `commitShort` — первые 7 символов commit в нижнем регистре, ровно та форма,
 * которую показывает меню профиля (`v0.1.0 · a077aef`); без commit — null.
 */
export const dynamic = 'force-dynamic';

export function GET() {
  return NextResponse.json(getAppInfo(), {
    headers: { 'Cache-Control': 'public, max-age=300' },
  });
}
