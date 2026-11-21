'use client';

import { useEffect, useState } from 'react';

/**
 * ─── LANDMARK: USE_APP_VERSION ──────────────────────────────────────────────
 * Данные сборки для подписи: версия, короткий commit, ветка, дата.
 *
 * Источник ровно один — `GET /api/version` (`src/lib/app-info.ts`). Дублировать
 * версию в клиентский бандл через `NEXT_PUBLIC_*` нельзя: после обновления без
 * пересборки клиента подпись разошлась бы с API, а короткий commit приходит
 * только оттуда.
 *
 * Запрос один на вкладку: `cached` — уже полученный ответ, `inflight` — тот же
 * промис для параллельных подписчиков (подпись нужна и меню, и футеру). Плюс
 * HTTP-кэш самого роута (`Cache-Control: public, max-age=300`).
 *
 * Пока данных нет (первый кадр, офлайн, 500) — `null`: подпись не должна
 * прыгать, а «v» без номера хуже пустого места.
 */
export interface AppVersionInfo {
  version: string;
  commit: string | null;
  commitShort: string | null;
  branch: string | null;
  buildDate: string | null;
}

let cached: AppVersionInfo | null = null;
let inflight: Promise<AppVersionInfo | null> | null = null;

function nonEmptyString(value: unknown): string | null {
  return typeof value === 'string' && value.trim() !== '' ? value.trim() : null;
}

/** Ответ API — внешние данные, поэтому поля проверяются, а не приводятся. */
function pickVersionInfo(raw: unknown): AppVersionInfo | null {
  if (!raw || typeof raw !== 'object') return null;

  const data = raw as Record<string, unknown>;
  const version = nonEmptyString(data.version);
  if (!version) return null;

  return {
    version,
    commit: nonEmptyString(data.commit),
    commitShort: nonEmptyString(data.commitShort),
    branch: nonEmptyString(data.branch),
    buildDate: nonEmptyString(data.buildDate),
  };
}

/** Один запрос на вкладку; ошибки не кэшируем — следующий вызов повторит. */
function loadVersionInfo(): Promise<AppVersionInfo | null> {
  if (cached) return Promise.resolve(cached);

  if (!inflight) {
    inflight = fetch('/api/version')
      .then((response) => (response.ok ? response.json() : null))
      .then((data) => {
        const info = pickVersionInfo(data);
        if (info) cached = info;
        return info;
      })
      .catch(() => null)
      .finally(() => {
        inflight = null;
      });
  }

  return inflight;
}

export function useAppVersion(): AppVersionInfo | null {
  const [info, setInfo] = useState<AppVersionInfo | null>(cached);

  useEffect(() => {
    if (cached) {
      setInfo(cached);
      return;
    }
    let active = true;
    void loadVersionInfo().then((data) => {
      if (active && data) setInfo(data);
    });
    return () => {
      active = false;
    };
  }, []);

  return info;
}

/** Подпись «v0.5.1 · a077aef» — одна на меню, логин и футер. */
export function formatVersionLabel(info: AppVersionInfo): string {
  const version = `v${info.version}`;
  // commitShort приходит из API; запасной вариант — старый сервер без поля.
  const short =
    info.commitShort ?? info.commit?.slice(0, 7).toLowerCase() ?? null;
  return short ? `${version} · ${short}` : version;
}
