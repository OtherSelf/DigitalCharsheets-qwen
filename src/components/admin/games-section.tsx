'use client';

import { useCallback, useEffect, useState } from 'react';
import Link from 'next/link';

import { ExternalLink, Loader2, Save, ShieldAlert } from 'lucide-react';

import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from '@/components/ui/card';
import { Checkbox } from '@/components/ui/checkbox';
import { Input } from '@/components/ui/input';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { useTranslation } from '@/context/language-context';
import type { ModuleStatus } from '@/games/types';

interface AdminGame {
  id: string;
  gameId: string;
  nameKey: string;
  descriptionKey: string;
  defaultStatus: ModuleStatus;
  status: ModuleStatus;
  enabled: boolean;
  version: string | null;
  schemaVersion: number;
  tags: string[];
  dependencies: { host: string; plugins: Record<string, string> } | null;
  conformance: string | null;
  demo: boolean;
}

interface AdminGamesResponse {
  success: boolean;
  siteTitle?: string | null;
  games?: AdminGame[];
  error?: string;
}

const STATUSES: ModuleStatus[] = ['published', 'test', 'hidden'];

/**
 * ─── LANDMARK: ADMIN GAMES SECTION ────────────────────────────────────────
 * Управление видимостью редакций (GET/PUT /api/admin/games) и заголовком
 * сайта из game-catalog.json. Скрытие не блокирует открытие существующих
 * листов — это явно написано в подсказке.
 */
export function AdminGamesSection() {
  const { t } = useTranslation();
  const [games, setGames] = useState<AdminGame[]>([]);
  const [siteTitle, setSiteTitle] = useState('');
  const [savedTitle, setSavedTitle] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [isSaving, setIsSaving] = useState(false);
  const [error, setError] = useState('');
  const [status, setStatus] = useState('');

  const apply = (data: AdminGamesResponse) => {
    if (data.games) setGames(data.games);
    const title = data.siteTitle ?? null;
    setSavedTitle(title);
    setSiteTitle(title ?? '');
  };

  const load = useCallback(async () => {
    setIsLoading(true);
    setError('');
    try {
      const res = await fetch('/api/admin/games', { cache: 'no-store' });
      const data = (await res
        .json()
        .catch(() => null)) as AdminGamesResponse | null;
      if (!res.ok || !data?.success) {
        setError(data?.error || t('admin.gamesLoadFailed'));
        return;
      }
      apply(data);
    } catch {
      setError(t('admin.gamesLoadFailed'));
    } finally {
      setIsLoading(false);
    }
  }, [t]);

  useEffect(() => {
    void load();
  }, [load]);

  const updateStatus = async (systemId: string, next: ModuleStatus) => {
    setIsSaving(true);
    setStatus('');
    setError('');
    try {
      const res = await fetch('/api/admin/games', {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ systemId, status: next }),
      });
      const data = (await res
        .json()
        .catch(() => null)) as AdminGamesResponse | null;
      if (!res.ok || !data?.success) {
        setError(data?.error || t('admin.gamesSaveFailed'));
        return;
      }
      apply(data);
      setStatus(t('admin.gamesSaved'));
    } catch {
      setError(t('admin.gamesSaveFailed'));
    } finally {
      setIsSaving(false);
    }
  };

  const updateEnabled = async (systemId: string, enabled: boolean) => {
    setIsSaving(true);
    setStatus('');
    setError('');
    try {
      const res = await fetch('/api/admin/games', {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ systemId, enabled }),
      });
      const data = (await res
        .json()
        .catch(() => null)) as AdminGamesResponse | null;
      if (!res.ok || !data?.success) {
        setError(data?.error || t('admin.gamesSaveFailed'));
        return;
      }
      apply(data);
      setStatus(t('admin.gamesSaved'));
    } catch {
      setError(t('admin.gamesSaveFailed'));
    } finally {
      setIsSaving(false);
    }
  };

  const saveTitle = async (value: string | null) => {
    setIsSaving(true);
    setStatus('');
    setError('');
    try {
      const res = await fetch('/api/admin/games', {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ siteTitle: value }),
      });
      const data = (await res
        .json()
        .catch(() => null)) as AdminGamesResponse | null;
      if (!res.ok || !data?.success) {
        setError(data?.error || t('admin.gamesSaveFailed'));
        return;
      }
      apply(data);
      setStatus(t('admin.gamesSaved'));
    } catch {
      setError(t('admin.gamesSaveFailed'));
    } finally {
      setIsSaving(false);
    }
  };

  const statusLabel = (value: ModuleStatus) =>
    t(
      value === 'published'
        ? 'admin.statusPublished'
        : value === 'test'
          ? 'admin.statusTest'
          : 'admin.statusHidden',
    );

  if (isLoading) {
    return (
      <div className="flex items-center gap-2 text-sm">
        <Loader2 className="h-4 w-4 animate-spin" />
        {t('common.loading')}
      </div>
    );
  }

  return (
    <div className="space-y-4">
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <ShieldAlert className="h-5 w-5" />
            {t('admin.gamesTitle')}
          </CardTitle>
          <CardDescription>{t('admin.gamesDescription')}</CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          {error && (
            <p className="bg-destructive/15 text-destructive rounded-md p-3 text-sm">
              {error}
            </p>
          )}
          <div className="overflow-x-auto">
            <table className="w-full min-w-[820px] text-sm">
              <thead>
                <tr className="text-muted-foreground border-b text-left text-xs">
                  <th className="py-2 pr-3 font-semibold">
                    {t('admin.gameColumn')}
                  </th>
                  <th className="py-2 pr-3 font-semibold">
                    {t('admin.editionColumn')}
                  </th>
                  <th className="py-2 pr-3 font-semibold">
                    {t('admin.versionColumn')}
                  </th>
                  <th className="py-2 pr-3 font-semibold">
                    {t('admin.defaultStatusColumn')}
                  </th>
                  <th className="py-2 pr-3 font-semibold">
                    {t('admin.currentStatusColumn')}
                  </th>
                  <th className="py-2 pr-3 font-semibold">
                    {t('admin.enabledColumn')}
                  </th>
                  <th className="py-2 pr-3 font-semibold">
                    {t('admin.demoColumn')}
                  </th>
                </tr>
              </thead>
              <tbody>
                {games.map((game) => (
                  <tr key={game.id} className="border-b last:border-0">
                    <td className="py-2 pr-3">{t(game.nameKey)}</td>
                    <td className="py-2 pr-3">{t(game.descriptionKey)}</td>
                    <td className="py-2 pr-3 whitespace-nowrap">
                      <Badge variant="outline">
                        {game.version ? `v${game.version}` : '—'}
                      </Badge>
                      <span className="text-muted-foreground mt-1 block text-[11px]">
                        {t('admin.schemaColumn')} {game.schemaVersion}
                        {game.conformance ? ` · ${game.conformance}` : ''}
                        {game.dependencies
                          ? ` · ${t('admin.hostApiLabel')} ${game.dependencies.host}`
                          : ''}
                      </span>
                    </td>
                    <td className="py-2 pr-3">
                      <Badge variant="outline">
                        {statusLabel(game.defaultStatus)}
                      </Badge>
                    </td>
                    <td className="py-2 pr-3">
                      <Select
                        value={game.status}
                        disabled={isSaving}
                        onValueChange={(value) =>
                          void updateStatus(game.id, value as ModuleStatus)
                        }
                      >
                        <SelectTrigger
                          className="h-8 w-[150px]"
                          aria-label={t('admin.currentStatusColumn')}
                        >
                          <SelectValue />
                        </SelectTrigger>
                        <SelectContent>
                          {STATUSES.map((value) => (
                            <SelectItem key={value} value={value}>
                              {statusLabel(value)}
                            </SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                    </td>
                    <td className="py-2 pr-3">
                      <Checkbox
                        checked={game.enabled}
                        disabled={isSaving}
                        onCheckedChange={(checked) =>
                          void updateEnabled(game.id, checked === true)
                        }
                        aria-label={`${t('admin.enabledColumn')}: ${t(game.nameKey)}`}
                      />
                    </td>
                    <td className="py-2 pr-3">
                      {game.demo ? (
                        <Button variant="ghost" size="sm" asChild>
                          <Link href="/demo">
                            <ExternalLink className="h-4 w-4" />
                            <span className="sr-only">
                              {t('admin.demoColumn')}
                            </span>
                          </Link>
                        </Button>
                      ) : (
                        '—'
                      )}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          <p className="text-muted-foreground text-xs">
            {t('admin.gamesVisibilityNote')}
          </p>
          <p className="text-muted-foreground text-xs">
            {t('admin.gamesEnabledNote')}
          </p>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>{t('admin.siteTitle')}</CardTitle>
          <CardDescription>{t('admin.siteTitleDescription')}</CardDescription>
        </CardHeader>
        <CardContent className="flex flex-col gap-2 sm:flex-row sm:items-center">
          <Input
            value={siteTitle}
            onChange={(event) => setSiteTitle(event.target.value)}
            placeholder={t('admin.siteTitlePlaceholder')}
            className="sm:max-w-md"
            disabled={isSaving}
          />
          <Button
            onClick={() => void saveTitle(siteTitle)}
            disabled={isSaving || siteTitle === (savedTitle ?? '')}
          >
            <Save className="mr-2 h-4 w-4" />
            {t('common.save')}
          </Button>
          <Button
            variant="outline"
            onClick={() => void saveTitle(null)}
            disabled={isSaving || savedTitle === null}
          >
            {t('admin.siteTitleReset')}
          </Button>
        </CardContent>
      </Card>

      {status && (
        <p className="text-muted-foreground text-sm" role="status">
          {status}
        </p>
      )}
    </div>
  );
}
