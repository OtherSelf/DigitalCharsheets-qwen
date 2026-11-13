'use client';

import { History } from 'lucide-react';

import { SessionCard } from '@/components/history/history-view';
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from '@/components/ui/card';
import { useTranslation } from '@/context/language-context';
import type { GameHistoryConfig } from '@/games/types';
import { formatHistoryDate } from '@/lib/history-labels';
import type { SharedHistoryPage } from '@/lib/history-types';

/**
 * Гостевая история: тот же таймлайн, что у владельца, но без очистки,
 * пагинации и ссылок в кабинет. Данные уже урезаны и очищены сервером;
 * компонент ничего не запрашивает и не мутирует.
 */
export function SharedHistoryView({
  history,
  historyConfig,
}: {
  history: SharedHistoryPage;
  historyConfig?: GameHistoryConfig;
}) {
  const { t, language } = useTranslation();

  return (
    <div className="space-y-4">
      <Card data-testid="shared-history">
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
              {t('history.totalRevisions')}:{' '}
              <strong>{history.totalRevisions}</strong>
            </span>
            <span>
              {t('history.totalSessions')}:{' '}
              <strong>{history.totalSessions}</strong>
            </span>
            {history.storage.oldestAt && (
              <span className="text-muted-foreground">
                {t('history.oldestLabel')}:{' '}
                {formatHistoryDate(history.storage.oldestAt, language, {
                  dateStyle: 'medium',
                })}
              </span>
            )}
          </div>
          <p className="text-muted-foreground text-xs">
            {t('share.historyReadOnly')}
          </p>
          {history.storage.truncated && (
            <p className="text-xs text-amber-700 dark:text-amber-300">
              {t('history.truncatedNotice')}
            </p>
          )}
        </CardContent>
      </Card>

      {history.sessions.length === 0 ? (
        <Card data-testid="shared-history-empty">
          <CardHeader>
            <CardTitle className="text-base">{t('history.empty')}</CardTitle>
            <CardDescription>{t('history.emptyHint')}</CardDescription>
          </CardHeader>
        </Card>
      ) : (
        history.sessions.map((session) => (
          <SessionCard
            key={session.id}
            session={session}
            historyConfig={historyConfig}
          />
        ))
      )}
    </div>
  );
}
