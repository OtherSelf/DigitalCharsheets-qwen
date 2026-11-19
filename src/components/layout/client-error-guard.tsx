// src/components/layout/client-error-guard.tsx

'use client';

import { useEffect, useState } from 'react';

import { useTranslation } from '@/context/language-context';
import { isChunkLoadError } from '@/lib/chunk-error';

import { UpdateBanner } from './update-banner';

/**
 * ─── LANDMARK: CLIENT ERROR GUARD ───────────────────────────────────────────
 * Ошибку загрузки чанка не всегда ловит React: динамический `import()` может
 * вылететь в `window` мимо границ ошибок (в dev-режиме Turbopack так и делает
 * после рестарта сервера). Здесь последняя линия: слушаем `error` и
 * `unhandledrejection` и на чанк-ошибку показываем тот же баннер, что и сторож
 * сборки. Перезагрузку пользователь делает сам — данные в вкладке не теряем.
 */
export function ClientErrorGuard() {
  const { t } = useTranslation();
  const [failed, setFailed] = useState(false);

  useEffect(() => {
    let disposed = false;

    const handle = (error: unknown) => {
      if (disposed) return;
      if (!isChunkLoadError(error)) return;
      setFailed(true);
    };

    const onError = (event: ErrorEvent) => {
      handle(event.error ?? event.message);
    };
    const onRejection = (event: PromiseRejectionEvent) => {
      handle(event.reason);
    };

    window.addEventListener('error', onError);
    window.addEventListener('unhandledrejection', onRejection);

    return () => {
      disposed = true;
      window.removeEventListener('error', onError);
      window.removeEventListener('unhandledrejection', onRejection);
    };
  }, []);

  if (!failed) return null;

  return (
    <UpdateBanner
      testId="chunk-error-banner"
      label={t('common.updateAvailable')}
    />
  );
}
