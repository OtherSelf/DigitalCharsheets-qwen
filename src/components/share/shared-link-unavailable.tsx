'use client';

import { UnavailableState } from '@/components/unavailable-state';
import { useTranslation } from '@/context/language-context';

/**
 * Единый экран недействительной гостевой ссылки. Next отдаёт оболочку
 * страницы потоком ещё до того, как серверный компонент успевает вызвать
 * `notFound()`, поэтому HTTP-статус может остаться 200; важно, что листа и
 * uid в ответе нет, а экран одинаков для «нет токена / истёк / отозван».
 */
export function SharedLinkUnavailable() {
  const { t } = useTranslation();

  return (
    <UnavailableState
      testId="shared-link-unavailable"
      title={t('share.invalidTitle')}
      description={t('share.invalidDesc')}
    />
  );
}
