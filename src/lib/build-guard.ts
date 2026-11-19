// src/lib/build-guard.ts

/**
 * ─── LANDMARK: BUILD GUARD ──────────────────────────────────────────────────
 * Сравнение id запущенной сборки с ответом `/api/version`. Задача одна:
 * заметить, что сервер теперь другой, и показать баннер. Перезагрузку делает
 * пользователь — вкладка может содержать несохранённый ввод.
 *
 * Ни DOM, ни таймеров: интервалы опроса и разбор ответа проверяются таблицей
 * unit-тестов, а `build-watcher.tsx` только исполняет решение.
 */

/** Интервал опроса: dev-стенд перезапускается часто, прод — заметно реже. */
export const BUILD_CHECK_INTERVAL_MS = {
  development: 15_000,
  production: 60_000,
} as const;

/**
 * На сколько jitter может сократить интервал. Только вниз, чтобы обещание
 * «вкладка замечает новый сервер за ≤ 15 с / ≤ 60 с» оставалось правдой.
 */
export const JITTER_RATIO = 0.2;

export type BuildAction = 'same' | 'wait' | 'banner';

export interface BuildDecisionInput {
  /** id, с которым загружена вкладка; `null` — базовый id ещё не известен. */
  ownId: string | null;
  /** id из ответа `/api/version`; `null` — ответ без id (старый сервер, мусор). */
  serverId: string | null;
}

/**
 * `same` — ничего; `wait` — сравнивать не с чем, базу возьмём из ответа;
 * `banner` — сервер стал другой сборкой, сообщаем пользователю.
 */
export function decideBuildAction(input: BuildDecisionInput): BuildAction {
  if (!input.serverId) return 'wait';
  if (!input.ownId) return 'wait';
  return input.ownId === input.serverId ? 'same' : 'banner';
}

/** Интервал для текущего режима: `NODE_ENV` инлайнится в клиентский бандл. */
export function buildCheckInterval(nodeEnv: string | undefined): number {
  return nodeEnv === 'production'
    ? BUILD_CHECK_INTERVAL_MS.production
    : BUILD_CHECK_INTERVAL_MS.development;
}

/**
 * Задержка следующего опроса: интервал минус до 20 %. Разброс нужен, чтобы
 * десятки вкладок не били в `/api/version` одной волной после деплоя.
 */
export function nextPollDelay(
  intervalMs: number,
  random: () => number = Math.random,
): number {
  const sample = Math.min(Math.max(random(), 0), 1);
  return intervalMs - Math.floor(intervalMs * JITTER_RATIO * sample);
}

/** `buildId` из ответа `/api/version`: ответ — внешние данные, поэтому проверка. */
export function readBuildId(raw: unknown): string | null {
  if (!raw || typeof raw !== 'object') return null;

  const value = (raw as Record<string, unknown>).buildId;
  if (typeof value !== 'string') return null;

  const trimmed = value.trim();
  return trimmed === '' ? null : trimmed;
}
