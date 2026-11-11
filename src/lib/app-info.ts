import packageJson from '../../package.json';

/**
 * ─── LANDMARK: APP INFO ─────────────────────────────────────────────────────
 * Общие данные для /api/version и /api/health.
 *
 * `commit`/`buildDate` приходят из окружения сборки/деплоя, а не угадываются:
 * без них поля просто `null`. Версия берётся из package.json, имя — из
 * человекочитаемой константы (`package.json.name` — машинное kebab-case имя,
 * для UI и публичного API оно не подходит).
 */
export const APP_NAME = 'Digital Character Sheets';
export const APP_VERSION = packageJson.version;

export interface AppInfo {
  name: string;
  version: string;
  commit: string | null;
  buildDate: string | null;
  runtime: { node: string };
}

function firstNonEmpty(...values: (string | undefined)[]): string | null {
  for (const value of values) {
    if (typeof value === 'string' && value.trim() !== '') return value.trim();
  }
  return null;
}

export function getAppInfo(): AppInfo {
  return {
    name: APP_NAME,
    version: APP_VERSION,
    commit: firstNonEmpty(
      process.env.DCS_GIT_COMMIT,
      process.env.GIT_COMMIT,
      process.env.VERCEL_GIT_COMMIT_SHA,
    ),
    buildDate: firstNonEmpty(process.env.DCS_BUILD_DATE),
    runtime: { node: process.version },
  };
}
