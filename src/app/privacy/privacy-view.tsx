'use client';

import Link from 'next/link';

import { NarrativeMarkdown } from '@/components/sheets/narrative-markdown';
import { useTranslation } from '@/context/language-context';
import { PRIVACY_POLICY, PRIVACY_VERSION } from '@/lib/legal/privacy';

export function PrivacyView() {
  const { language, t } = useTranslation();

  return (
    <main className="mx-auto w-full max-w-3xl px-4 py-8">
      <div className="text-muted-foreground mb-4 flex flex-wrap items-center gap-3 text-xs">
        <Link className="underline underline-offset-2" href="/">
          {t('privacy.back')}
        </Link>
        <span data-testid="privacy-version">
          {t('privacy.version')}: {PRIVACY_VERSION}
        </span>
      </div>
      <article data-testid="privacy-policy">
        <NarrativeMarkdown value={PRIVACY_POLICY[language]} />
      </article>
    </main>
  );
}
