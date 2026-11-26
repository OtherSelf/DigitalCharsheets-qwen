// src/components/about/about-view.tsx
'use client';

import Link from 'next/link';

import { AppFrame } from '@/components/layout/app-frame';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { useTranslation } from '@/context/language-context';

/**
 * ─── LANDMARK: ABOUT PAGE (/about) ─────────────────────────────────────────
 * Публичная страница «О проекте»: без логина, в текущей локали, с футером.
 * Тексты — краткие, но по делу: стек, версия, лицензия, где лежат данные,
 * что проект не affiliated с правообладателями.
 */
const REPOSITORY_URL =
  'https://github.com/digitalcharsheets/digital-character-sheets';
const CHANGELOG_URL = `${REPOSITORY_URL}/blob/main/CHANGELOG.md`;

const external = {
  target: '_blank',
  rel: 'noopener noreferrer',
} as const;

export function AboutView() {
  const { t } = useTranslation();

  const blocks: Array<{ title: string; body: string }> = [
    { title: t('about.whatTitle'), body: t('about.whatBody') },
    { title: t('about.stackTitle'), body: t('about.stackBody') },
    { title: t('about.privacyTitle'), body: t('about.privacyBody') },
    { title: t('about.creditsTitle'), body: t('about.creditsBody') },
    { title: t('about.disclaimerTitle'), body: t('about.disclaimerBody') },
  ];

  return (
    <AppFrame variant="document" header={{ authAction: 'login' }}>
      <div className="mx-auto max-w-3xl space-y-6">
        <div className="space-y-2">
          <h1 className="font-headline text-2xl font-bold tracking-tight md:text-3xl">
            {t('about.title')}
          </h1>
          <p className="text-muted-foreground">{t('about.subtitle')}</p>
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
            <CardTitle className="text-base">{t('about.linksTitle')}</CardTitle>
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
              href={CHANGELOG_URL}
              {...external}
            >
              CHANGELOG
            </a>
            <span aria-hidden>·</span>
            <Link className="underline underline-offset-2" href="/privacy">
              {t('footer.privacy')}
            </Link>
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
    </AppFrame>
  );
}
