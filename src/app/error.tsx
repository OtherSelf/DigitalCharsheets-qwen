// src/app/error.tsx

'use client';

import { useEffect } from 'react';

import { AlertTriangle } from 'lucide-react';

import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { useTranslation } from '@/context/language-context';
import { isChunkLoadError } from '@/lib/chunk-error';
import {
  canAutoReload,
  CHUNK_RECOVERY_COOLDOWN_MS,
  readLastReloadAt,
  rememberReload,
} from '@/lib/page-reload';

/**
 * ─── LANDMARK: APP ERROR BOUNDARY ───────────────────────────────────────────
 * Ошибка сегмента (страница не отрендерилась) не должна превращаться в белую
 * страницу Next с английским текстом. Корневой layout остаётся смонтированным,
 * поэтому провайдеры и i18n здесь доступны.
 *
 * Ошибка загрузки чанка — отдельный случай: это не баг страницы, а расхождение
 * вкладки с сервером после деплоя, поэтому один раз перезагружаемся сами
 * (cooldown — общий с `build-watcher.tsx`). Дальше и до бесконечности — только
 * кнопки: «Повторить» и «Обновить страницу».
 */
export default function AppError({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  const { t } = useTranslation();
  const chunkError = isChunkLoadError(error);

  useEffect(() => {
    // Не глотаем ошибку: она нужна в консоли и в отчёте мониторинга.
    console.error('[app] segment failed:', error);

    if (!chunkError) return;
    const now = Date.now();
    if (!canAutoReload(now, readLastReloadAt(), CHUNK_RECOVERY_COOLDOWN_MS))
      return;
    rememberReload(now);
    window.location.reload();
  }, [chunkError, error]);

  return (
    <main className="mx-auto flex min-h-[60vh] w-full max-w-2xl items-center p-4">
      <Card className="w-full" data-testid="app-error">
        <CardHeader>
          <CardTitle className="flex items-center gap-2 text-base">
            <AlertTriangle className="text-destructive h-5 w-5" />
            {t('common.error')}
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-3 text-sm">
          <p className="text-muted-foreground">{t('common.errorHint')}</p>
          <div className="flex flex-wrap gap-2">
            <Button size="sm" onClick={reset}>
              {t('common.retry')}
            </Button>
            <Button
              size="sm"
              variant="outline"
              onClick={() => {
                rememberReload(Date.now());
                window.location.reload();
              }}
            >
              {t('common.reloadPage')}
            </Button>
          </div>
          {error.digest && (
            <p className="text-muted-foreground/70 font-mono text-xs">
              {`digest: ${error.digest}`}
            </p>
          )}
        </CardContent>
      </Card>
    </main>
  );
}
