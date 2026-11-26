import type { Metadata } from 'next';
import { notFound } from 'next/navigation';

import { getInstanceConfig } from '@/lib/config';
import { buildTerms, TERMS_VERSION } from '@/lib/legal/terms';

import { TermsView } from './terms-view';

export const metadata: Metadata = {
  title: 'Terms of use — Digital Character Sheets',
  description:
    'Conditions of use for this instance: account, your content, liability, suspension and applicable law.',
};

/**
 * `/terms` — пользовательское соглашение (публичная оферта). Текст собирается
 * на сервере из `dcs.config.json`: реквизиты оператора и контакт в браузер не
 * попадают.
 *
 * Выключенное соглашение (`legal.terms.enabled=false`) отдаёт 404: инстанс без
 * регистрации может жить без него, но тогда и чекбокс на форме не ссылается на
 * соглашение — см. `PublicInstanceConfig`.
 */
export default function TermsPage() {
  const config = getInstanceConfig();
  if (!config.legal.terms.enabled) notFound();

  const context = {
    operatorName: config.legal.operator.name,
    postalAddress: config.legal.operator.postalAddress,
    contactEmail: config.legal.operator.contactEmail,
    registryNumber: config.legal.operator.registryNumber,
    hostingProvider: config.hosting.provider,
    hostingCountry: config.hosting.country,
    ageMinimum: config.legal.ageMinimum,
  };

  return (
    <TermsView
      version={TERMS_VERSION}
      contactEmail={config.legal.operator.contactEmail}
      terms={{
        en: buildTerms('en', context),
        ru: buildTerms('ru', context),
      }}
    />
  );
}
