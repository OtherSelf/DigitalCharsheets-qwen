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
      setError(t('phraseMinLength') || 'Recovery phrase must be at least 5 characters.');
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
        setError(data.error || (t('phraseUpdateFailed') || 'Failed to update phrase.'));
      }
    } catch (err) {
      setError(t('serverConnectionFailed') || 'Failed to connect to server.');
    } finally {
      setIsSaving(false);
    }
  };

  // LANDMARK: Changed type from React.MouseEvent to Event to match Radix UI's onSelect signature
  const openPhraseDialog = (e: Event) => {
    e.preventDefault();
    
    if (typeof document !== 'undefined' && document.activeElement instanceof HTMLElement) {
      document.activeElement.blur();
    }
    
    setPhraseDialogOpen(true);
  };

  if (isUserLoading) return <Skeleton className="h-9 w-9 rounded-full" />;
  if (!user) return <Button asChild><Link href="/login">{t('signIn') || 'Sign In'}</Link></Button>;

  return (
    <>
      <DropdownMenu>
        <DropdownMenuTrigger asChild>
          <Button variant="ghost" size="icon" className="h-9 w-9 rounded-full">
            <CircleUserRound className="h-6 w-6" />
            <span className="sr-only">{t('openUserMenu') || 'Open user menu'}</span>
          </Button>
        </DropdownMenuTrigger>
        <DropdownMenuContent className="w-56" align="end" forceMount>
          <DropdownMenuLabel className="font-normal">
            <div className="flex flex-col space-y-1">
              <p className="text-sm font-medium leading-none">{user.displayName || (t('user') || 'User')}</p>
              <p className="text-xs text-muted-foreground">{user.email}</p>
            </div>
          </DropdownMenuLabel>
          <DropdownMenuSeparator />
          
          <DropdownMenuItem onSelect={openPhraseDialog}>
            <KeyRound className="mr-2 h-4 w-4" />
            {user.hasRecoveryPhrase ? (t('changeRecoveryPhrase') || 'Change Recovery Phrase') : (t('addRecoveryPhrase') || 'Add Recovery Phrase')}
          </DropdownMenuItem>
          
          <DropdownMenuSeparator />
          <DropdownMenuItem onClick={logout}>{t('logout') || 'Log out'}</DropdownMenuItem>
        </DropdownMenuContent>
      </DropdownMenu>

      <Dialog open={phraseDialogOpen} onOpenChange={setPhraseDialogOpen}>
        <DialogContent className="sm:max-w-[425px]">
          <DialogHeader>
            <DialogTitle>{user.hasRecoveryPhrase ? (t('changeRecoveryPhrase') || 'Change Recovery Phrase') : (t('addRecoveryPhrase') || 'Add Recovery Phrase')}</DialogTitle>
            <DialogDescription>
              {t('recoveryPhraseDesc') || 'Set a memorable phrase to recover your account if you forget your password.'}
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-4 py-4">
            <Input 
              placeholder={t('enterRecoveryPhrase') || 'Enter recovery phrase'} 
              value={newPhrase} 
              onChange={(e) => {
                setNewPhrase(e.target.value);
                setError('');
              }} 
            />
            {error && <p className="text-sm text-destructive">{error}</p>}
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setPhraseDialogOpen(false)}>
              {t('cancel') || 'Cancel'}
            </Button>
            <Button onClick={handleSavePhrase} disabled={isSaving}>
              {isSaving ? (t('saving') || 'Saving...') : (t('savePhrase') || 'Save Phrase')}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  );
}