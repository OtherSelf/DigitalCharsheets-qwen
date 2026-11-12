'use client';

import * as React from 'react';

import { AlertTriangle } from 'lucide-react';

import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { useTranslation } from '@/context/language-context';

/**
 * ─── LANDMARK: SHEET ERROR BOUNDARY ────────────────────────────────────────
 * Ошибка плагина не должна ронять страницу листа (этап 3, D11): показываем
 * «лист недоступен», а данные остаются доступны через JSON-экспорт — ядро
 * рисует шапку, сайдбар и диалоги независимо от плагина.
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
      </CardContent>
    </Card>
  );

  return <SheetBoundary fallback={fallback}>{children}</SheetBoundary>;
}
