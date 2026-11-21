// src/components/layout/app-version.tsx

'use client';

import { useTranslation } from '@/context/language-context';
import { formatVersionLabel, useAppVersion } from '@/lib/use-app-version';

/**
 * ─── LANDMARK: APP_VERSION_FOOTER ───────────────────────────────────────────
 * Строка «v0.5.1 · a077aef» в подвале меню профиля (над «Выйти»), на /login
 * и /demo: по ней видно, какая сборка запущена, не открывая терминал.
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

export function AppVersion() {
  const { t } = useTranslation();
  const info = useAppVersion();

  if (!info) return null;

  const label = formatVersionLabel(info);
  const version = `v${info.version}`;
  // Ветка, полный commit и дата сборки — только в подсказке: в самой строке
  // они превратили бы её в шум. Ветка помогает отличить dev-копию из `.git`
  // от сборки из образа, где её нет.
  const details = [version, info.branch, info.commit, info.buildDate]
    .filter(Boolean)
    .join(' · ');
  return (
    <p
      className="text-muted-foreground/70 px-2 pt-1 pb-1.5 font-mono text-[10px] leading-none tracking-tight tabular-nums"
      title={details}
      data-testid="app-version"
    >
      <span className="sr-only">{t('common.appVersion')}: </span>
      {label}
    </p>
  );
}
