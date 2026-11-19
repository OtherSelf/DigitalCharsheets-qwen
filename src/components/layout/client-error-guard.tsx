// src/components/layout/client-error-guard.tsx

'use client';

import { useCallback, useEffect, useRef, useState } from 'react';

import { useCharacterContext } from '@/context/character-context';
import { useTranslation } from '@/context/language-context';
import { isChunkLoadError } from '@/lib/chunk-error';
import { flushWithTimeout } from '@/lib/flush-with-timeout';
import {
  canAutoReload,
  CHUNK_RECOVERY_COOLDOWN_MS,
  readLastReloadAt,
  rememberReload,
} from '@/lib/page-reload';

import { UpdateBanner } from './update-banner';

/**
 * ─── LANDMARK: CLIENT ERROR GUARD ───────────────────────────────────────────
 * Ошибку загрузки чанка не всегда ловит React: динамический `import()` может
 * вылететь в `window` мимо границ ошибок (и в dev-режиме Turbopack так и
 * делает после рестарта сервера). Здесь последняя линия: слушаем `error` и
 * `unhandledrejection`, и если это наш чанк — действуем по тому же правилу,
 * что и сторож сборки: сначала флаш сохранений, потом одна тихая
 * перезагрузка; не дождались или есть правки — баннер с кнопкой.
 */

/** Потолок ожидания флаша: сервер может быть уже недоступен. */
const FLUSH_TIMEOUT_MS = 5_000;

export function ClientErrorGuard() {
  const { flushSaves, hasUnsavedChanges } = useCharacterContext();
  const { t } = useTranslation();
  const [needsReload, setNeedsReload] = useState(false);
  const [clicked, setClicked] = useState(false);
  const [blocked, setBlocked] = useState(false);

  const dirtyRef = useRef(hasUnsavedChanges);
  const flushRef = useRef(flushSaves);
  const busyRef = useRef(false);

  useEffect(() => {
    dirtyRef.current = hasUnsavedChanges;
  }, [hasUnsavedChanges]);

  useEffect(() => {
    flushRef.current = flushSaves;
  }, [flushSaves]);

  useEffect(() => {
    let disposed = false;

    const handle = async (error: unknown) => {
      if (disposed || busyRef.current) return;
      if (!isChunkLoadError(error)) return;

      busyRef.current = true;
      const flushed = await flushWithTimeout(
        flushRef.current,
        FLUSH_TIMEOUT_MS,
      );
      if (disposed) return;

      const dirty = !flushed || dirtyRef.current;
      const now = Date.now();
      if (
        dirty ||
        !canAutoReload(now, readLastReloadAt(), CHUNK_RECOVERY_COOLDOWN_MS)
      ) {
        busyRef.current = false;
        setNeedsReload(true);
        return;
      }

      rememberReload(now);
      window.location.reload();
    };

    const onError = (event: ErrorEvent) => {
      // Ресурсные ошибки (`event.error === null`) приходят со строкой в поле
      // message; для распознавания чанка этого достаточно.
      void handle(event.error ?? event.message);
    };
    const onRejection = (event: PromiseRejectionEvent) => {
      void handle(event.reason);
    };

    window.addEventListener('error', onError);
    window.addEventListener('unhandledrejection', onRejection);

    return () => {
      disposed = true;
      window.removeEventListener('error', onError);
      window.removeEventListener('unhandledrejection', onRejection);
    };
  }, []);

  const reloadNow = useCallback(() => {
    setClicked(true);
    // Клик — согласие пользователя: перезагружаемся сразу, очередь досылает
    // beforeunload/pagehide с keepalive (см. character-context).
    rememberReload(Date.now());
    window.location.reload();
  }, []);

  if (!needsReload) return null;

  return (
    <UpdateBanner
      testId="chunk-error-banner"
      label={blocked ? t('common.updateBlocked') : t('common.reloadRequired')}
      action={clicked ? t('common.updating') : t('common.reloadPage')}
      onAction={reloadNow}
      busy={clicked}
    />
  );
}
