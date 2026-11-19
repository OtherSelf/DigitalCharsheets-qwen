// src/components/layout/build-watcher.tsx

'use client';

import { useCallback, useEffect, useRef, useState } from 'react';

import { useCharacterContext } from '@/context/character-context';
import { useTranslation } from '@/context/language-context';
import {
  buildCheckInterval,
  decideBuildAction,
  nextPollDelay,
  readBuildId,
} from '@/lib/build-guard';
import { flushWithTimeout } from '@/lib/flush-with-timeout';
import { readLastReloadAt, rememberReload } from '@/lib/page-reload';

import { UpdateBanner } from './update-banner';

/**
 * ─── LANDMARK: BUILD WATCHER ────────────────────────────────────────────────
 * Вкладка, пережившая деплой или рестарт стенда, узнаёт об этом сама: опрос
 * `/api/version` сравнивает id запущенной сборки со своим (он пришёл пропом из
 * серверного layout, а не из `data-dpl-id` — тот Next удаляет до гидратации).
 *
 * Решение «перезагружать или нет» принимает `src/lib/build-guard.ts`, здесь
 * только таймеры, fetch и исполнение: сохранено всё и cooldown истёк — тихая
 * перезагрузка; есть несохранённое, идёт флаш или недавно уже перезагружались —
 * баннер, который перезагружает по клику (осознанное согласие пользователя).
 *
 * Почему опрос, а не `deploymentId` сам по себе: framework навигирует жёстко
 * только на переходах, а простаивающая вкладка так и осталась бы со старым
 * интерфейсом. Почему `?t=` и `no-store`: ответ публичного эндпоинта кешируется
 * и браузером, и возможным прокси.
 */

/**
 * Потолок ожидания флаша: сервер как раз перезапускается, и очередь
 * сохранений может висеть. Не дождались — считаем состояние несохранённым.
 */
const FLUSH_TIMEOUT_MS = 5_000;

export function BuildWatcher({ ownBuildId }: { ownBuildId: string }) {
  const { flushSaves, hasUnsavedChanges } = useCharacterContext();
  const { t } = useTranslation();
  const [pendingId, setPendingId] = useState<string | null>(null);

  // Рефы, чтобы таймер не пересоздавался на каждый рендер контекста.
  const dirtyRef = useRef(hasUnsavedChanges);
  const pendingRef = useRef<string | null>(null);
  const lastReloadRef = useRef<number | null>(null);
  const flushRef = useRef(flushSaves);

  useEffect(() => {
    dirtyRef.current = hasUnsavedChanges;
  }, [hasUnsavedChanges]);

  useEffect(() => {
    flushRef.current = flushSaves;
  }, [flushSaves]);

  const showPending = useCallback((id: string | null) => {
    pendingRef.current = id;
    setPendingId(id);
  }, []);

  const reloadNow = useCallback(async () => {
    // Клик — согласие пользователя: досылаем очередь и перезагружаемся, даже
    // если поле осталось в режиме правки (тогда сработает нативный beforeunload).
    await flushWithTimeout(flushRef.current, FLUSH_TIMEOUT_MS);
    rememberReload(Date.now());
    window.location.reload();
  }, []);

  useEffect(() => {
    lastReloadRef.current = readLastReloadAt();

    let disposed = false;
    let reloading = false;
    let timer: ReturnType<typeof setTimeout> | null = null;
    // Без пропа (старый сервер) база берётся из первого ответа API.
    let ownId = ownBuildId === '' ? null : ownBuildId;

    const check = async () => {
      if (disposed || reloading) return;
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
      if (serverId && !ownId) {
        ownId = serverId;
        return;
      }

      const action = decideBuildAction({
        ownId,
        serverId,
        dirty: dirtyRef.current || pendingRef.current !== null,
        now: Date.now(),
        lastAutoReloadAt: lastReloadRef.current,
      });

      if (action === 'same') {
        if (pendingRef.current !== null) showPending(null);
        return;
      }

      if (action === 'banner') {
        if (serverId) showPending(serverId);
        return;
      }

      if (action !== 'reload') return;

      reloading = true;
      const flushed = await flushWithTimeout(
        flushRef.current,
        FLUSH_TIMEOUT_MS,
      );
      if (disposed) return;

      if (!flushed || dirtyRef.current) {
        reloading = false;
        if (serverId) showPending(serverId);
        return;
      }

      rememberReload(Date.now());
      window.location.reload();
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
  }, [ownBuildId, showPending]);

  if (!pendingId) return null;

  return (
    <UpdateBanner
      testId="build-update-banner"
      label={t('common.updateAvailable')}
      action={t('common.updateNow')}
      onAction={() => void reloadNow()}
    />
  );
}
