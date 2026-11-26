'use client';

import { Mail } from 'lucide-react';

import { AppFrame } from '@/components/layout/app-frame';
import { NarrativeMarkdown } from '@/components/sheets/narrative-markdown';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { useTranslation } from '@/context/language-context';

/**
 * ─── LANDMARK: PRIVACY PAGE (/privacy) ─────────────────────────────────────
 * Публичная политика обработки персональных данных: без логина, в текущей
 * локали, в общем каркасе (шапка с переключателем языка + подвал).
 *
 * Заголовок и версия — до текста, а не внутри markdown: версия обязана
 * совпадать со строкой в `data/consents.jsonl`, поэтому её печатает страница
 * из той же константы, а не автор текста. Текст и реквизиты приходят пропсами
 * с сервера: конфиг инстанса в браузер не попадает.
 */
export function PrivacyView({
  version,
  registryNumber,
  contactEmail,
  policy,
}: {
  version: string;
  registryNumber: string;
  contactEmail: string;
  policy: Record<'en' | 'ru', string>;
}) {
  const { language, t } = useTranslation();

  return (
    <AppFrame variant="document" header={{ authAction: 'login' }}>
      <div className="mx-auto max-w-3xl space-y-6">
        <header className="space-y-3">
          <h1 className="font-headline text-2xl font-bold tracking-tight text-balance md:text-3xl">
            {t('privacy.title')}
          </h1>
          <p className="text-muted-foreground flex flex-wrap items-center gap-x-2 gap-y-1 text-sm">
            <span data-testid="privacy-version">
              {t('privacy.revision')}: {version}
            </span>
            {registryNumber && (
              <>
                <span aria-hidden>·</span>
                <span data-testid="privacy-registry">
                  {t('privacy.registry')}: {registryNumber}
                </span>
              </>
            )}
          </p>
        </header>

        <article data-testid="privacy-policy">
          <NarrativeMarkdown variant="document" value={policy[language]} />
        </article>

        <Card data-testid="privacy-contact">
          <CardHeader>
            <CardTitle className="flex items-center gap-2 text-base">
              <Mail aria-hidden className="h-4 w-4" />
              {t('privacy.contactTitle')}
            </CardTitle>
          </CardHeader>
          <CardContent className="text-muted-foreground space-y-2 text-sm leading-relaxed">
            <p>{t('privacy.contactBody')}</p>
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
