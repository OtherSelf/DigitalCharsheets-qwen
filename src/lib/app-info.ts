import { randomUUID } from 'node:crypto';
import fs from 'node:fs';
import path from 'node:path';

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
  /**
   * Идентификатор запущенной сборки: клиент сравнивает его со своим, чтобы
   * понять, что сервер теперь другой (`build-watcher.tsx`).
   */
  buildId: string;
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

/**
 * ─── LANDMARK: BUILD ID ─────────────────────────────────────────────────────
 * `buildId` — идентификатор запущенной сборки, а не версии из package.json:
 * версия меняется раз в релиз, а сравнение нужно на каждый деплой и рестарт.
 *
 * В production это `NEXT_DEPLOYMENT_ID`: его выставляет сам `next start` из
 * `deploymentId` в next.config, а там значение берётся из `DCS_GIT_COMMIT` или
 * `.git` (один и тот же id у сборки и у рантайма). Если `deploymentId` не
 * задан — образ без `.git` и без env — остаётся `.next/BUILD_ID`: он уникален
 * для каждой сборки, и этого достаточно.
 *
 * В dev сравнивать нечего, кроме рестарта процесса, поэтому id случайный и
 * живёт в `globalThis`: переживает HMR-переоценку модулей, но не рестарт.
 */
interface BootScope {
  __dcsBootId?: string;
}

function bootId(): string {
  const scope = globalThis as typeof globalThis & BootScope;
  scope.__dcsBootId ??= randomUUID();
  return scope.__dcsBootId;
}

function buildIdFromDisk(cwd: string): string | null {
  try {
    const value = fs
      .readFileSync(path.join(cwd, '.next', 'BUILD_ID'), 'utf8')
      .trim();
    return value === '' ? null : value;
  } catch {
    return null;
  }
}

/**
 * Id сборки. Файл `.next/BUILD_ID` читается на каждый вызов: это несколько
 * микросекунд, зато значение не кешируется в модуле и не расходится с текущим
 * содержимым диска (тесты подменяют `cwd`).
 */
export function getBuildId(options: AppInfoOptions = {}): string {
  if (process.env.NODE_ENV !== 'production') return bootId();
  return (
    firstNonEmpty(process.env.NEXT_DEPLOYMENT_ID) ??
    buildIdFromDisk(options.cwd ?? process.cwd()) ??
    bootId()
  );
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
    buildId: getBuildId(options),
    runtime: { node: process.version },
  };
}
