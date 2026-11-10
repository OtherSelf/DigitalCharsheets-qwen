'use client';

import { useEffect, useState } from 'react';

import { Loader2 } from 'lucide-react';

import {
  AlertDialog,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from '@/components/ui/alert-dialog';
import { Button } from '@/components/ui/button';
import { useTranslation } from '@/context/language-context';
import { useToast } from '@/hooks/use-toast';
import type { AdminUserSummary } from '@/lib/admin-types';

import { adminReasonMessage } from './admin-helpers';

interface UserBlockDialogProps {
  user: AdminUserSummary | null;
  onOpenChange: (open: boolean) => void;
  onDone: () => void;
}

/**
 * ─── LANDMARK: ADMIN_USER_BLOCK ─────────────────────────────────────────────
 * Блокировка/разблокировка одним подтверждением. Блокировка сразу
 * инвалидирует сессии: `getSessionUid` читает флаг из user.json.
 */
export function UserBlockDialog({
  user,
  onOpenChange,
  onDone,
}: UserBlockDialogProps) {
  const { t } = useTranslation();
  const { toast } = useToast();

  const [isSaving, setIsSaving] = useState(false);
  const [error, setError] = useState('');

  const blocking = !!user && !user.isBlocked;

  useEffect(() => {
    if (!user) return;
    setError('');
    setIsSaving(false);
  }, [user]);

  const handleOpenChange = (open: boolean) => {
    if (isSaving) return;
    onOpenChange(open);
  };

  const handleConfirm = async () => {
    if (!user || isSaving) return;
    setError('');
    setIsSaving(true);

    try {
      const res = await fetch(`/api/admin/users/${user.uid}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ isBlocked: blocking }),
      });
      const data = await res.json().catch(() => null);

      if (!res.ok || !data?.success) {
        setError(
          adminReasonMessage(data?.reason, t) ||
            data?.error ||
            t('adminSaveFailed'),
        );
        return;
      }

      toast({
        title: blocking ? t('adminBlockedToast') : t('adminUnblockedToast'),
      });
      onDone();
    } catch {
      setError(t('adminSaveFailed'));
    } finally {
      setIsSaving(false);
    }
  };

  return (
    <AlertDialog open={!!user} onOpenChange={handleOpenChange}>
      <AlertDialogContent data-testid="admin-block-dialog">
        <AlertDialogHeader>
          <AlertDialogTitle>
            {blocking ? t('adminBlockTitle') : t('adminUnblockTitle')}
          </AlertDialogTitle>
          <AlertDialogDescription>
            {blocking
              ? t('adminBlockDescription')
              : t('adminUnblockDescription')}
            {user ? ` (${user.displayName} · @${user.username})` : ''}
          </AlertDialogDescription>
        </AlertDialogHeader>

        {error && (
          <p className="text-destructive text-sm" role="alert">
            {error}
          </p>
        )}

        <AlertDialogFooter>
          <AlertDialogCancel disabled={isSaving}>
            {t('cancel')}
          </AlertDialogCancel>
          <Button
            type="button"
            variant={blocking ? 'destructive' : 'default'}
            onClick={() => void handleConfirm()}
            disabled={isSaving}
          >
            {isSaving && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
            {blocking ? t('adminBlock') : t('adminUnblock')}
          </Button>
        </AlertDialogFooter>
      </AlertDialogContent>
    </AlertDialog>
  );
}
