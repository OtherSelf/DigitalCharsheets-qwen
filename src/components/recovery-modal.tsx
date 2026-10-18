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
  
  const [isOpen, setIsOpen] = useState(false);
  const [newPassword, setNewPassword] = useState('');
  const [newRecoveryPhrase, setNewRecoveryPhrase] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState('');

  const isSetup = searchParams.get('setup_phrase') === 'true';
  const isRecovery = searchParams.get('recovery_mode') === 'true';

  useEffect(() => {
    if (isSetup || isRecovery) {
      setIsOpen(true);
    }
  }, [isSetup, isRecovery]);

  const handleClose = () => {
    setIsOpen(false);
    router.replace('/'); // Clean the URL
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');
    
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
          body: JSON.stringify({ email: user?.email, phrase: newRecoveryPhrase }),
        });
        const data = await res.json();
        if (data.success) {
          updateUserPhrase(true);
          handleClose();
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
          body: JSON.stringify({ email: user?.email, newPassword, newRecoveryPhrase }),
        });
        const data = await res.json();
        if (data.success) {
          updateUserPhrase(true);
          handleClose();
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

  return (
    <Dialog open={isOpen} onOpenChange={(open) => { if (!open) handleClose(); }}>
      <DialogContent className="sm:max-w-[425px]">
        <DialogHeader>
          <DialogTitle>{isSetup ? 'Secure Your Account' : 'Reset Credentials'}</DialogTitle>
          <DialogDescription>
            {isSetup 
              ? 'Welcome! Please set up a recovery phrase to secure your account in case you forget your password.' 
              : 'You have successfully verified your identity. Please set a new password and a new recovery phrase to complete the process.'}
          </DialogDescription>
        </DialogHeader>
        <form onSubmit={handleSubmit} className="space-y-4 py-4">
          {error && <Alert variant="destructive"><AlertDescription>{error}</AlertDescription></Alert>}
          
          {!isSetup && (
            <div className="space-y-2">
              <label className="text-sm font-medium">New Password</label>
              <Input type="password" value={newPassword} onChange={(e) => setNewPassword(e.target.value)} placeholder="••••••••" required />
            </div>
          )}
          
          <div className="space-y-2">
            <label className="text-sm font-medium">{isSetup ? 'Recovery Phrase' : 'New Recovery Phrase'}</label>
            <Input value={newRecoveryPhrase} onChange={(e) => setNewRecoveryPhrase(e.target.value)} placeholder="e.g., french butter dragon" required />
            <p className="text-xs text-muted-foreground">Make it memorable! You can use the same phrase as before if you wish.</p>
          </div>
          
          <DialogFooter>
            <Button type="submit" disabled={isLoading}>
              {isLoading ? 'Saving...' : (isSetup ? 'Save Phrase' : 'Save & Continue')}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}