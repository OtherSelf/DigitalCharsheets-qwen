'use client';

import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';

import { Archive, ArchiveRestore, Loader2, Trash2, Undo2 } from 'lucide-react';

import { AppFrame } from '@/components/layout/app-frame';
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
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from '@/components/ui/card';
import { useTranslation } from '@/context/language-context';
import { useLocalAuth } from '@/context/local-auth-context';
import { useToast } from '@/hooks/use-toast';
import type { Language } from '@/lib/language';
import { currentPathname, loginPath } from '@/lib/routes';

/**
 * ─── LANDMARK: ARCHIVE PAGE (/archive) ──────────────────────────────────────
 * Две вкладки с разным смыслом: «Архив» — листы, убранные владельцем
 * (хранятся бессрочно, пока не очистят), «Корзина» — удалённые (живут
 * TRASH_RETENTION_DAYS). Восстановление возвращает лист в активный список;
 * очистка необратима и подтверждается.
 */
interface ArchiveEntry {
  id: string;
  name: string;
  systemId: string | null;
  updatedAt: string | null;
  archivedAt?: string;
  deletedAt?: string;
  expiresAt?: string;
}

interface ArchiveResponse {
  success: boolean;
  archive: ArchiveEntry[];
  trash: ArchiveEntry[];
  retentionDays: number;
}

type Tab = 'archive' | 'trash';

function formatDate(
  value: string | null | undefined,
  language: Language,
): string {
  if (!value) return '—';
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return '—';
  return new Intl.DateTimeFormat(language === 'ru' ? 'ru-RU' : 'en-GB', {
    dateStyle: 'medium',
  }).format(date);
}

export default function ArchivePage() {
  const { t, language } = useTranslation();
  const { user, isUserLoading } = useLocalAuth();
  const { toast } = useToast();
  const router = useRouter();

  const [data, setData] = useState<ArchiveResponse | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [tab, setTab] = useState<Tab>('archive');
  const [busyId, setBusyId] = useState<string | null>(null);
  const [confirm, setConfirm] = useState<Tab | null>(null);

  useEffect(() => {
    if (!isUserLoading && !user) {
      router.replace(loginPath(currentPathname()));
    }
  }, [isUserLoading, user, router]);

  useEffect(() => {
    if (!user) return;
    let active = true;
    void fetch('/api/characters/archive', { cache: 'no-store' })
      .then(async (res) => {
        if (!res.ok) throw new Error(`archive_load_${res.status}`);
        return (await res.json()) as ArchiveResponse;
      })
      .then((body) => {
        if (!active) return;
        setData(body);
        setError('');
      })
      .catch(() => {
        if (active) setError(t('common.archiveLoadError'));
      })
      .finally(() => {
        if (active) setLoading(false);
      });
    return () => {
      active = false;
    };
  }, [user, t]);

  const items = tab === 'archive' ? (data?.archive ?? []) : (data?.trash ?? []);

  const removeFromList = (id: string) => {
    setData((previous) => {
      if (!previous) return previous;
      return {
        ...previous,
        archive: previous.archive.filter((item) => item.id !== id),
        trash: previous.trash.filter((item) => item.id !== id),
      };
    });
  };

  const restore = async (entry: ArchiveEntry) => {
    if (busyId) return;
    setBusyId(entry.id);
    try {
      const response = await fetch(
        tab === 'archive'
          ? `/api/characters/${encodeURIComponent(entry.id)}/archive`
          : `/api/characters/${encodeURIComponent(entry.id)}/restore`,
        { method: tab === 'archive' ? 'DELETE' : 'POST' },
      );
      if (!response.ok) throw new Error(`restore_failed_${response.status}`);
      removeFromList(entry.id);
      toast({ title: t('common.characterRestored') });
    } catch {
      toast({
        variant: 'destructive',
        title: t('common.error'),
        description: t('common.restoreFailed'),
      });
    } finally {
      setBusyId(null);
    }
  };

  const purge = async (entry: ArchiveEntry) => {
    if (busyId) return;
    setBusyId(entry.id);
    try {
      const response = await fetch(
        `/api/characters/trash/${encodeURIComponent(entry.id)}`,
        { method: 'DELETE' },
      );
      if (!response.ok) throw new Error(`purge_failed_${response.status}`);
      removeFromList(entry.id);
      toast({ title: t('common.characterPurged') });
    } catch {
      toast({
        variant: 'destructive',
        title: t('common.error'),
        description: t('common.clearTrashFailed'),
      });
    } finally {
      setBusyId(null);
    }
  };

  const clear = async (which: Tab) => {
    try {
      const response = await fetch(
        which === 'archive'
          ? '/api/characters/archive'
          : '/api/characters/trash',
        { method: 'DELETE' },
      );
      if (!response.ok) throw new Error(`clear_failed_${response.status}`);
      setData((previous) =>
        previous
          ? {
              ...previous,
              archive: which === 'archive' ? [] : previous.archive,
              trash: which === 'trash' ? [] : previous.trash,
            }
          : previous,
      );
    } catch {
      toast({
        variant: 'destructive',
        title: t('common.error'),
        description:
          which === 'archive'
            ? t('common.clearArchiveFailed')
            : t('common.clearTrashFailed'),
      });
    } finally {
      setConfirm(null);
    }
  };

  return (
    <AppFrame header={{ backHref: '/' }}>
      <div className="mx-auto max-w-4xl space-y-4" data-testid="archive-page">
        <div className="flex flex-col gap-1">
          <h1 className="font-headline flex items-center gap-2 text-2xl font-bold">
            <Archive className="h-6 w-6" />
            {t('common.archiveTitle')}
          </h1>
          <p className="text-muted-foreground text-sm">
            {t('common.archiveDescription')}
          </p>
        </div>

        <div className="flex flex-wrap items-center justify-between gap-2">
          <div className="flex gap-2" role="tablist">
            <Button
              type="button"
              role="tab"
              aria-selected={tab === 'archive'}
              variant={tab === 'archive' ? 'default' : 'outline'}
              size="sm"
              onClick={() => setTab('archive')}
              data-testid="archive-tab"
            >
              {t('common.archive')} ({data?.archive.length ?? 0})
            </Button>
            <Button
              type="button"
              role="tab"
              aria-selected={tab === 'trash'}
              variant={tab === 'trash' ? 'default' : 'outline'}
              size="sm"
              onClick={() => setTab('trash')}
              data-testid="trash-tab"
            >
              {t('common.trash')} ({data?.trash.length ?? 0})
            </Button>
          </div>

          {items.length > 0 && (
            <Button
              type="button"
              variant="destructive"
              size="sm"
              onClick={() => setConfirm(tab)}
              data-testid={tab === 'archive' ? 'clear-archive' : 'clear-trash'}
            >
              <Trash2 className="mr-2 h-4 w-4" />
              {tab === 'archive'
                ? t('common.clearArchive')
                : t('common.clearTrash')}
            </Button>
          )}
        </div>

        {error && (
          <Card>
            <CardContent className="pt-6">
              <p className="text-destructive text-sm" role="alert">
                {error}
              </p>
            </CardContent>
          </Card>
        )}

        {loading ? (
          <div className="flex justify-center p-8">
            <Loader2 className="text-muted-foreground h-6 w-6 animate-spin" />
            <span className="sr-only">{t('common.loading')}</span>
          </div>
        ) : items.length === 0 ? (
          <Card data-testid="archive-empty">
            <CardHeader>
              <CardTitle className="text-base">
                {tab === 'archive'
                  ? t('common.archiveEmpty')
                  : t('common.trashEmpty')}
              </CardTitle>
              <CardDescription>
                {tab === 'archive'
                  ? t('common.archiveEmptyDesc')
                  : t('common.trashEmptyDesc')}
              </CardDescription>
            </CardHeader>
          </Card>
        ) : (
          <div className="space-y-2">
            {tab === 'trash' && (
              <p className="text-muted-foreground text-xs">
                {t('common.trashHint')}
              </p>
            )}
            {items.map((entry) => (
              <Card key={entry.id} data-testid={`archive-item-${entry.id}`}>
                <CardHeader className="pb-3">
                  <div className="flex flex-wrap items-start justify-between gap-3">
                    <div className="min-w-0">
                      <CardTitle className="text-base break-words">
                        {entry.name}
                      </CardTitle>
                      <CardDescription className="mt-1 flex flex-wrap items-center gap-2 text-xs">
                        {entry.systemId && (
                          <Badge variant="secondary" className="text-[10px]">
                            {entry.systemId}
                          </Badge>
                        )}
                        <span>
                          {tab === 'archive'
                            ? t('common.archivedAt')
                            : t('common.deletedAt')}
                          :{' '}
                          {formatDate(
                            entry.archivedAt ?? entry.deletedAt,
                            language,
                          )}
                        </span>
                        {tab === 'trash' && entry.expiresAt && (
                          <span>
                            {t('common.expiresAt')}:{' '}
                            {formatDate(entry.expiresAt, language)}
                          </span>
                        )}
                      </CardDescription>
                    </div>
                    <div className="flex shrink-0 gap-1">
                      <Button
                        type="button"
                        variant="outline"
                        size="sm"
                        onClick={() => void restore(entry)}
                        disabled={busyId === entry.id}
                        data-testid={`restore-${entry.id}`}
                      >
                        {tab === 'archive' ? (
                          <ArchiveRestore className="mr-2 h-4 w-4" />
                        ) : (
                          <Undo2 className="mr-2 h-4 w-4" />
                        )}
                        {t('common.restore')}
                      </Button>
                      {tab === 'trash' && (
                        <Button
                          type="button"
                          variant="ghost"
                          size="icon"
                          className="text-destructive h-8 w-8"
                          onClick={() => void purge(entry)}
                          disabled={busyId === entry.id}
                          title={t('common.deleteForever')}
                          aria-label={t('common.deleteForever')}
                          data-testid={`purge-${entry.id}`}
                        >
                          <Trash2 className="h-4 w-4" />
                        </Button>
                      )}
                    </div>
                  </div>
                </CardHeader>
              </Card>
            ))}
          </div>
        )}
      </div>

      <AlertDialog
        open={confirm !== null}
        onOpenChange={(open) => {
          if (!open) setConfirm(null);
        }}
      >
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>
              {confirm === 'trash'
                ? t('common.clearTrashConfirmTitle')
                : t('common.clearArchiveConfirmTitle')}
            </AlertDialogTitle>
            <AlertDialogDescription>
              {confirm === 'trash'
                ? t('common.clearTrashConfirmDesc')
                : t('common.clearArchiveConfirmDesc')}
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>{t('common.cancel')}</AlertDialogCancel>
            <AlertDialogAction
              onClick={() => confirm && void clear(confirm)}
              data-testid="confirm-clear"
            >
              {confirm === 'trash'
                ? t('common.clearTrash')
                : t('common.clearArchive')}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </AppFrame>
  );
}
