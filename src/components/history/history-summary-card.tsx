'use client';

import type { ReactNode } from 'react';

import { History } from 'lucide-react';

import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from '@/components/ui/card';
import { useTranslation } from '@/context/language-context';
import { formatHistoryDate } from '@/lib/history-labels';
import type { HistoryStorageInfo } from '@/lib/history-types';

/**
 * Сводка истории: заголовок, счётчики ревизий/сессий, самая старая запись,
 * предупреждение о бэкапе и признак обрезки. Одинакова для владельца и
 * гостевой ссылки; отличается только текст-пояснение и наличие действий,
 * которые передаются `children`.
 */
export function HistorySummaryCard({
  totalRevisions,
  totalSessions,
  storage,
  note,
  testId,
  children,
}: {
  totalRevisions: number;
  totalSessions: number;
  storage?: Pick<HistoryStorageInfo, 'oldestAt' | 'truncated'>;
  note: string;
  testId?: string;
  children?: ReactNode;
}) {
  const { t, language } = useTranslation();

  return (
    <Card data-testid={testId}>
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <History className="h-5 w-5" />
          {t('history.title')}
        </CardTitle>
        <CardDescription>{t('history.subtitle')}</CardDescription>
      </CardHeader>
      <CardContent className="space-y-3">
        <div className="flex flex-wrap gap-4 text-sm">
          <span>
            {t('history.totalRevisions')}: <strong>{totalRevisions}</strong>
          </span>
          <span>
            {t('history.totalSessions')}: <strong>{totalSessions}</strong>
          </span>
          {storage?.oldestAt && (
            <span className="text-muted-foreground">
              {t('history.oldestLabel')}:{' '}
              {formatHistoryDate(storage.oldestAt, language, {
                dateStyle: 'medium',
              })}
            </span>
          )}
        </div>
        <p className="text-muted-foreground text-xs">{note}</p>
        {storage?.truncated && (
          <p className="text-xs text-amber-700 dark:text-amber-300">
            {t('history.truncatedNotice')}
          </p>
        )}
        {children}
      </CardContent>
    </Card>
  );
}
