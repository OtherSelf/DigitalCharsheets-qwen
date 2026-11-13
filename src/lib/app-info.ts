import packageJson from '../../package.json';
import { getGitCheckoutInfo } from './git-commit';

/**
 * ─── LANDMARK: APP INFO ─────────────────────────────────────────────────────
 * Общие данные для /api/version и /api/health.
 *
 * `commit`/`branch` берутся из окружения сборки/деплоя (`DCS_GIT_COMMIT`,
 * `GIT_COMMIT`, `VERCEL_GIT_COMMIT_SHA`), а если переменных нет — из `.git`
 * рядом с приложением: при запуске из рабочей копии версия называет свой
 * коммит сама, без обвязки в деплой-скрипте. В Docker-образе `.git` нет, и
 * поведение прежнее: коммит остаётся `null`.
 *
 * `commitShort` — та же строка в виде, который можно показать человеку
 * («v0.5.1 · a077aef»). Обрезка живёт здесь, а не в UI: иначе каждый
 * потребитель обрезал бы по-своему, а `VERCEL_GIT_COMMIT_SHA` (40 символов) и
 * локальный SHA (полный) давали разные значения.
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
  /** Имя ветки; `null` — detached HEAD, env без ветки или не клон. */
  branch: string | null;
  buildDate: string | null;
  runtime: { node: string };
}

export interface AppInfoOptions {
  /** Каталог, от которого искать `.git` (тесты). По умолчанию `process.cwd()`. */
  cwd?: string;
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

export function getAppInfo(options: AppInfoOptions = {}): AppInfo {
  const fromEnv = firstNonEmpty(
    process.env.DCS_GIT_COMMIT,
    process.env.GIT_COMMIT,
    process.env.VERCEL_GIT_COMMIT_SHA,
  );
  const branchFromEnv = firstNonEmpty(
    process.env.DCS_GIT_BRANCH,
    process.env.GIT_BRANCH,
    process.env.VERCEL_GIT_COMMIT_REF,
  );

  // `.git` читаем только если окружение не дало коммит: в образе без `.git`
  // это лишний обход дерева на первый запрос.
  const checkout = fromEnv
    ? null
    : getGitCheckoutInfo(options.cwd ?? process.cwd());

  const commit = fromEnv ?? checkout?.commit ?? null;

  return {
    name: APP_NAME,
    version: APP_VERSION,
    commit,
    commitShort: shortenCommit(commit),
    branch: branchFromEnv ?? checkout?.branch ?? null,
    buildDate: firstNonEmpty(process.env.DCS_BUILD_DATE),
    runtime: { node: process.version },
  };
}
