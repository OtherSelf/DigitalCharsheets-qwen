// src/components/layout/site-footer.tsx
'use client';

import Link from 'next/link';

import { useTranslation } from '@/context/language-context';
import {
  formatVersionCommit,
  formatVersionLabel,
  formatVersionNumber,
  useAppVersion,
} from '@/lib/use-app-version';

/**
 * ─── LANDMARK: SITE_FOOTER ──────────────────────────────────────────────────
 * Подвал ядра: версия, короткий commit, ветка (с `md`), репозиторий, лицензия
 * MIT и ссылка на «О проекте». Живёт в потоке в конце `main`, а не в корневом
 * layout: страницы держат `h-dvh` и скроллят свой `main`, поэтому глобальная
 * полоса под `{children}` осталась бы за пределами экрана.
 *
 * Отдельного запроса к API нет: `useAppVersion()` делит кэш с подписью в меню.
 * Пока данных нет, строка версии пустая, а ссылки видны — подвал не прыгает.
 */
const REPOSITORY_URL =
  'https://github.com/digitalcharsheets/digital-character-sheets';
const LICENSE_URL = `${REPOSITORY_URL}/blob/main/LICENSE`;

const linkClass =
  'hover:text-foreground inline-flex min-h-8 items-center whitespace-nowrap underline underline-offset-2';

export function SiteFooter() {
  const { t } = useTranslation();
  const info = useAppVersion();

  const details = info
    ? [formatVersionLabel(info), info.branch, info.commit, info.buildDate]
        .filter(Boolean)
        .join(' · ')
    : '';

  return (
    // Обёртка — flex-элемент страницы: `mt-auto` прижимает футер к низу
    // экрана на короткой странице, а `shrink-0` не даёт ему схлопнуться.
    <div className="mt-auto shrink-0 pt-8">
      <footer
        data-testid="site-footer"
        aria-label={t('footer.label')}
        className="text-muted-foreground border-t px-4 pt-3 pb-4 text-[11px] sm:text-xs"
      >
        <div className="mx-auto flex max-w-3xl flex-wrap items-center justify-center gap-x-1.5 gap-y-1 text-center sm:gap-x-3">
          {info && (
            <span
              className="font-mono text-[11px] tracking-tight tabular-nums"
              title={details}
              data-testid="site-footer-version"
            >
              {formatVersionNumber(info)}
              {/* На телефоне оставляем только номер: с хешем строка ссылок
                  уезжает во вторую строку и «Конфиденциальность» теряется. */}
              {formatVersionCommit(info) && (
                <span className="hidden sm:inline">
                  {' '}
                  · {formatVersionCommit(info)}
                </span>
              )}
            </span>
          )}
          {info?.branch && (
            <span className="hidden md:inline" data-testid="site-footer-branch">
              {info.branch}
            </span>
          )}
          <a
            className={linkClass}
            href={REPOSITORY_URL}
            target="_blank"
            rel="noopener noreferrer"
          >
            {t('footer.repository')}
          </a>
          <a
            className={linkClass}
            href={LICENSE_URL}
            target="_blank"
            rel="noopener noreferrer"
          >
            {t('footer.license')}
          </a>
          <Link className={linkClass} href="/privacy">
            {t('footer.privacy')}
          </Link>
          <Link className={linkClass} href="/about">
            {t('footer.about')}
          </Link>
        </div>
      </footer>
    </div>
  );
}
