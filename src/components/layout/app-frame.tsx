'use client';

import type { ComponentProps, ReactNode } from 'react';

import { Header } from '@/components/header';
import { SiteFooter } from '@/components/layout/site-footer';
import { useTranslation } from '@/context/language-context';
import { cn } from '@/lib/utils';

const MAIN_CLASS = {
  default:
    'safe-area-bottom flex flex-1 flex-col overflow-y-auto p-3 sm:p-4 md:p-6 lg:p-8 [&>*]:w-full [&>*]:min-w-0',
  wide: 'safe-area-bottom flex flex-1 flex-col overflow-y-auto p-4 md:p-8 [&>*]:w-full [&>*]:min-w-0',
  compact:
    'safe-area-bottom flex flex-1 flex-col overflow-y-auto p-4 [&>*]:w-full [&>*]:min-w-0',
  stats:
    'safe-area-bottom flex flex-1 flex-col overflow-y-auto p-4 md:p-6 lg:p-8 [&>*]:w-full [&>*]:min-w-0',
  sheet:
    'flex flex-1 flex-col overflow-y-auto p-4 md:p-6 lg:p-8 [&>*]:w-full [&>*]:min-w-0',
  centered: 'safe-area-bottom flex flex-1 items-center justify-center',
  plain: 'flex flex-1 flex-col p-4 md:p-6 [&>*]:w-full [&>*]:min-w-0',
  document: 'safe-area-bottom flex-1 overflow-y-auto p-4 md:p-8',
  demo: 'safe-area-bottom flex flex-1 flex-col overflow-y-auto px-4 py-8 pb-20 [&>*]:w-full [&>*]:min-w-0',
} as const;

export type AppFrameVariant = keyof typeof MAIN_CLASS;

/**
 * Отрицательные поля подвала: он живёт внутри `main` (страницы скроллят свой
 * контейнер, поэтому футер не может быть отдельной полосой под ним), а
 * `main` несёт горизонтальные отступы варианта. Без компенсации линия футера
 * обрывалась на отступе, тогда как линия шапки идёт от края до края.
 */
const FOOTER_BLEED: Record<AppFrameVariant, string> = {
  default: '-mx-3 sm:-mx-4 md:-mx-6 lg:-mx-8',
  wide: '-mx-4 md:-mx-8',
  compact: '-mx-4',
  stats: '-mx-4 md:-mx-6 lg:-mx-8',
  sheet: '-mx-4 md:-mx-6 lg:-mx-8',
  centered: '',
  plain: '-mx-4 md:-mx-6',
  document: '-mx-4 md:-mx-8',
  demo: '-mx-4',
};

/**
 * ─── LANDMARK: APP FRAME ────────────────────────────────────────────────────
 * Единый каркас страниц ядра: `h-dvh` + `Header` + `main` + `SiteFooter`.
 * Варианты (`wide`, `compact`, `centered`, `sheet`, `plain`, `document`,
 * `demo`) задают только отступы/скролл; рейл и особые обёртки передаются
 * пропсами. `skip-link` ведёт на `main`, футер всегда внутри него — так
 * страница не дублирует landmark-порядок и `main`-классы.
 */
export function AppFrame({
  header,
  variant = 'default',
  className,
  mainClassName,
  children,
  sidebar,
  after,
  footer = true,
}: {
  /** Пропсы `Header`; сам `Header` рендерится только здесь. */
  header: ComponentProps<typeof Header>;
  variant?: AppFrameVariant;
  className?: string;
  mainClassName?: string;
  children: ReactNode;
  /** Рейл листа (компактная навигация) слева от `main`. */
  sidebar?: ReactNode;
  /** Оверлеи/диалоги после `main`, но внутри каркаса. */
  after?: ReactNode;
  footer?: boolean;
}) {
  const { t } = useTranslation();
  const content = (
    <div className="mx-auto flex w-full max-w-[var(--content-max)] flex-1 flex-col [&>*]:w-full [&>*]:min-w-0">
      {children}
    </div>
  );
  const main = (
    <main id="main-content" className={cn(MAIN_CLASS[variant], mainClassName)}>
      {/*
        Ограничение ширины не нужно центрированным экранам (`centered`:
        логин/восстановление) — там сама карточка узкая, а лишний flex-контейнер
        ломал вертикальное центрирование.
      */}
      {variant === 'centered' ? (
        <>
          {children}
          {footer && <SiteFooter />}
        </>
      ) : (
        <>
          {content}
          {/*
            Подвал — вне колонки контента: там он получал `w-full` колонки, и
            отрицательные поля только сдвигали линию, не растягивая её до края.
          */}
          {footer && (
            <div className="mt-auto shrink-0">
              {/*
                Отрицательные поля — на вложенном блоке, а не на самом
                флекс-элементе: `[&>*]:w-full` у `main` задаёт ширину
                элементу явно, и на нём поля только сдвигали бы линию.
              */}
              <div className={cn(FOOTER_BLEED[variant])}>
                <SiteFooter />
              </div>
            </div>
          )}
        </>
      )}
    </main>
  );

  return (
    <div className={cn('flex h-dvh flex-col', className)}>
      <a
        href="#main-content"
        className="focus:bg-background focus:text-foreground focus:ring-ring sr-only focus:not-sr-only focus:absolute focus:top-2 focus:left-2 focus:z-50 focus:rounded focus:px-3 focus:py-2 focus:text-sm focus:ring-2"
      >
        {t('common.skipToContent')}
      </a>
      <Header {...header} />
      {sidebar ? (
        <div className="flex flex-1 overflow-hidden">
          {sidebar}
          {main}
        </div>
      ) : (
        main
      )}
      {after}
    </div>
  );
}
