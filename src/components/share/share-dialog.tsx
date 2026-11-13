'use client';

import { useEffect, useRef, useState } from 'react';

import { Check, Copy, Link2, Share2, Trash2 } from 'lucide-react';

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
import { Checkbox } from '@/components/ui/checkbox';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { Input } from '@/components/ui/input';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { useTranslation } from '@/context/language-context';
import { sharePath } from '@/lib/routes';

/**
 * ─── LANDMARK: SHARE DIALOG ─────────────────────────────────────────────────
 * Управление гостевой ссылкой на лист. Токен показывается только в ответе
 * POST: на диске лежит SHA-256, поэтому после закрытия диалога ссылку нельзя
 * «посмотреть» — только перевыпустить. Это осознанный компромисс (D2).
 *
 * Перед созданием вызывается `onBeforeCreate`: страница сбрасывает активное
 * поле и ждёт очередь сохранений, иначе ссылка показала бы версию до последней
 * правки.
 */
interface ShareDialogProps {
  characterId: string;
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onBeforeCreate?: () => Promise<void> | void;
}

interface ShareStatusResponse {
  active: boolean;
  createdAt?: string;
  expiresAt?: string | null;
  includeHistory?: boolean;
}

interface ShareCreatedResponse {
  token: string;
  path: string;
  createdAt: string;
  expiresAt: string | null;
  includeHistory?: boolean;
}

type ExpiryValue = '7' | '30' | '90' | 'never';
type ConfirmAction = 'revoke' | 'regenerate';

export function ShareDialog({
  characterId,
  open,
  onOpenChange,
  onBeforeCreate,
}: ShareDialogProps) {
  const { t, language } = useTranslation();
  const [status, setStatus] = useState<ShareStatusResponse | null>(null);
  const [created, setCreated] = useState<
    (ShareCreatedResponse & { url: string }) | null
  >(null);
  const [expiry, setExpiry] = useState<ExpiryValue>('30');
  const [includeHistory, setIncludeHistory] = useState(false);
  const [busy, setBusy] = useState(false);
  const [copied, setCopied] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [confirmAction, setConfirmAction] = useState<ConfirmAction | null>(
    null,
  );
  const linkRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    if (!open) return;

    let active = true;
    void fetch(`/api/characters/${encodeURIComponent(characterId)}/share`, {
      cache: 'no-store',
    })
      .then(async (res) => {
        const body = (await res
          .json()
          .catch(() => null)) as ShareStatusResponse | null;
        if (!res.ok || !body) throw new Error('share_status_failed');
        if (active) {
          setStatus(body);
          setIncludeHistory(body.includeHistory === true);
        }
      })
      .catch(() => {
        if (active) setError(t('share.loadError'));
      });

    return () => {
      active = false;
    };
  }, [open, characterId, t]);

  const loading = status === null && error === null;

  /**
   * Закрытие сбрасывает и статус, и показанный токен: на диске его нет, а
   * держать его в состоянии закрытого диалога бессмысленно и небезопасно.
   */
  const handleOpenChange = (isOpen: boolean): void => {
    if (!isOpen) {
      setStatus(null);
      setCreated(null);
      setCopied(false);
      setError(null);
      setIncludeHistory(false);
      setConfirmAction(null);
    }
    onOpenChange(isOpen);
  };

  const formatDate = (iso: string | null | undefined): string => {
    if (!iso) return t('share.expiresNever');
    return new Intl.DateTimeFormat(language === 'ru' ? 'ru-RU' : 'en-GB', {
      dateStyle: 'medium',
      timeStyle: 'short',
    }).format(new Date(iso));
  };

  const expiresInDays = (): number | null =>
    expiry === 'never' ? null : Number(expiry);

  const createLink = async (): Promise<void> => {
    if (busy) return;
    setBusy(true);
    setError(null);
    setCopied(false);
    try {
      await onBeforeCreate?.();
      const res = await fetch(
        `/api/characters/${encodeURIComponent(characterId)}/share`,
        {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            expiresInDays: expiresInDays(),
            includeHistory,
          }),
        },
      );
      const body = (await res.json().catch(() => null)) as
        (Partial<ShareCreatedResponse> & { reason?: string }) | null;
      if (!res.ok || !body?.token) {
        setError(
          body?.reason === 'invalid_expiry'
            ? t('share.expiryError')
            : t('share.createError'),
        );
        return;
      }

      const result: ShareCreatedResponse & { url: string } = {
        token: body.token,
        path: body.path ?? sharePath(body.token),
        createdAt: body.createdAt ?? new Date().toISOString(),
        expiresAt: body.expiresAt ?? null,
        includeHistory: body.includeHistory === true,
        url: '',
      };
      result.url =
        typeof window === 'undefined'
          ? result.path
          : `${window.location.origin}${result.path}`;
      setCreated(result);
      setStatus({
        active: true,
        createdAt: result.createdAt,
        expiresAt: result.expiresAt,
        includeHistory: result.includeHistory === true,
      });

      try {
        await navigator.clipboard.writeText(result.url);
        setCopied(true);
      } catch {
        // Буфер обмена может быть недоступен: ссылка остаётся в input.
      }
    } catch {
      setError(t('share.createError'));
    } finally {
      setBusy(false);
    }
  };

  const copyLink = async (): Promise<void> => {
    if (!created) return;
    try {
      await navigator.clipboard.writeText(created.url);
      setCopied(true);
    } catch {
      setError(t('share.copyFailed'));
      linkRef.current?.focus();
      linkRef.current?.select();
    }
  };

  const revokeLink = async (): Promise<void> => {
    if (busy) return;
    setBusy(true);
    setError(null);
    try {
      const res = await fetch(
        `/api/characters/${encodeURIComponent(characterId)}/share`,
        { method: 'DELETE' },
      );
      if (!res.ok) {
        setError(t('share.revokeError'));
        return;
      }
      setCreated(null);
      setStatus({ active: false });
    } catch {
      setError(t('share.revokeError'));
    } finally {
      setBusy(false);
    }
  };

  const confirm = async (): Promise<void> => {
    const action = confirmAction;
    setConfirmAction(null);
    if (action === 'revoke') await revokeLink();
    else if (action === 'regenerate') await createLink();
  };

  const linkUrl = created?.url;
  const active = status?.active === true;

  return (
    <>
      <Dialog open={open} onOpenChange={handleOpenChange}>
        <DialogContent className="sm:max-w-[520px]" data-testid="share-dialog">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <Share2 className="h-5 w-5" />
              {t('share.dialogTitle')}
            </DialogTitle>
            <DialogDescription>
              {t('share.dialogDescription')}
            </DialogDescription>
          </DialogHeader>

          <div className="space-y-4 py-2">
            <p className="text-muted-foreground text-sm">
              {t('share.warning')}
            </p>

            {error && (
              <p className="text-destructive text-sm" role="alert">
                {error}
              </p>
            )}

            {loading ? (
              <p className="text-muted-foreground text-sm">
                {t('common.loading')}
              </p>
            ) : linkUrl ? (
              <div className="space-y-3">
                <p className="text-sm font-medium">{t('share.active')}</p>
                <div className="flex flex-col gap-2 sm:flex-row">
                  <Input
                    ref={linkRef}
                    readOnly
                    value={linkUrl}
                    aria-label={t('share.copy')}
                    data-testid="share-link"
                    className="font-mono text-xs"
                  />
                  <Button
                    type="button"
                    variant="outline"
                    onClick={() => void copyLink()}
                    data-testid="share-copy"
                  >
                    {copied ? (
                      <Check className="mr-2 h-4 w-4" />
                    ) : (
                      <Copy className="mr-2 h-4 w-4" />
                    )}
                    {copied ? t('share.copied') : t('share.copy')}
                  </Button>
                </div>
                <p className="text-muted-foreground text-xs">
                  {created?.includeHistory
                    ? t('share.historyIncluded')
                    : t('share.historyNotIncluded')}
                </p>
                <p className="text-muted-foreground text-xs">
                  {t('share.linkOnce')}
                </p>
                {created?.expiresAt && (
                  <p className="text-muted-foreground text-xs">
                    {t('share.expiresAt')}: {formatDate(created.expiresAt)}
                  </p>
                )}
                <div className="flex flex-wrap gap-2">
                  <Button
                    type="button"
                    variant="outline"
                    onClick={() => setConfirmAction('regenerate')}
                    disabled={busy}
                    data-testid="share-regenerate"
                  >
                    <Link2 className="mr-2 h-4 w-4" />
                    {t('share.regenerate')}
                  </Button>
                  <Button
                    type="button"
                    variant="destructive"
                    onClick={() => setConfirmAction('revoke')}
                    disabled={busy}
                    data-testid="share-revoke"
                  >
                    <Trash2 className="mr-2 h-4 w-4" />
                    {t('share.revoke')}
                  </Button>
                </div>
              </div>
            ) : active && status ? (
              <div className="space-y-3">
                <p className="text-sm font-medium">{t('share.statusActive')}</p>
                {status.createdAt && (
                  <p className="text-muted-foreground text-sm">
                    {t('share.createdAt')}: {formatDate(status.createdAt)}
                  </p>
                )}
                <p className="text-muted-foreground text-sm">
                  {t('share.expiresAt')}: {formatDate(status.expiresAt)}
                </p>
                <p className="text-muted-foreground text-xs">
                  {status.includeHistory
                    ? t('share.historyIncluded')
                    : t('share.historyNotIncluded')}
                </p>
                <p className="text-muted-foreground text-xs">
                  {t('share.linkOnce')}
                </p>
                <div className="flex flex-wrap gap-2">
                  <Button
                    type="button"
                    variant="outline"
                    onClick={() => setConfirmAction('regenerate')}
                    disabled={busy}
                    data-testid="share-regenerate"
                  >
                    <Link2 className="mr-2 h-4 w-4" />
                    {t('share.regenerate')}
                  </Button>
                  <Button
                    type="button"
                    variant="destructive"
                    onClick={() => setConfirmAction('revoke')}
                    disabled={busy}
                    data-testid="share-revoke"
                  >
                    <Trash2 className="mr-2 h-4 w-4" />
                    {t('share.revoke')}
                  </Button>
                </div>
              </div>
            ) : (
              <div className="space-y-3">
                <p className="text-muted-foreground text-sm">
                  {t('share.noActive')}
                </p>
                <div className="space-y-2">
                  <label className="text-sm font-medium" htmlFor="share-expiry">
                    {t('share.expiryLabel')}
                  </label>
                  <Select
                    value={expiry}
                    onValueChange={(value) => setExpiry(value as ExpiryValue)}
                    disabled={busy}
                  >
                    <SelectTrigger id="share-expiry">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="7">{t('share.expires7')}</SelectItem>
                      <SelectItem value="30">{t('share.expires30')}</SelectItem>
                      <SelectItem value="90">{t('share.expires90')}</SelectItem>
                      <SelectItem value="never">
                        {t('share.expiresNever')}
                      </SelectItem>
                    </SelectContent>
                  </Select>
                </div>
                <div className="flex items-start gap-2 rounded-md border p-3">
                  <Checkbox
                    id="share-include-history"
                    checked={includeHistory}
                    onCheckedChange={(value) =>
                      setIncludeHistory(value === true)
                    }
                    disabled={busy}
                    data-testid="share-include-history"
                  />
                  <div className="space-y-1">
                    <label
                      htmlFor="share-include-history"
                      className="text-sm font-medium"
                    >
                      {t('share.includeHistory')}
                    </label>
                    <p className="text-muted-foreground text-xs">
                      {t('share.includeHistoryHint')}
                    </p>
                  </div>
                </div>
                <Button
                  type="button"
                  onClick={() => void createLink()}
                  disabled={busy}
                  data-testid="share-create"
                >
                  <Share2 className="mr-2 h-4 w-4" />
                  {t('share.create')}
                </Button>
              </div>
            )}
          </div>

          <DialogFooter>
            <Button
              type="button"
              variant="outline"
              onClick={() => handleOpenChange(false)}
            >
              {t('common.close')}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <AlertDialog
        open={confirmAction !== null}
        onOpenChange={(isOpen) => {
          if (!isOpen) setConfirmAction(null);
        }}
      >
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>
              {confirmAction === 'revoke'
                ? t('share.revokeConfirmTitle')
                : t('share.regenerateConfirmTitle')}
            </AlertDialogTitle>
            <AlertDialogDescription>
              {confirmAction === 'revoke'
                ? t('share.revokeConfirmDesc')
                : t('share.regenerateConfirmDesc')}
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>{t('common.cancel')}</AlertDialogCancel>
            <AlertDialogAction onClick={() => void confirm()}>
              {confirmAction === 'revoke'
                ? t('share.revoke')
                : t('share.regenerate')}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </>
  );
}
