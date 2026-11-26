import fs from 'node:fs/promises';
import path from 'node:path';

import { z } from 'zod';

import { getDataDir } from '@/lib/data-dir';
import { writeJsonAtomic } from '@/lib/fs-atomic';

/**
 * ─── LANDMARK: SITE SETTINGS ────────────────────────────────────────────────
 * Переключатели, которые админ меняет на живом сайте: регистрация, вход только
 * для админов/тестеров, режим обслуживания. Лежат в data-dir, а не в
 * `dcs.config.json`: конфиг читается один раз на процесс, а тумблер обязан
 * действовать сразу.
 *
 * Файл один и пишется атомарно: приложение и админка читают его без блокировки,
 * а частично записанного JSON не бывает.
 */
export const siteSettingsSchema = z.object({
  registration: z
    .object({
      /** Публичная регистрация новых аккаунтов. */
      open: z.boolean().default(true),
    })
    .default(() => ({ open: true })),
  access: z
    .object({
      /** Вход разрешён только админам и тестерам; остальных не пускаем. */
      loginRestrictedToStaff: z.boolean().default(false),
      /** Сайт в обслуживании: страницы закрыты для всех, кроме админов. */
      maintenance: z.boolean().default(false),
    })
    .default(() => ({ loginRestrictedToStaff: false, maintenance: false })),
});

export type SiteSettings = z.infer<typeof siteSettingsSchema>;

const DEFAULT_SITE_SETTINGS: SiteSettings = {
  registration: { open: true },
  access: { loginRestrictedToStaff: false, maintenance: false },
};

function siteSettingsFile(): string {
  return path.join(getDataDir(), 'site-settings.json');
}

/**
 * Прочитать настройки. Битый или отсутствующий файл — значения по умолчанию:
 * сайт обязан открыться, даже если тумблеры потерялись, а не упасть.
 */
export async function readSiteSettings(): Promise<SiteSettings> {
  try {
    const raw = JSON.parse(await fs.readFile(siteSettingsFile(), 'utf8'));
    const parsed = siteSettingsSchema.safeParse(raw);
    return parsed.success ? parsed.data : DEFAULT_SITE_SETTINGS;
  } catch {
    return DEFAULT_SITE_SETTINGS;
  }
}

/** Записать настройки целиком (админка присылает полный объект). */
export async function writeSiteSettings(next: SiteSettings): Promise<void> {
  await writeJsonAtomic(siteSettingsFile(), siteSettingsSchema.parse(next));
}

/**
 * Кэш на секунду: проксироверка обслуживания спрашивает настройки на каждый
 * запрос страницы, а файл меняется только из админки. Секунда — компромисс:
 * включённое обслуживание доезжает почти мгновенно, чтение с диска не бьёт по
 * каждому рендеру.
 */
const CACHE_TTL_MS = 1_000;
let cache: { at: number; value: SiteSettings } | null = null;

export async function readSiteSettingsCached(
  now = Date.now(),
): Promise<SiteSettings> {
  if (cache && now - cache.at < CACHE_TTL_MS) return cache.value;
  const value = await readSiteSettings();
  cache = { at: now, value };
  return value;
}

/** Сбросить кэш: админка пишет настройки и должна увидеть их сразу. */
export function resetSiteSettingsCache(): void {
  cache = null;
}
