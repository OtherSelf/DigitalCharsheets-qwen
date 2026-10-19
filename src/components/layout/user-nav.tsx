'use client';

import { useState } from 'react';
import { Button } from "@/components/ui/button";
import {
  DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuLabel, DropdownMenuSeparator, DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import {
  Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Skeleton } from "../ui/skeleton";
import Link from "next/link";
import { useLocalAuth } from "@/context/local-auth-context";
import { CircleUserRound, KeyRound } from "lucide-react";
import { useTranslation } from '@/context/language-context';

export function UserNav() {
  const { user, isUserLoading, logout, updateUserPhrase } = useLocalAuth();
  const { t } = useTranslation();
  const [phraseDialogOpen, setPhraseDialogOpen] = useState(false);
  const [newPhrase, setNewPhrase] = useState('');
  const [isSaving, setIsSaving] = useState(false);
  const [error, setError] = useState('');

  const handleSavePhrase = async () => {
    if (newPhrase.trim().length < 5) {
      setError(t('phraseMinLength'));
      return;
    }
    setIsSaving(true);
    setError('');
    try {
      const res = await fetch('/api/auth/phrase', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email: user?.email, phrase: newPhrase }),
      });
      const data = await res.json();
      if (data.success) {
        updateUserPhrase(true);
        setPhraseDialogOpen(false);
        setNewPhrase('');
      } else {
        setError(data.error || t('phraseUpdateFailed'));
      }
    } catch (err) {
      setError(t('serverConnectionFailed'));
    } finally {
      setIsSaving(false);
    }
  };

  if (isUserLoading) return <Skeleton className="h-9 w-9 rounded-full" />;
  if (!user) return <Button asChild><Link href="/login">{t('signIn')}</Link></Button>;

  return (
    <>
      <DropdownMenu>
        <DropdownMenuTrigger asChild>
          <Button variant="ghost" size="icon" className="h-9 w-9 rounded-full">
            <CircleUserRound className="h-6 w-6" />
            <span className="sr-only">{t('openUserMenu')}</span>
          </Button>
        </DropdownMenuTrigger>
        <DropdownMenuContent className="w-56" align="end" forceMount>
          <DropdownMenuLabel className="font-normal">
            <div className="flex flex-col space-y-1">
              <p className="text-sm font-medium leading-none">{user.displayName || t('user')}</p>
              <p className="text-xs text-muted-foreground">{user.email}</p>
            </div>
          </DropdownMenuLabel>
          <DropdownMenuSeparator />
          <DropdownMenuItem onClick={() => setPhraseDialogOpen(true)}>
            <KeyRound className="mr-2 h-4 w-4" />
            {user.hasRecoveryPhrase ? t('changeRecoveryPhrase') : t('addRecoveryPhrase')}
          </DropdownMenuItem>
          <DropdownMenuSeparator />
          <DropdownMenuItem onClick={logout}>{t('logout')}</DropdownMenuItem>
        </DropdownMenuContent>
      </DropdownMenu>

      <Dialog open={phraseDialogOpen} onOpenChange={setPhraseDialogOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>{user.hasRecoveryPhrase ? t('changeRecoveryPhrase') : t('addRecoveryPhrase')}</DialogTitle>
            <DialogDescription>
              {t('recoveryPhraseDesc')}
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-4 py-4">
            <Input placeholder={t('enterRecoveryPhrase')} value={newPhrase} onChange={(e) => setNewPhrase(e.target.value)} />
            {error && <p className="text-sm text-destructive">{error}</p>}
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setPhraseDialogOpen(false)}>{t('cancel')}</Button>
            <Button onClick={handleSavePhrase} disabled={isSaving}>{isSaving ? t('saving') : t('savePhrase')}</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  );
}