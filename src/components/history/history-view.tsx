'use client';

import { useEffect, useState } from 'react';
import Link from 'next/link';

import { History, Loader2, Trash2 } from 'lucide-react';

import { Header } from '@/components/header';
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from '@/components/ui/alert-dialog';
import { Button } from '@/components/ui/button';
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from '@/components/ui/card';
import { useTranslation } from '@/context/language-context';
import { getCharacterModule } from '@/games/character-system';
import type { GameHistoryConfig } from '@/games/types';
import {
  formatHistoryDate,
  formatHistoryValue,
  resolveHistoryLabel,
} from '@/lib/history-labels';
import type {
  HistoryChange,
  HistorySession,
  HistoryStorageInfo,
  StoredValue,
} from '@/lib/history-types';
import { characterPath } from '@/lib/routes';
import type { Character } from '@/lib/types';

/**
 * ─── LANDMARK: HISTORY VIEW ─────────────────────────────────────────────────
 * Таймлайн изменений: сессии по 30 минут, подписи полей от плагина, «было →
 * стало». История owner-only и не является бэкапом: экран прямо говорит об
 * этом и не даёт откатить лист.
 *
 * Сначала грузится первая страница (50 сессий); «Показать ещё» идёт по
 * `before`-курсору. Очистка истории необратима и требует подтверждения.
 */
interface HistoryPageResponse {
  sessions: HistorySession[];
  nextCursor: string | null;
  totalSessions: number;
  totalRevisions: number;
  storage: HistoryStorageInfo;
}

const PAGE_SIZE = 50;

function KindBadge({ kind }: { kind: HistoryChange['kind'] }) {
  const { t } = useTranslation();
  const label =
    kind === 'added' || kind === 'array-add'
      ? t('history.added')
      : kind === 'removed' || kind === 'array-remove'
        ? t('history.removed')
        : kind === 'bulk'
          ? t('history.tooManyChanges')
          : t('history.changed');
  const tone =
    kind === 'added' || kind === 'array-add'
      ? 'bg-emerald-100 text-emerald-900 dark:bg-emerald-950 dark:text-emerald-200'
      : kind === 'removed' || kind === 'array-remove'
        ? 'bg-rose-100 text-rose-900 dark:bg-rose-950 dark:text-rose-200'
        : 'bg-muted text-muted-foreground';

  return (
    <span className={`rounded px-1.5 py-0.5 text-[11px] font-medium ${tone}`}>
      {label}
    </span>
  );
}

function ValueText({ label, value }: { label: string; value: StoredValue }) {
  const { t } = useTranslation();
  const text = formatHistoryValue(value);
  const truncated = value.truncated === true;

  return (
    <div className="min-w-0 space-y-1">
      <div className="text-muted-foreground text-[11px] uppercase">{label}</div>
      <pre className="bg-muted/60 max-h-48 overflow-auto rounded p-2 text-xs break-words whitespace-pre-wrap">
        {text || '—'}
      </pre>
      {truncated && (
        <div className="text-muted-foreground text-[11px]">
          {t('history.truncatedValue')}
        </div>
      )}
    </div>
  );
}

function ChangeRow({
  change,
  historyConfig,
}: {
  change: HistoryChange;
  historyConfig?: GameHistoryConfig;
}) {
  const { t } = useTranslation();
  const label = resolveHistoryLabel(change, historyConfig, t);

  return (
    <div data-testid="history-change" className="border-b py-3 last:border-b-0">
      <div className="mb-2 flex flex-wrap items-center gap-2">
        <span className="text-sm font-medium">{label}</span>
        <KindBadge kind={change.kind} />
      </div>

      {change.kind === 'bulk' ? (
        <p className="text-muted-foreground text-xs">
          {t('history.tooManyChanges')}
          {change.count !== undefined ? ` (${change.count})` : ''}
        </p>
      ) : change.kind === 'array-add' || change.kind === 'array-remove' ? (
        <div className="space-y-1">
          <div className="text-muted-foreground text-[11px] uppercase">
            {change.kind === 'array-add'
              ? t('history.arrayAdded')
              : t('history.arrayRemoved')}
          </div>
          <div className="flex flex-wrap gap-1">
            {(change.values ?? []).map((value, index) => (
              <code
                key={index}
                className="bg-muted rounded px-1.5 py-0.5 text-xs"
              >
                {formatHistoryValue(value)}
              </code>
            ))}
          </div>
        </div>
      ) : (
        <div className="grid gap-2 sm:grid-cols-2">
          {change.before !== undefined && (
            <ValueText label={t('history.before')} value={change.before} />
          )}
          {change.after !== undefined && (
            <ValueText label={t('history.after')} value={change.after} />
          )}
        </div>
      )}
    </div>
  );
}

function SessionCard({
  session,
  historyConfig,
}: {
  session: HistorySession;
  historyConfig?: GameHistoryConfig;
}) {
  const { t, language } = useTranslation();

  return (
    <Card data-testid="history-session">
      <CardHeader className="pb-2">
        <CardTitle className="flex flex-wrap items-baseline justify-between gap-2 text-base">
          <span>{formatHistoryDate(session.startedAt, language)}</span>
          <span className="text-muted-foreground text-xs font-normal">
            {t('history.totalRevisions')}: {session.revisionCount}
          </span>
        </CardTitle>
        <CardDescription>
          {formatHistoryDate(session.startedAt, language, {
            timeStyle: 'short',
          })}
          {session.endedAt !== session.startedAt
            ? ` — ${formatHistoryDate(session.endedAt, language, {
                timeStyle: 'short',
              })}`
            : ''}
        </CardDescription>
      </CardHeader>
      <CardContent>
        {session.markers.map((marker, index) => (
          <p
            key={`${marker.source}-${index}`}
            className="text-muted-foreground border-b py-2 text-sm last:border-b-0"
          >
            {marker.source === 'create'
              ? t('history.markerCreated')
              : t('history.markerMigrated')}
          </p>
        ))}
        {session.changes.map((change, index) => (
          <ChangeRow
            key={`${change.path}-${change.key ?? ''}-${change.field ?? ''}-${index}`}
            change={change}
            historyConfig={historyConfig}
          />
        ))}
      </CardContent>
    </Card>
  );
}

export function HistoryView({ character }: { character: Character }) {
  const { t, language } = useTranslation();
  const historyConfig = getCharacterModule(character)?.history;
  const [sessions, setSessions] = useState<HistorySession[]>([]);
  const [cursor, setCursor] = useState<string | null>(null);
  const [totalSessions, setTotalSessions] = useState(0);
  const [totalRevisions, setTotalRevisions] = useState(0);
  const [storage, setStorage] = useState<HistoryStorageInfo | null>(null);
  const [loading, setLoading] = useState(true);
  const [loadingMore, setLoadingMore] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [clearOpen, setClearOpen] = useState(false);
  const [clearing, setClearing] = useState(false);

  const endpoint = `/api/characters/${encodeURIComponent(character.id)}/history`;

  useEffect(() => {
    let active = true;
    void fetch(`${endpoint}?limit=${PAGE_SIZE}`, { cache: 'no-store' })
      .then(async (res) => {
        const body = (await res
          .json()
          .catch(() => null)) as HistoryPageResponse | null;
        if (!res.ok || !body) throw new Error('history_failed');
        if (!active) return;
        setError(null);
        setSessions(body.sessions);
        setCursor(body.nextCursor);
        setTotalSessions(body.totalSessions);
        setTotalRevisions(body.totalRevisions);
        setStorage(body.storage);
      })
      .catch(() => {
        if (active) setError(t('history.loadError'));
      })
      .finally(() => {
        if (active) setLoading(false);
      });

    return () => {
      active = false;
    };
  }, [endpoint, t]);

  const loadMore = async (): Promise<void> => {
    if (!cursor || loadingMore) return;
    setLoadingMore(true);
    setError(null);
    try {
      const res = await fetch(
        `${endpoint}?limit=${PAGE_SIZE}&before=${encodeURIComponent(cursor)}`,
        { cache: 'no-store' },
      );
      const body = (await res
        .json()
        .catch(() => null)) as HistoryPageResponse | null;
      if (!res.ok || !body) throw new Error('history_failed');
      setSessions((previous) => [...previous, ...body.sessions]);
      setCursor(body.nextCursor);
      setTotalSessions(body.totalSessions);
      setTotalRevisions(body.totalRevisions);
      setStorage(body.storage);
    } catch {
      setError(t('history.loadError'));
    } finally {
      setLoadingMore(false);
    }
  };

  const clearHistory = async (): Promise<void> => {
    setClearing(true);
    try {
      const res = await fetch(endpoint, { method: 'DELETE' });
      if (!res.ok) throw new Error('clear_failed');
      setSessions([]);
      setCursor(null);
      setTotalSessions(0);
      setTotalRevisions(0);
      setClearOpen(false);
    } catch {
      setError(t('history.clearError'));
    } finally {
      setClearing(false);
    }
  };

  return (
    <div className="flex h-dvh flex-col">
      <Header backHref={characterPath(character.id)} readOnly />
      <main className="safe-area-bottom flex-1 overflow-y-auto p-3 sm:p-4 md:p-6 lg:p-8">
        <div className="mx-auto max-w-4xl space-y-4" data-testid="history-page">
          <Card>
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
                  <strong>{totalRevisions}</strong>
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
              <p className="text-muted-foreground text-xs">
                {t('history.notBackup')}
              </p>
              {storage?.truncated && (
                <p className="text-xs text-amber-700 dark:text-amber-300">
                  {t('history.truncatedNotice')}
                </p>
              )}
              <div className="flex flex-wrap gap-2">
                <Button asChild variant="outline" size="sm">
                  <Link href={characterPath(character.id)}>
                    {t('history.backToSheet')}
                  </Link>
                </Button>
                {sessions.length > 0 && (
                  <Button
                    type="button"
                    variant="destructive"
                    size="sm"
                    onClick={() => setClearOpen(true)}
                    data-testid="history-clear"
                  >
                    <Trash2 className="mr-2 h-4 w-4" />
                    {t('history.clear')}
                  </Button>
                )}
              </div>
            </CardContent>
          </Card>

          {error && (
            <Card>
              <CardContent className="flex flex-wrap items-center gap-3 pt-6">
                <p className="text-destructive text-sm" role="alert">
                  {error}
                </p>
                <Button
                  type="button"
                  variant="outline"
                  size="sm"
                  onClick={() => window.location.reload()}
                >
                  {t('common.retry')}
                </Button>
              </CardContent>
            </Card>
          )}

          {loading ? (
            <div className="flex justify-center p-8">
              <Loader2 className="text-muted-foreground h-6 w-6 animate-spin" />
              <span className="sr-only">{t('common.loading')}</span>
            </div>
          ) : sessions.length === 0 ? (
            <Card data-testid="history-empty">
              <CardHeader>
                <CardTitle className="text-base">
                  {t('history.empty')}
                </CardTitle>
                <CardDescription>{t('history.emptyHint')}</CardDescription>
              </CardHeader>
            </Card>
          ) : (
            <div className="space-y-4">
              {sessions.map((session) => (
                <SessionCard
                  key={session.id}
                  session={session}
                  historyConfig={historyConfig}
                />
              ))}
              {cursor && (
                <div className="flex justify-center">
                  <Button
                    type="button"
                    variant="outline"
                    onClick={() => void loadMore()}
                    disabled={loadingMore}
                    data-testid="history-load-more"
                  >
                    {loadingMore && (
                      <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                    )}
                    {t('history.showMore')}
                  </Button>
                </div>
              )}
            </div>
          )}
        </div>
      </main>

      <AlertDialog open={clearOpen} onOpenChange={setClearOpen}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>
              {t('history.clearConfirmTitle')}
            </AlertDialogTitle>
            <AlertDialogDescription>
              {t('history.clearConfirmDesc')}
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>{t('common.cancel')}</AlertDialogCancel>
            <AlertDialogAction
              onClick={() => void clearHistory()}
              disabled={clearing}
            >
              {t('history.clear')}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}
