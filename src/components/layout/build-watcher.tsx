// src/components/layout/build-watcher.tsx

'use client';

import { useEffect, useState } from 'react';

import { useTranslation } from '@/context/language-context';
import {
  buildCheckInterval,
  decideBuildAction,
  nextPollDelay,
  readBuildId,
} from '@/lib/build-guard';

import { UpdateBanner } from './update-banner';

/**
 * ─── LANDMARK: BUILD WATCHER ────────────────────────────────────────────────
 * Вкладка, пережившая деплой или рестарт стенда, узнаёт об этом сама: опрос
 * `/api/version` сравнивает id запущенной сборки со своим (он пришёл пропом из
 * серверного layout, а не из `data-dpl-id` — тот Next удаляет до гидратации).
 *
 * Дальше только баннер: «приложение обновилось, сохраните изменения и
 * обновите страницу». Никаких программных перезагрузок — во вкладке бывает
 * несохранённый ввод, а `beforeunload` всё равно отменит переход.
 *
 * Почему опрос, а не `deploymentId` сам по себе: framework навигирует жёстко
 * только на переходах, а простаивающая вкладка так и осталась бы со старым
 * интерфейсом. Почему `?t=` и `no-store`: ответ публичного эндпоинта кешируется
 * и браузером, и возможным прокси.
 */
export function BuildWatcher({ ownBuildId }: { ownBuildId: string }) {
  const { t } = useTranslation();
  const [stale, setStale] = useState(false);

  useEffect(() => {
    let disposed = false;
    let timer: ReturnType<typeof setTimeout> | null = null;
    // Без пропа (старый сервер) база берётся из первого ответа API.
    let ownId = ownBuildId === '' ? null : ownBuildId;

    const check = async () => {
      if (disposed) return;
      if (document.visibilityState === 'hidden') return;

      let payload: unknown = null;
      try {
        const response = await fetch(`/api/version?t=${Date.now()}`, {
          cache: 'no-store',
        });
        if (!response.ok) return;
        payload = await response.json();
      } catch {
        // Сервер как раз перезапускается — просто дождёмся следующего опроса.
        return;
      }

      const serverId = readBuildId(payload);
      const action = decideBuildAction({ ownId, serverId });

      if (action === 'wait') {
        if (serverId) ownId = serverId;
        return;
      }

      if (!disposed) setStale(action === 'banner');
    };

    const schedule = () => {
      if (disposed) return;
      timer = setTimeout(
        () => {
          void check().finally(schedule);
        },
        nextPollDelay(buildCheckInterval(process.env.NODE_ENV)),
      );
    };

    const checkNow = () => {
      void check();
    };
    const onVisibilityChange = () => {
      if (document.visibilityState === 'visible') checkNow();
    };

    void check().finally(schedule);
    document.addEventListener('visibilitychange', onVisibilityChange);
    window.addEventListener('online', checkNow);
    window.addEventListener('focus', checkNow);

    return () => {
      disposed = true;
      if (timer) clearTimeout(timer);
      document.removeEventListener('visibilitychange', onVisibilityChange);
      window.removeEventListener('online', checkNow);
      window.removeEventListener('focus', checkNow);
    };
  }, [ownBuildId]);

  if (!stale) return null;

  return (
    <UpdateBanner
      testId="build-update-banner"
      label={t('common.updateAvailable')}
    />
  );
}
