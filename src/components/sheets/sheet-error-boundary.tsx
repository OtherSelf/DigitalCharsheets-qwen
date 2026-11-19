'use client';

import * as React from 'react';

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
 * ─── LANDMARK: SHEET ERROR BOUNDARY ────────────────────────────────────────
 * Ошибка плагина не должна ронять страницу листа (этап 3, D11): показываем
 * «лист недоступен», а данные остаются доступны через JSON-экспорт — ядро
 * рисует шапку, сайдбар и диалоги независимо от плагина.
 *
 * Отдельный случай — ошибка загрузки чанка: лист не сломан, вкладка просто
 * ссылается на удалённые после деплоя файлы. Тогда один раз перезагружаемся
 * сами (cooldown общий с `build-watcher.tsx`), а если нельзя — карточка с
 * «Повторить» (перемонтирование плагина) и «Обновить страницу».
 *
 * Классовый компонент — единственный способ поймать ошибку рендера в React;
 * тексты берём из i18n через функциональную обёртку.
 */
export class SheetBoundary extends React.Component<
  { fallback: React.ReactNode; children: React.ReactNode },
  { hasError: boolean }
> {
  state = { hasError: false };

  static getDerivedStateFromError(_error: unknown) {
    return { hasError: true };
  }

  componentDidCatch(error: unknown) {
    // Не глотаем ошибку молча: она видна в консоли и в отчёте мониторинга.
    console.error('[sheet] plugin render failed:', error);

    if (!isChunkLoadError(error)) return;

    const now = Date.now();
    if (!canAutoReload(now, readLastReloadAt(), CHUNK_RECOVERY_COOLDOWN_MS))
      return;
    rememberReload(now);
    window.location.reload();
  }

  render() {
    if (this.state.hasError) return this.props.fallback;
    return this.props.children;
  }
}

export function SheetErrorBoundary({
  children,
  systemId,
}: {
  children: React.ReactNode;
  systemId?: string;
}) {
  const { t } = useTranslation();
  const [attempt, setAttempt] = React.useState(0);

  const fallback = (
    <Card data-testid="sheet-unavailable">
      <CardHeader>
        <CardTitle className="flex items-center gap-2 text-base">
          <AlertTriangle className="text-destructive h-5 w-5" />
          {t('common.sheetUnavailable')}
        </CardTitle>
      </CardHeader>
      <CardContent className="text-muted-foreground space-y-2 text-sm">
        <p>{t('common.sheetUnavailableHint')}</p>
        {systemId && (
          <p className="font-mono text-xs">
            <span data-testid="sheet-unavailable-system">{`systemId: ${systemId}`}</span>
          </p>
        )}
        <div className="flex flex-wrap gap-2 pt-1">
          <Button
            size="sm"
            variant="outline"
            onClick={() => setAttempt((value) => value + 1)}
          >
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
      </CardContent>
    </Card>
  );

  return (
    <SheetBoundary key={attempt} fallback={fallback}>
      {children}
    </SheetBoundary>
  );
}
