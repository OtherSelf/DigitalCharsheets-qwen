'use client';

import { Mail } from 'lucide-react';

import { AppFrame } from '@/components/layout/app-frame';
import { NarrativeMarkdown } from '@/components/sheets/narrative-markdown';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { useTranslation } from '@/context/language-context';

/**
 * ─── LANDMARK: TERMS PAGE (/terms) ─────────────────────────────────────────
 * Публичное пользовательское соглашение: без логина, в текущей локали, в том
 * же каркасе, что политика. Версия печатается страницей из константы — она же
 * пишется в журнал согласий, поэтому расходиться не должна.
 */
export function TermsView({
  version,
  contactEmail,
  terms,
}: {
  version: string;
  contactEmail: string;
  terms: Record<'en' | 'ru', string>;
}) {
  const { language, t } = useTranslation();

  return (
    <AppFrame variant="document" header={{ authAction: 'login' }}>
      <div className="mx-auto max-w-3xl space-y-6">
        <header className="space-y-3">
          <h1 className="font-headline text-2xl font-bold tracking-tight text-balance md:text-3xl">
            {t('terms.title')}
          </h1>
          <p className="text-muted-foreground flex flex-wrap items-center gap-x-2 gap-y-1 text-sm">
            <span data-testid="terms-version">
              {t('privacy.revision')}: {version}
            </span>
          </p>
        </header>

        <article data-testid="terms-document">
          <NarrativeMarkdown variant="document" value={terms[language]} />
        </article>

        <Card data-testid="terms-contact">
          <CardHeader>
            <CardTitle className="flex items-center gap-2 text-base">
              <Mail aria-hidden className="h-4 w-4" />
              {t('privacy.contactTitle')}
            </CardTitle>
          </CardHeader>
          <CardContent className="text-muted-foreground space-y-2 text-sm leading-relaxed">
            <p>{t('terms.contactBody')}</p>
            <a
              className="text-primary inline-flex min-h-8 items-center underline underline-offset-2"
              href={`mailto:${contactEmail}`}
            >
              {contactEmail}
            </a>
          </CardContent>
        </Card>
      </div>
    </AppFrame>
  );
}
