'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';

import { LogOut } from 'lucide-react';

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
import { useTranslation } from '@/context/language-context';
import { useLocalAuth } from '@/context/local-auth-context';

/**
 * ─── LANDMARK: SESSIONS CARD ────────────────────────────────────────────────
 * «Выйти на всех устройствах»: гасит все живые сессии аккаунта на сервере, а
 * не только стирает cookie в этом браузере. Нужно, когда устройство потеряно
 * или пароль мог утечь.
 *
 * Действие необратимо для других вкладок, поэтому подтверждается диалогом (по
 * образцу «опасной зоны»): после подтверждения сервер отзывает сессии, cookie
 * стирается, приложение уходит на главную как гость.
 */
export function SessionsCard() {
  const router = useRouter();
  const { t } = useTranslation();
  const { user, logoutEverywhere } = useLocalAuth();

  const [isOpen, setIsOpen] = useState(false);
  const [isPending, setIsPending] = useState(false);
  const [error, setError] = useState('');

  if (!user) return null;

  const handleConfirm = async () => {
    setIsPending(true);
    setError('');
    const ok = await logoutEverywhere();
    setIsPending(false);
    if (!ok) {
      setError(t('settings.signOutEverywhereFailed'));
      return;
    }
    setIsOpen(false);
    router.push('/');
  };

  return (
    <Card>
      <CardHeader>
        <CardTitle>{t('settings.sessionsTitle')}</CardTitle>
        <CardDescription>{t('settings.sessionsDescription')}</CardDescription>
      </CardHeader>
      <CardContent>
        <Button
          type="button"
          variant="outline"
          onClick={() => {
            setError('');
            setIsOpen(true);
          }}
        >
          <LogOut className="mr-2 h-4 w-4" />
          {t('settings.signOutEverywhere')}
        </Button>
      </CardContent>

      <Dialog open={isOpen} onOpenChange={setIsOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>{t('settings.signOutEverywhereTitle')}</DialogTitle>
            <DialogDescription>
              {t('settings.signOutEverywhereDescription')}
            </DialogDescription>
          </DialogHeader>

          {error && <p className="text-destructive text-sm">{error}</p>}

          <DialogFooter>
            <Button
              type="button"
              variant="outline"
              onClick={() => setIsOpen(false)}
              disabled={isPending}
            >
              {t('common.cancel')}
            </Button>
            <Button
              type="button"
              variant="destructive"
              onClick={handleConfirm}
              disabled={isPending}
            >
              {isPending ? t('common.saving') : t('settings.signOutEverywhere')}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </Card>
  );
}
