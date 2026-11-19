// src/app/error.tsx

'use client';

import { AlertTriangle } from 'lucide-react';

import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { useTranslation } from '@/context/language-context';

/**
 * ─── LANDMARK: APP ERROR BOUNDARY ───────────────────────────────────────────
 * Ошибка сегмента (страница не отрендерилась) не должна превращаться в белую
 * страницу Next с английским текстом. Корневой layout остаётся смонтированным,
 * поэтому провайдеры и i18n здесь доступны.
 *
 * Перезагружаем только по кнопке: автоматически этого не делаем, чтобы не
 * потерять несохранённый ввод; «Повторить» перерисовывает сегмент заново.
 */
export default function AppError({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  const { t } = useTranslation();

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
              onClick={() => window.location.reload()}
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
