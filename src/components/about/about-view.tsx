// src/components/about/about-view.tsx
'use client';

import Link from 'next/link';

import { Header } from '@/components/header';
import { SiteFooter } from '@/components/layout/site-footer';
import { Badge } from '@/components/ui/badge';
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from '@/components/ui/card';
import { useTranslation } from '@/context/language-context';
import { formatVersionLabel, useAppVersion } from '@/lib/use-app-version';

/**
 * ─── LANDMARK: ABOUT PAGE (/about) ─────────────────────────────────────────
 * Публичная страница «О проекте»: без логина, в текущей локали, с футером.
 * Тексты — краткие, но по делу: стек, версия, лицензия, где лежат данные,
 * что проект не affiliated с правообладателями.
 */
const REPOSITORY_URL = 'https://github.com/OtherSelf/DigitalCharsheets-qwen';
const CHANGELOG_URL = `${REPOSITORY_URL}/blob/main/CHANGELOG.md`;
const LICENSE_URL = `${REPOSITORY_URL}/blob/main/LICENSE`;
const ISSUES_URL = `${REPOSITORY_URL}/issues`;

const external = {
  target: '_blank',
  rel: 'noopener noreferrer',
} as const;

export function AboutView() {
  const { t } = useTranslation();
  const info = useAppVersion();

  const blocks: Array<{ title: string; body: string }> = [
    { title: t('about.whatTitle'), body: t('about.whatBody') },
    { title: t('about.stackTitle'), body: t('about.stackBody') },
    { title: t('about.privacyTitle'), body: t('about.privacyBody') },
    { title: t('about.disclaimerTitle'), body: t('about.disclaimerBody') },
  ];

  return (
    <div className="flex h-dvh flex-col">
      <Header authAction="login" />

      <main className="safe-area-bottom flex-1 overflow-y-auto p-4 md:p-8">
        <div className="mx-auto max-w-3xl space-y-6">
          <div className="space-y-2">
            <h1 className="font-headline text-2xl font-bold tracking-tight md:text-3xl">
              {t('about.title')}
            </h1>
            <p className="text-muted-foreground">{t('about.subtitle')}</p>
            <div className="flex flex-wrap items-center gap-2 pt-1">
              <Badge variant="outline">MIT</Badge>
              {info && (
                <Badge variant="secondary" data-testid="about-version">
                  {formatVersionLabel(info)}
                </Badge>
              )}
            </div>
          </div>

          {blocks.map((block) => (
            <Card key={block.title}>
              <CardHeader>
                <CardTitle className="text-base">{block.title}</CardTitle>
              </CardHeader>
              <CardContent>
                <p className="text-muted-foreground text-sm leading-relaxed">
                  {block.body}
                </p>
              </CardContent>
            </Card>
          ))}

          <Card>
            <CardHeader>
              <CardTitle className="text-base">
                {t('about.linksTitle')}
              </CardTitle>
              <CardDescription>{t('about.linksBody')}</CardDescription>
            </CardHeader>
            <CardContent className="flex flex-wrap gap-2 text-sm">
              <Link className="underline underline-offset-2" href="/docs">
                {t('about.docs')}
              </Link>
              <span aria-hidden>·</span>
              <a className="underline underline-offset-2" href="/api/docs">
                {t('about.api')}
              </a>
              <span aria-hidden>·</span>
              <a
                className="underline underline-offset-2"
                href={REPOSITORY_URL}
                {...external}
              >
                {t('footer.repository')}
              </a>
              <span aria-hidden>·</span>
              <a
                className="underline underline-offset-2"
                href={CHANGELOG_URL}
                {...external}
              >
                CHANGELOG
              </a>
              <span aria-hidden>·</span>
              <a
                className="underline underline-offset-2"
                href={LICENSE_URL}
                {...external}
              >
                {t('footer.license')}
              </a>
              <span aria-hidden>·</span>
              <a
                className="underline underline-offset-2"
                href={ISSUES_URL}
                {...external}
              >
                {t('about.contacts')}
              </a>
            </CardContent>
          </Card>

          <div className="flex justify-center pt-2">
            <Link
              href="/"
              className="text-muted-foreground text-sm underline underline-offset-2"
            >
              {t('common.backToDashboard')}
            </Link>
          </div>
        </div>
        <SiteFooter />
      </main>
    </div>
  );
}
