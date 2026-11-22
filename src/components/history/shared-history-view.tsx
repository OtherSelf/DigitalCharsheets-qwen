'use client';

import { HistorySummaryCard } from '@/components/history/history-summary-card';
import { SessionCard } from '@/components/history/history-view';
import {
  Card,
  CardDescription,
  CardHeader,
  CardTitle,
} from '@/components/ui/card';
import { useTranslation } from '@/context/language-context';
import type { GameHistoryConfig } from '@/games/types';
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
  const { t } = useTranslation();

  return (
    <div className="space-y-4">
      <HistorySummaryCard
        totalRevisions={history.totalRevisions}
        totalSessions={history.totalSessions}
        storage={history.storage}
        note={t('share.historyReadOnly')}
        testId="shared-history"
      />

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
