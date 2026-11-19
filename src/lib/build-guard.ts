// src/lib/build-guard.ts

/**
 * ─── LANDMARK: BUILD GUARD ──────────────────────────────────────────────────
 * Чистое решение сторожа сборки: что делать вкладке, когда `/api/version`
 * вернул id, отличный от того, с которым вкладка загрузилась.
 *
 * Ни DOM, ни React, ни таймеров: правила («не терять правки», «не чаще раза в
 * 10 минут», «после баннера ждём клика») — это и есть поведение, которое
 * легче всего сломать, правя компонент, поэтому оно живёт отдельно и
 * покрывается таблицей unit-тестов. `build-watcher.tsx` только исполняет
 * решение.
 */

/** Интервал опроса: dev-стенд перезапускается часто, прод — заметно реже. */
export const BUILD_CHECK_INTERVAL_MS = {
  development: 15_000,
  production: 60_000,
} as const;

/** Авто-перезагрузка не чаще этого интервала: иначе сломанный сервер = цикл. */
export const AUTO_RELOAD_COOLDOWN_MS = 10 * 60_000;

/**
 * На сколько jitter может сократить интервал. Только вниз: обещание
 * «вкладка замечает новый сервер за ≤ 15 с / ≤ 60 с» должно оставаться правдой.
 */
export const JITTER_RATIO = 0.2;

export type BuildAction = 'same' | 'wait' | 'banner' | 'reload';

export interface BuildDecisionInput {
  /** id, с которым загружена вкладка; `null` — базовый id ещё не известен. */
  ownId: string | null;
  /** id из ответа `/api/version`; `null` — ответ без id (старый сервер, мусор). */
  serverId: string | null;
  /** Открыт редактор поля листа: авто-перезагрузка запрещена. */
  dirty: boolean;
  now: number;
  /** Когда вкладка последний раз перезагружалась сама; `null` — ни разу. */
  lastAutoReloadAt: number | null;
  cooldownMs?: number;
}

/**
 * `same` — ничего не делать; `wait` — сравнивать не с чем, базу возьмём из
 * этого ответа; `banner` — показать баннер и ждать клика; `reload` —
 * перезагрузить вкладку (только когда сохранено всё и cooldown истёк).
 */
export function decideBuildAction(input: BuildDecisionInput): BuildAction {
  if (!input.serverId) return 'wait';
  if (!input.ownId) return 'wait';
  if (input.ownId === input.serverId) return 'same';
  if (input.dirty) return 'banner';

  const cooldown = input.cooldownMs ?? AUTO_RELOAD_COOLDOWN_MS;
  if (
    input.lastAutoReloadAt !== null &&
    input.now - input.lastAutoReloadAt < cooldown
  ) {
    return 'banner';
  }

  return 'reload';
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
