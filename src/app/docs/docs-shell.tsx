'use client';

import type { Root as PageTreeRoot } from 'fumadocs-core/page-tree';
import { DocsLayout } from 'fumadocs-ui/layouts/docs';
import { RootProvider } from 'fumadocs-ui/provider/next';

import { useTranslation } from '@/context/language-context';
import { docsUiTranslations } from '@/lib/docs/ui-translations';

import { DocsSearchDialog } from './docs-search-dialog';

/**
 * Клиентская часть оболочки `/docs`.
 *
 * Язык интерфейса выбирается на клиенте (`LanguageProvider` читает
 * localStorage), поэтому подписи Fumadocs нельзя собрать в серверном layout —
 * они формируются здесь из нашего словаря.
 *
 * `theme.enabled: false` — вторая тема не нужна: `ThemeProvider` приложения уже
 * навешивает класс `dark` на `<html>`, а вложенный провайдер `next-themes`
 * перебивал бы выбор пользователя.
 */
export function DocsLayoutShell({
  tree,
  children,
}: Readonly<{ tree: PageTreeRoot; children: React.ReactNode }>) {
  const { t, tUnsafe, language } = useTranslation();

  return (
    <RootProvider
      theme={{ enabled: false }}
      i18n={{ locale: language, translations: docsUiTranslations(tUnsafe) }}
      search={{ SearchDialog: DocsSearchDialog }}
    >
      <div className="docs-scroll bg-fd-background text-fd-foreground">
        <DocsLayout
          tree={tree}
          themeSwitch={{ enabled: false }}
          nav={{ title: t('docs.title'), url: '/docs' }}
        >
          {children}
        </DocsLayout>
      </div>
    </RootProvider>
  );
}
