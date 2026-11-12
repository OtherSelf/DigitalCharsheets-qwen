'use client';

import { useEffect, useState } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';

import { Alert, AlertDescription } from '@/components/ui/alert';
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
import { useTranslation } from '@/context/language-context';
import { useLocalAuth } from '@/context/local-auth-context';

/**
 * ─── LANDMARK: RECOVERY PHRASE SETUP ────────────────────────────────────────
 * Модалка «задайте фразу восстановления» для вошедшего пользователя.
 *
 * Восстановление доступа к забытому паролю живёт на /login (два шага: фраза →
 * одноразовый токен → новые пароль и фраза) и сессию не использует: проверка
 * фразы намеренно не выдаёт cookie, поэтому отдельный «восстановительный»
 * режим этой модалки не нужен.
 */
export function RecoveryModal() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const { t } = useTranslation();
  const { user, updateUserPhrase } = useLocalAuth();

  const [newRecoveryPhrase, setNewRecoveryPhrase] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState('');
  const [isOpen, setIsOpen] = useState(false);
  const [isMounted, setIsMounted] = useState(false);
  /* Once the user closes the prompt, it must not reopen on every route or
     query change: the flag is reset only when the account changes. */
  const [hasShownModal, setHasShownModal] = useState(false);

  useEffect(() => {
    setIsMounted(true);
  }, []);

  // Another account's draft must not leak into this one.
  useEffect(() => {
    if (user) {
      setNewRecoveryPhrase('');
      setError('');
      setHasShownModal(false);
    }
  }, [user?.username]);

  // Open the prompt when the profile misses a phrase or the URL asks for it;
  // any other navigation closes a stale dialog.
  useEffect(() => {
    if (isMounted && user) {
      const needsSetup = !user.hasRecoveryPhrase;
      const isSetupParam = searchParams.get('setup_phrase') === 'true';

      // Guard against searchParams churn: a closed prompt must not reopen.
      if ((needsSetup || isSetupParam) && !hasShownModal) {
        setIsOpen(true);
        setHasShownModal(true);
      } else if (!needsSetup && !isSetupParam) {
        setIsOpen(false);
      }
    }
  }, [isMounted, user, searchParams, hasShownModal]);

  const handleOpenChange = (open: boolean) => {
    if (!open) {
      setIsOpen(false);
      // Reopening must start from a clean draft, not the last attempt.
      setNewRecoveryPhrase('');
      setError('');

      // Clean URL
      setTimeout(() => {
        router.replace(window.location.pathname, { scroll: false });
      }, 100);
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    e.stopPropagation();
    setError('');

    if (!newRecoveryPhrase || newRecoveryPhrase.trim().length < 5) {
      setError(t('auth.phraseMinLength'));
      return;
    }

    setIsLoading(true);
    try {
      const res = await fetch('/api/auth/phrase', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ phrase: newRecoveryPhrase }),
      });
      const data = await res.json();
      if (data.success) {
        updateUserPhrase(true);
        setIsOpen(false);
        // The saved values are no longer a draft: drop them before the
        // modal can be opened again.
        setNewRecoveryPhrase('');
        setError('');

        setTimeout(() => {
          router.replace(window.location.pathname, { scroll: false });
        }, 100);
      } else {
        setError(data.error || t('auth.phraseUpdateFailed'));
      }
    } catch {
      setError(t('common.serverConnectionFailed'));
    } finally {
      setIsLoading(false);
    }
  };

  if (!isMounted) return null;

  return (
    <Dialog open={isOpen} onOpenChange={handleOpenChange}>
      <DialogContent className="sm:max-w-[425px]">
        <DialogHeader>
          <DialogTitle>{t('auth.secureAccountTitle')}</DialogTitle>
          <DialogDescription>{t('auth.secureAccountDesc')}</DialogDescription>
        </DialogHeader>
        <form onSubmit={handleSubmit} className="space-y-4 py-4">
          {error && (
            <Alert variant="destructive">
              <AlertDescription>{error}</AlertDescription>
            </Alert>
          )}

          <div className="space-y-2">
            <label htmlFor="recovery-phrase" className="text-sm font-medium">
              {t('auth.recoveryPhraseLabel')}
            </label>
            <Input
              id="recovery-phrase"
              value={newRecoveryPhrase}
              onChange={(e) => setNewRecoveryPhrase(e.target.value)}
              placeholder={t('auth.phraseExample')}
              autoComplete="off"
              required
            />
            <p className="text-muted-foreground text-xs">
              {t('auth.phraseHint')}
            </p>
          </div>

          <DialogFooter>
            <Button type="submit" disabled={isLoading}>
              {isLoading ? t('common.saving') : t('auth.savePhrase')}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
