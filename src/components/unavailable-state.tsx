'use client';

import Link from 'next/link';

import { AlertTriangle } from 'lucide-react';

import { Header } from '@/components/header';
import { Button } from '@/components/ui/button';
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from '@/components/ui/card';
import { useTranslation } from '@/context/language-context';

/**
 * ─── LANDMARK: UNAVAILABLE STATE ──────────────────────────────────────────
 * Экран вместо бесконечного `app/loading.tsx`: лист не найден или список
 * персонажей не загрузился. Всегда есть выход — «Повторить» (если ошибка
 * сетевая) и «Вернуться на главную». Без этого сбой сети/прокси выглядел как
 * зависшее приложение.
 */
export function UnavailableState({
  testId,
  title,
  description,
  actionLabel,
  onAction,
}: {
  testId: string;
  title: string;
  description: string;
  actionLabel?: string;
  onAction?: () => void;
}) {
  const { t } = useTranslation();

  return (
    <div className="flex h-dvh flex-col">
      <Header backHref="/" />
      <main className="flex flex-1 items-center justify-center p-4 md:p-6">
        <Card className="w-full max-w-md" data-testid={testId}>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <AlertTriangle className="text-destructive h-5 w-5" />
              {title}
            </CardTitle>
            <CardDescription>{description}</CardDescription>
          </CardHeader>
          <CardContent className="flex flex-wrap gap-2">
            {actionLabel && onAction && (
              <Button onClick={onAction}>{actionLabel}</Button>
            )}
            <Button variant="outline" asChild>
              <Link href="/">{t('common.backToDashboard')}</Link>
            </Button>
          </CardContent>
        </Card>
      </main>
    </div>
  );
}
