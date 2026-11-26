import type { Metadata } from 'next';
import { notFound } from 'next/navigation';

import { getInstanceConfig } from '@/lib/config';
import { buildPrivacyPolicy, PRIVACY_VERSION } from '@/lib/legal/privacy';

import { PrivacyView } from './privacy-view';

export const metadata: Metadata = {
  title: 'Privacy policy — Digital Character Sheets',
  description:
    'How this instance processes personal data: what is stored, why, for how long and how to exercise your rights.',
};

/**
 * `/privacy` — политика инстанса. Текст собирается здесь: реквизиты оператора,
 * контакт и хостинг берутся из `dcs.config.json`, а собранные строки уходят в
 * клиентский компонент готовыми.
 *
 * Выключенная политика (`legal.privacy.enabled=false`) отдаёт 404: инстансу
 * «для своих» страница не нужна, но тогда и чекбокс с гейтом отключаются —
 * см. `PublicInstanceConfig`.
 */
export default function PrivacyPage() {
  const config = getInstanceConfig();
  if (!config.legal.privacy.enabled) notFound();

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
    <PrivacyView
      version={PRIVACY_VERSION}
      registryNumber={config.legal.operator.registryNumber}
      contactEmail={config.legal.operator.contactEmail}
      policy={{
        en: buildPrivacyPolicy('en', context),
        ru: buildPrivacyPolicy('ru', context),
      }}
    />
  );
}
