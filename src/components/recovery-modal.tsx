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

export function RecoveryModal() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const { t } = useTranslation();
  const { user, updateUserPhrase } = useLocalAuth();

  const [newPassword, setNewPassword] = useState('');
  const [newRecoveryPhrase, setNewRecoveryPhrase] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState('');
  const [isOpen, setIsOpen] = useState(false);
  const [isMounted, setIsMounted] = useState(false);
  const [hasShownModal, setHasShownModal] = useState(false); // LANDMARK: Track if we've shown the modal

  useEffect(() => {
    setIsMounted(true);
  }, []);

  const isRecovery = searchParams.get('recovery_mode') === 'true';

  // LANDMARK: Reset form state when user changes to prevent stale data
  useEffect(() => {
    if (user) {
      setNewPassword('');
      setNewRecoveryPhrase('');
      setError('');
      setHasShownModal(false); // Reset flag when user changes
    }
  }, [user?.username]); // Only reset when user changes (different user)

  // LANDMARK: Sync dialog state with actual user data
  useEffect(() => {
    if (isMounted && user) {
      const needsSetup = !user.hasRecoveryPhrase;
      const isSetupParam = searchParams.get('setup_phrase') === 'true';

      // LANDMARK: Only show modal once per user session to prevent double-showing
      if ((needsSetup || isSetupParam || isRecovery) && !hasShownModal) {
        setIsOpen(true);
        setHasShownModal(true);
      } else if (!needsSetup && !isSetupParam && !isRecovery) {
        setIsOpen(false);
      }
    }
  }, [isMounted, user, searchParams, isRecovery, hasShownModal]);

  const handleOpenChange = (open: boolean) => {
    if (!open) {
      setIsOpen(false);
      // LANDMARK: Clean up form state when closing
      setNewPassword('');
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

    const isSetup = !isRecovery;

    if (isSetup) {
      if (!newRecoveryPhrase || newRecoveryPhrase.trim().length < 5) {
        setError(t('phraseMinLength'));
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
          // LANDMARK: Clean up form state
          setNewPassword('');
          setNewRecoveryPhrase('');
          setError('');

          setTimeout(() => {
            router.replace(window.location.pathname, { scroll: false });
          }, 100);
        } else {
          setError(data.error || t('phraseUpdateFailed'));
        }
      } catch (err) {
        setError(t('serverConnectionFailed'));
      } finally {
        setIsLoading(false);
      }
    } else {
      // Recovery mode
      if (!newPassword || !newRecoveryPhrase) {
        setError(t('authFillAllFields'));
        return;
      }
      if (newPassword.length < 4) {
        setError(t('passwordMinLength'));
        return;
      }
      if (newRecoveryPhrase.trim().length < 5) {
        setError(t('phraseMinLength'));
        return;
      }

      setIsLoading(true);
      try {
        const res = await fetch('/api/auth/recover/update', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            username: user?.username,
            newPassword,
            newRecoveryPhrase,
          }),
        });
        const data = await res.json();
        if (data.success) {
          updateUserPhrase(true);
          setIsOpen(false);
          // LANDMARK: Clean up form state
          setNewPassword('');
          setNewRecoveryPhrase('');
          setError('');

          setTimeout(() => {
            router.replace(window.location.pathname, { scroll: false });
          }, 100);
        } else {
          setError(data.error || t('credentialsUpdateFailed'));
        }
      } catch (err) {
        setError(t('serverConnectionFailed'));
      } finally {
        setIsLoading(false);
      }
    }
  };

  if (!isMounted) return null;

  return (
    <Dialog open={isOpen} onOpenChange={handleOpenChange}>
      <DialogContent className="sm:max-w-[425px]">
        <DialogHeader>
          <DialogTitle>
            {isRecovery ? t('resetCredentialsTitle') : t('secureAccountTitle')}
          </DialogTitle>
          <DialogDescription>
            {isRecovery ? t('resetCredentialsDesc') : t('secureAccountDesc')}
          </DialogDescription>
        </DialogHeader>
        <form onSubmit={handleSubmit} className="space-y-4 py-4">
          {error && (
            <Alert variant="destructive">
              <AlertDescription>{error}</AlertDescription>
            </Alert>
          )}

          {isRecovery && (
            <div className="space-y-2">
              <label
                htmlFor="recovery-new-password"
                className="text-sm font-medium"
              >
                {t('newPassword')}
              </label>
              <Input
                id="recovery-new-password"
                type="password"
                value={newPassword}
                onChange={(e) => setNewPassword(e.target.value)}
                placeholder="••••••••"
                required
              />
            </div>
          )}

          <div className="space-y-2">
            <label htmlFor="recovery-phrase" className="text-sm font-medium">
              {isRecovery ? t('recoveryPhrase') : t('authRecoveryPhraseLabel')}
            </label>
            <Input
              id="recovery-phrase"
              value={newRecoveryPhrase}
              onChange={(e) => setNewRecoveryPhrase(e.target.value)}
              placeholder={t('recoveryPhraseExample')}
              required
            />
            <p className="text-muted-foreground text-xs">
              {t('recoveryPhraseHint')}
            </p>
          </div>

          <DialogFooter>
            <Button type="submit" disabled={isLoading}>
              {isLoading
                ? t('saving')
                : isRecovery
                  ? t('saveAndContinue')
                  : t('savePhrase')}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
