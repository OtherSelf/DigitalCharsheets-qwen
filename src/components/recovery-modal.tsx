'use client';

import { useState, useEffect } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import { useLocalAuth } from '@/context/local-auth-context';
import {
  Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle,
} from '@/components/ui/dialog';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import { Alert, AlertDescription } from '@/components/ui/alert';

export function RecoveryModal() {
  const router = useRouter();
  const searchParams = useSearchParams();
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
        setError('Recovery phrase must be at least 5 characters.');
        return;
      }
      setIsLoading(true);
      try {
        const res = await fetch('/api/auth/phrase', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ username: user?.username, phrase: newRecoveryPhrase }),
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
          setError(data.error || 'Failed to update phrase.');
        }
      } catch (err) {
        setError('Failed to connect to server.');
      } finally {
        setIsLoading(false);
      }
    } else {
      // Recovery mode
      if (!newPassword || !newRecoveryPhrase) {
        setError('Please fill in all fields.');
        return;
      }
      if (newPassword.length < 4) {
        setError('Password must be at least 4 characters.');
        return;
      }
      if (newRecoveryPhrase.trim().length < 5) {
        setError('Recovery phrase must be at least 5 characters.');
        return;
      }

      setIsLoading(true);
      try {
        const res = await fetch('/api/auth/recover/update', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ username: user?.username, newPassword, newRecoveryPhrase }),
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
          setError(data.error || 'Failed to update credentials.');
        }
      } catch (err) {
        setError('Failed to connect to server.');
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
          <DialogTitle>{isRecovery ? 'Reset Credentials' : 'Secure Your Account'}</DialogTitle>
          <DialogDescription>
            {isRecovery
              ? 'You have successfully verified your identity. Please set a new password and a new recovery phrase to complete the process.'
              : 'Welcome! Please set up a recovery phrase to secure your account in case you forget your password.'}
          </DialogDescription>
        </DialogHeader>
        <form onSubmit={handleSubmit} className="space-y-4 py-4">
          {error && <Alert variant="destructive"><AlertDescription>{error}</AlertDescription></Alert>}
          
          {isRecovery && (
            <div className="space-y-2">
              <label className="text-sm font-medium">New Password</label>
              <Input type="password" value={newPassword} onChange={(e) => setNewPassword(e.target.value)} placeholder="••••••••" required />
            </div>
          )}
          
          <div className="space-y-2">
            <label className="text-sm font-medium">{isRecovery ? 'New Recovery Phrase' : 'Recovery Phrase'}</label>
            <Input value={newRecoveryPhrase} onChange={(e) => setNewRecoveryPhrase(e.target.value)} placeholder="e.g., french butter dragon" required />
            <p className="text-xs text-muted-foreground">Make it memorable! You can use the same phrase as before if you wish.</p>
          </div>
          
          <DialogFooter>
            <Button type="submit" disabled={isLoading}>
              {isLoading ? 'Saving...' : (isRecovery ? 'Save & Continue' : 'Save Phrase')}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}