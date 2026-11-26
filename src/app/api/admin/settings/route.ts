import { NextResponse } from 'next/server';

import { requireAdmin } from '@/lib/admin-auth';
import { jsonError } from '@/lib/api/respond';
import { readAuthJson } from '@/lib/security/payload';
import {
  readSiteSettings,
  resetSiteSettingsCache,
  siteSettingsSchema,
  writeSiteSettings,
} from '@/lib/site-settings';

/**
 * ─── LANDMARK: ADMIN SITE SETTINGS ─────────────────────────────────────────
 * GET/PUT `/api/admin/settings` — переключатели инстанса, которые меняются без
 * рестарта: регистрация, вход только для админов и тестеров, режим
 * обслуживания.
 *
 * Доступ — активному админу. `PUT` принимает полный объект: частичное
 * обновление здесь опаснее, чем удобнее, — случайно присланный `{}` не должен
 * включать регистрацию обратно.
 *
 * Статусы: 401 — нет сессии; 403 — не админ; 400 — невалидный объект;
 * 200 — { success, settings }.
 */
export async function GET(request: Request) {
  const auth = await requireAdmin(request);
  if (!auth.ok) return auth.response;

  return NextResponse.json({
    success: true,
    settings: await readSiteSettings(),
  });
}

export async function PUT(request: Request) {
  const auth = await requireAdmin(request);
  if (!auth.ok) return auth.response;

  const parsedBody = await readAuthJson(request);
  if (!parsedBody.ok) {
    return jsonError(parsedBody.status, parsedBody.error, parsedBody.reason);
  }

  const parsed = siteSettingsSchema.safeParse(parsedBody.body);
  if (!parsed.success) {
    return jsonError(400, 'Invalid settings payload.', 'invalid_settings');
  }

  await writeSiteSettings(parsed.data);
  // Тумблер должен действовать сразу, а кэш чтения живёт секунду.
  resetSiteSettingsCache();

  return NextResponse.json({ success: true, settings: parsed.data });
}
