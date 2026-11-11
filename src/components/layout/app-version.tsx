// src/components/layout/app-version.tsx

'use client';

import { useEffect, useState } from 'react';

import { useTranslation } from '@/context/language-context';

/**
 * ─── LANDMARK: APP_VERSION_FOOTER ───────────────────────────────────────────
 * Строка «v0.1.0 · a077aef» в подвале меню профиля (над «Выйти»).
 *
 * Источник ровно один — `GET /api/version` (`src/lib/app-info.ts`). Дублировать
 * версию в клиентский бандл через `NEXT_PUBLIC_*` нельзя: после обновления без
 * пересборки клиента подпись разошлась бы с API, а короткий commit приходит
 * только оттуда.
 *
 * Запрос один на вкладку: `cached` — уже полученный ответ, `inflight` — тот же
 * промис для параллельных подписчиков (шапка живёт на всех страницах). Плюс
 * HTTP-кэш самого роута (`Cache-Control: public, max-age=300`).
 *
 * Пока данных нет (первый кадр, офлайн, 500) — не рендерим ничего: пункт меню
 * не должен прыгать, а «v» без номера хуже, чем пустое место.
 */

interface VersionInfo {
  version: string;
  commit: string | null;
  commitShort: string | null;
  buildDate: string | null;
}

let cached: VersionInfo | null = null;
let inflight: Promise<VersionInfo | null> | null = null;

function nonEmptyString(value: unknown): string | null {
  return typeof value === 'string' && value.trim() !== '' ? value.trim() : null;
}

/**
 * Достаём только то, что нужно подписи. Ответ API — внешние данные, поэтому
 * поля проверяются, а не приводятся через `as`.
 */
function pickVersionInfo(raw: unknown): VersionInfo | null {
  if (!raw || typeof raw !== 'object') return null;

  const data = raw as Record<string, unknown>;
  const version = nonEmptyString(data.version);
  if (!version) return null;

  return {
    version,
    commit: nonEmptyString(data.commit),
    commitShort: nonEmptyString(data.commitShort),
    buildDate: nonEmptyString(data.buildDate),
  };
}

/** Один запрос на вкладку; ошибки не кэшируем — следующий вызов повторит. */
function loadVersionInfo(): Promise<VersionInfo | null> {
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

export function AppVersion() {
  const { t } = useTranslation();
  const [info, setInfo] = useState<VersionInfo | null>(null);

  useEffect(() => {
    let active = true;

    void loadVersionInfo().then((data) => {
      if (active && data) setInfo(data);
    });

    return () => {
      active = false;
    };
  }, []);

  if (!info) return null;

  const version = `v${info.version}`;
  // commitShort приходит из API; запасной вариант — на случай старого сервера
  // без поля, чтобы подпись не потускнела до одной версии.
  const short =
    info.commitShort ?? info.commit?.slice(0, 7).toLowerCase() ?? null;
  const label = short ? `${version} · ${short}` : version;
  // Полный commit и дата сборки — только в подсказке: в самой строке они
  // превратили бы её в шум.
  const details = [version, info.commit, info.buildDate]
    .filter(Boolean)
    .join(' · ');

  return (
    <p
      className="text-muted-foreground/70 px-2 pt-1 pb-1.5 font-mono text-[10px] leading-none tracking-tight tabular-nums"
      title={details}
    >
      <span className="sr-only">{t('common.appVersion')}: </span>
      {label}
    </p>
  );
}
