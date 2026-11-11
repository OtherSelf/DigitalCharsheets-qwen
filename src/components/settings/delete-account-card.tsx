'use client';

import { useRef, useState } from 'react';
import { useRouter } from 'next/navigation';

import { AlertTriangle, Trash2 } from 'lucide-react';

import { Button } from '@/components/ui/button';
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from '@/components/ui/card';
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
import { useLocalAuth } from '@/context/local-auth-context';

/**
 * ─── LANDMARK: DELETE ACCOUNT CARD ──────────────────────────────────────────
 * «Опасная зона» на /settings. Удаление аккаунта требует:
 *   • явного открытия диалога (кнопка не удаляет сразу);
 *   • прочтения предупреждения о необратимости (оно в самом диалоге);
 *   • текущего пароля — повторная аутентификация, одной сессии мало.
 *
 * Пока идёт запрос, диалог нельзя закрыть, а кнопка подтверждения показывает
 * «Удаление...»: иначе повторный клик отправил бы второй DELETE.
 */
export function DeleteAccountCard() {
  const { user, deleteAccount } = useLocalAuth();
  const { t } = useTranslation();
  const router = useRouter();

  const [open, setOpen] = useState(false);
  const [password, setPassword] = useState('');
  const [isDeleting, setIsDeleting] = useState(false);
  const [error, setError] = useState('');

  const passwordRef = useRef<HTMLInputElement>(null);

  const handleOpenChange = (next: boolean) => {
    // Во время удаления диалог не закрываем: запрос уже ушёл.
    if (isDeleting) return;
    setOpen(next);
    if (!next) {
      setPassword('');
      setError('');
    }
  };

  const mapDeleteError = (reason?: string, message?: string) => {
    if (reason === 'invalid_password') {
      return (
        t('settings.deleteAccountIncorrectPassword') || 'Incorrect password.'
      );
    }
    if (reason === 'invalid_input') {
      return (
        t('settings.deleteAccountPasswordRequired') || 'Enter your password.'
      );
    }
    return (
      message ||
      t('settings.deleteAccountFailed') ||
      'Failed to delete the account.'
    );
  };

  const handleDelete = async (event: React.FormEvent) => {
    event.preventDefault();
    if (!user || isDeleting) return;

    if (!password.trim()) {
      setError(
        t('settings.deleteAccountPasswordRequired') ||
          'Enter your password to confirm.',
      );
      return;
    }

    setError('');
    setIsDeleting(true);

    const result = await deleteAccount(password);

    if (result.success) {
      // Аккаунта больше нет: сервер уже стёр cookie, контекст — localStorage.
      setOpen(false);
      router.replace('/login');
      return;
    }

    setIsDeleting(false);
    setError(mapDeleteError(result.reason, result.error));
  };

  return (
    <>
      <Card className="border-destructive/60" data-testid="danger-zone-card">
        <CardHeader>
          <CardTitle className="text-destructive flex items-center gap-2">
            <AlertTriangle className="h-5 w-5" />
            {t('settings.dangerZone') || 'Danger Zone'}
          </CardTitle>
          <CardDescription>
            {t('settings.dangerZoneDescription') ||
              'Irreversible actions. Read the warning carefully before continuing.'}
          </CardDescription>
        </CardHeader>
        <CardContent>
          <p className="text-muted-foreground mb-3 text-sm">
            {t('settings.deleteAccountDescription') ||
              'Permanently delete your profile and all of your character sheets.'}
          </p>
          <Button
            type="button"
            variant="destructive"
            onClick={() => setOpen(true)}
            data-testid="delete-account-open"
          >
            <Trash2 className="mr-2 h-4 w-4" />
            {t('settings.deleteAccount') || 'Delete Account'}
          </Button>
        </CardContent>
      </Card>

      <Dialog open={open} onOpenChange={handleOpenChange}>
        <DialogContent
          showCloseButton={!isDeleting}
          data-testid="delete-account-dialog"
          onOpenAutoFocus={(event) => {
            // Открываем диалог сразу на поле пароля, а не на крестике.
            event.preventDefault();
            passwordRef.current?.focus();
          }}
        >
          <DialogHeader>
            <DialogTitle>
              {t('settings.deleteAccountConfirmTitle') ||
                'Delete your account?'}
            </DialogTitle>
            <DialogDescription>
              {t('settings.deleteAccountIrreversible') ||
                'This action cannot be undone. Your account will be permanently deleted.'}
            </DialogDescription>
          </DialogHeader>

          <div className="border-destructive/50 bg-destructive/10 flex gap-3 rounded-md border p-3 text-sm">
            <AlertTriangle className="text-destructive mt-0.5 h-4 w-4 shrink-0" />
            <p>
              {t('settings.deleteAccountWarning') ||
                'Your profile, every character sheet and the recovery phrase of this account will be erased. This action cannot be undone.'}
            </p>
          </div>

          <form onSubmit={handleDelete} className="space-y-4">
            <div className="space-y-2">
              <Label htmlFor="delete-account-password">
                {t('settings.deleteAccountPasswordLabel') ||
                  'Confirm your password'}
              </Label>
              <Input
                ref={passwordRef}
                id="delete-account-password"
                name="password"
                type="password"
                autoComplete="current-password"
                value={password}
                onChange={(event) => setPassword(event.target.value)}
                placeholder={
                  t('settings.deleteAccountPasswordPlaceholder') ||
                  'Enter your current password'
                }
                disabled={isDeleting}
              />
              <p className="text-muted-foreground text-xs">
                {t('settings.deleteAccountPasswordHint') ||
                  'Enter your current password to confirm that this is your account.'}
              </p>
            </div>

            {error && (
              <p
                role="alert"
                data-testid="delete-account-error"
                className="text-destructive text-sm font-medium"
              >
                {error}
              </p>
            )}

            <DialogFooter className="gap-2">
              <Button
                type="button"
                variant="outline"
                onClick={() => handleOpenChange(false)}
                disabled={isDeleting}
              >
                {t('common.cancel') || 'Cancel'}
              </Button>
              <Button
                type="submit"
                variant="destructive"
                disabled={!password.trim() || isDeleting}
                data-testid="delete-account-confirm"
              >
                {isDeleting
                  ? t('settings.deleteAccountDeleting') || 'Deleting...'
                  : t('settings.deleteAccountConfirmAction') ||
                    'Delete Account Permanently'}
              </Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>
    </>
  );
}
