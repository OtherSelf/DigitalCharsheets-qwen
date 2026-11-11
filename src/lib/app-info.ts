import packageJson from '../../package.json';

/**
 * ─── LANDMARK: APP INFO ─────────────────────────────────────────────────────
 * Общие данные для /api/version и /api/health.
 *
 * `commit`/`buildDate` приходят из окружения сборки/деплоя, а не угадываются:
 * без них поля просто `null`. Версия берётся из package.json, имя — из
 * человекочитаемой константы (`package.json.name` — машинное kebab-case имя,
 * для UI и публичного API оно не подходит).
 *
 * `commitShort` — та же строка, но в виде, который можно показать человеку
 * («v0.1.0 · a077aef»). Обрезка живёт здесь, а не в UI: иначе каждый
 * потребитель обрезал бы по-своему, а `VERCEL_GIT_COMMIT_SHA` (40 символов)
 * и локальный `git rev-parse --short` (7) давали разные значения.
 */
export const APP_NAME = 'Digital Character Sheets';
export const APP_VERSION = packageJson.version;

/** Длина короткого commit — как у `git rev-parse --short` (7 символов). */
export const SHORT_COMMIT_LENGTH = 7;

export interface AppInfo {
  name: string;
  version: string;
  commit: string | null;
  /** Первые 7 символов `commit` в нижнем регистре; `null`, если commit нет. */
  commitShort: string | null;
  buildDate: string | null;
  runtime: { node: string };
}

function firstNonEmpty(...values: (string | undefined)[]): string | null {
  for (const value of values) {
    if (typeof value === 'string' && value.trim() !== '') return value.trim();
  }
  return null;
}

/**
 * Короткий commit для UI. SHA регистронезависим, поэтому приводим к нижнему
 * регистру: `VERCEL_GIT_COMMIT_SHA` приходит в верхнем, и в интерфейсе
 * `A077AEF` рядом с `a077aef` из терминала выглядел бы как разные сборки.
 */
export function shortenCommit(commit: string | null): string | null {
  if (!commit) return null;
  return commit.slice(0, SHORT_COMMIT_LENGTH).toLowerCase();
}

export function getAppInfo(): AppInfo {
  const commit = firstNonEmpty(
    process.env.DCS_GIT_COMMIT,
    process.env.GIT_COMMIT,
    process.env.VERCEL_GIT_COMMIT_SHA,
  );

  return {
    name: APP_NAME,
    version: APP_VERSION,
    commit,
    commitShort: shortenCommit(commit),
    buildDate: firstNonEmpty(process.env.DCS_BUILD_DATE),
    runtime: { node: process.version },
  };
}
