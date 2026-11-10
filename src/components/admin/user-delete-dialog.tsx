'use client';

import { useEffect, useState } from 'react';

import { Loader2, Trash2 } from 'lucide-react';

import { Button } from '@/components/ui/button';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { useTranslation } from '@/context/language-context';
import { useToast } from '@/hooks/use-toast';
import type { AdminUserSummary } from '@/lib/admin-types';

import { adminReasonMessage } from './admin-helpers';

interface UserDeleteDialogProps {
  user: AdminUserSummary | null;
  onOpenChange: (open: boolean) => void;
  onDone: () => void;
}

/**
 * ─── LANDMARK: ADMIN_USER_DELETE ────────────────────────────────────────────
 * Удаление чужого аккаунта необратимо (каталог с листами стирается), поэтому
 * подтверждение — ввод логина целиком, а не один клик. Себя удалить нельзя:
 * сервер вернёт reason `self`, для своего аккаунта есть /settings.
 */
export function UserDeleteDialog({
  user,
  onOpenChange,
  onDone,
}: UserDeleteDialogProps) {
  const { t } = useTranslation();
  const { toast } = useToast();

  const [confirmName, setConfirmName] = useState('');
  const [isSaving, setIsSaving] = useState(false);
  const [error, setError] = useState('');

  const expected = user?.username ?? '';
  const matches =
    confirmName.trim().toLowerCase() === expected.trim().toLowerCase();

  useEffect(() => {
    if (!user) return;
    setConfirmName('');
    setError('');
    setIsSaving(false);
  }, [user]);

  const handleOpenChange = (open: boolean) => {
    if (isSaving) return;
    onOpenChange(open);
  };

  const handleDelete = async (event: React.FormEvent) => {
    event.preventDefault();
    if (!user || isSaving) return;
    if (!matches) {
      setError(t('adminDeleteMismatch'));
      return;
    }

    setError('');
    setIsSaving(true);

    try {
      const res = await fetch(`/api/admin/users/${user.uid}`, {
        method: 'DELETE',
      });
      const data = await res.json().catch(() => null);

      if (!res.ok || !data?.success) {
        setError(
          adminReasonMessage(data?.reason, t) ||
            data?.error ||
            t('adminDeleteFailed'),
        );
        return;
      }

      toast({ title: t('adminDeletedToast') });
      onDone();
    } catch {
      setError(t('adminDeleteFailed'));
    } finally {
      setIsSaving(false);
    }
  };

  return (
    <Dialog open={!!user} onOpenChange={handleOpenChange}>
      <DialogContent
        showCloseButton={!isSaving}
        data-testid="admin-delete-dialog"
      >
        <DialogHeader>
          <DialogTitle>{t('adminDeleteTitle')}</DialogTitle>
          <DialogDescription>{t('adminDeleteDescription')}</DialogDescription>
        </DialogHeader>

        <form onSubmit={handleDelete} className="space-y-4">
          <div className="bg-destructive/10 text-destructive rounded-md p-3 text-sm">
            {user ? `${user.displayName} (@${user.username})` : ''}
          </div>

          <div className="space-y-2">
            <Label htmlFor="admin-delete-confirm">
              {t('adminDeleteConfirmLabel').replace('{username}', expected)}
            </Label>
            <Input
              id="admin-delete-confirm"
              value={confirmName}
              onChange={(event) => setConfirmName(event.target.value)}
              disabled={isSaving}
              autoComplete="off"
              spellCheck={false}
            />
          </div>

          {error && (
            <p className="text-destructive text-sm" role="alert">
              {error}
            </p>
          )}

          <DialogFooter className="gap-2">
            <Button
              type="button"
              variant="outline"
              onClick={() => handleOpenChange(false)}
              disabled={isSaving}
            >
              {t('cancel')}
            </Button>
            <Button
              type="submit"
              variant="destructive"
              disabled={isSaving || !matches}
            >
              {isSaving ? (
                <Loader2 className="mr-2 h-4 w-4 animate-spin" />
              ) : (
                <Trash2 className="mr-2 h-4 w-4" />
              )}
              {t('delete')}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
