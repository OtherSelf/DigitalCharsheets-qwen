'use client';

import { useEffect, useState } from 'react';

import { Loader2 } from 'lucide-react';

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
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { useTranslation } from '@/context/language-context';
import { useToast } from '@/hooks/use-toast';
import type { AdminUserSummary } from '@/lib/admin-types';
import type { UserRole } from '@/lib/user-role';

import { adminReasonMessage } from './admin-helpers';

interface UserEditDialogProps {
  user: AdminUserSummary | null;
  onOpenChange: (open: boolean) => void;
  onSaved: (user: AdminUserSummary) => void;
}

/**
 * ─── LANDMARK: ADMIN_USER_EDIT ──────────────────────────────────────────────
 * Одна форма на все «поля пользователя»: отображаемое имя, логин, новый
 * пароль и роль. Пустой пароль означает «не менять» — он не отправляется.
 *
 * Инварианты (последний админ, запрет на себя) проверяет сервер: клиент лишь
 * показывает локализованную причину отказа.
 */
export function UserEditDialog({
  user,
  onOpenChange,
  onSaved,
}: UserEditDialogProps) {
  const { t } = useTranslation();
  const { toast } = useToast();

  const [displayName, setDisplayName] = useState('');
  const [username, setUsername] = useState('');
  const [password, setPassword] = useState('');
  const [role, setRole] = useState<UserRole>('user');
  const [isSaving, setIsSaving] = useState(false);
  const [error, setError] = useState('');

  useEffect(() => {
    if (!user) return;
    setDisplayName(user.displayName);
    setUsername(user.username);
    setPassword('');
    setRole(user.role);
    setError('');
    setIsSaving(false);
  }, [user]);

  const handleOpenChange = (open: boolean) => {
    if (isSaving) return;
    onOpenChange(open);
  };

  const handleSubmit = async (event: React.FormEvent) => {
    event.preventDefault();
    if (!user || isSaving) return;

    if (!displayName.trim()) {
      setError(t('adminDisplayNameRequired'));
      return;
    }
    if (!username.trim()) {
      setError(t('adminLoginRequired'));
      return;
    }
    if (password && password.length < 4) {
      setError(t('adminPasswordShort'));
      return;
    }

    setError('');
    setIsSaving(true);

    try {
      const payload: Record<string, unknown> = {
        displayName: displayName.trim(),
        username: username.trim(),
        role,
      };
      if (password) payload.password = password;

      const res = await fetch(`/api/admin/users/${user.uid}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload),
      });
      const data = await res.json().catch(() => null);

      if (!res.ok || !data?.success || !data?.user) {
        setError(
          adminReasonMessage(data?.reason, t) ||
            data?.error ||
            t('adminSaveFailed'),
        );
        return;
      }

      toast({ title: t('adminUserSaved') });
      onSaved(data.user as AdminUserSummary);
      onOpenChange(false);
    } catch {
      setError(t('adminSaveFailed'));
    } finally {
      setIsSaving(false);
    }
  };

  return (
    <Dialog open={!!user} onOpenChange={handleOpenChange}>
      <DialogContent
        showCloseButton={!isSaving}
        data-testid="admin-edit-dialog"
      >
        <DialogHeader>
          <DialogTitle>{t('adminEditUser')}</DialogTitle>
          <DialogDescription>{t('adminEditUserDescription')}</DialogDescription>
        </DialogHeader>

        <form onSubmit={handleSubmit} className="space-y-4">
          <div className="space-y-2">
            <Label htmlFor="admin-edit-display-name">{t('displayName')}</Label>
            <Input
              id="admin-edit-display-name"
              value={displayName}
              onChange={(event) => setDisplayName(event.target.value)}
              disabled={isSaving}
              autoComplete="off"
            />
          </div>

          <div className="space-y-2">
            <Label htmlFor="admin-edit-username">{t('login')}</Label>
            <Input
              id="admin-edit-username"
              value={username}
              onChange={(event) => setUsername(event.target.value)}
              disabled={isSaving}
              autoComplete="off"
            />
          </div>

          <div className="space-y-2">
            <Label htmlFor="admin-edit-password">{t('newPassword')}</Label>
            <Input
              id="admin-edit-password"
              type="password"
              value={password}
              onChange={(event) => setPassword(event.target.value)}
              disabled={isSaving}
              autoComplete="new-password"
            />
            <p className="text-muted-foreground text-xs">
              {t('adminNewPasswordHint')}
            </p>
          </div>

          <div className="space-y-2">
            <Label htmlFor="admin-edit-role">{t('adminColumnRole')}</Label>
            <Select
              value={role}
              onValueChange={(value) => setRole(value as UserRole)}
              disabled={isSaving}
            >
              <SelectTrigger id="admin-edit-role">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="user">{t('adminRoleUser')}</SelectItem>
                <SelectItem value="admin">{t('adminRoleAdmin')}</SelectItem>
              </SelectContent>
            </Select>
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
            <Button type="submit" disabled={isSaving}>
              {isSaving && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
              {t('adminSave')}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
