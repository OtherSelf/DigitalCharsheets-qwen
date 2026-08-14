'use client';

import { useState } from 'react';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
  DialogFooter,
} from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Checkbox } from '@/components/ui/checkbox';
import { useTranslation } from '@/context/language-context';
import { useCharacterContext } from '@/context/character-context';
import { useToast } from '@/hooks/use-toast';
import { initializeApp, deleteApp } from 'firebase/app';
import { getAuth, signInWithEmailAndPassword } from 'firebase/auth';
import { getFirestore, collection, getDocs, query } from 'firebase/firestore';
import { firebaseConfig } from '@/firebase/config';
import { Loader } from '../loader';
import { MoveRight, RefreshCcw } from 'lucide-react';
import { type Character } from '@/lib/types';

export function MigrateCharacterDialog({ children }: { children: React.ReactNode }) {
  const { t } = useTranslation();
  const { addCharacter } = useCharacterContext();
  const { toast } = useToast();
  
  const [isOpen, setIsOpen] = useState(false);
  const [step, setStep] = useState<'credentials' | 'selection'>('credentials');
  const [isLoading, setIsLoading] = useState(false);
  
  const [username, setUsername] = useState('');
  const [password, setPassword] = useState('');
  
  const [legacyCharacters, setLegacyCharacters] = useState<Character[]>([]);
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set());

  const reset = () => {
    setStep('credentials');
    setUsername('');
    setPassword('');
    setLegacyCharacters([]);
    setSelectedIds(new Set());
    setIsLoading(false);
  };

  const handleVerify = async () => {
    if (!username || !password) return;
    setIsLoading(true);
    
    // Create temporary secondary app to authenticate legacy user
    const appName = `migration-${Date.now()}`;
    let tempApp;
    
    try {
      tempApp = initializeApp(firebaseConfig, appName);
      const tempAuth = getAuth(tempApp);
      const tempDb = getFirestore(tempApp);
      
      const email = `${username}@verse-scribe.app`;
      const userCredential = await signInWithEmailAndPassword(tempAuth, email, password);
      
      const q = query(collection(tempDb, 'users', userCredential.user.uid, 'characterSheets'));
      const snapshot = await getDocs(q);
      
      const chars = snapshot.docs.map(doc => ({ ...doc.data(), id: doc.id } as Character));
      
      if (chars.length === 0) {
        toast({
          title: t('migrateTitle'),
          description: t('noLegacyCharacters'),
        });
      } else {
        setLegacyCharacters(chars);
        setStep('selection');
      }
    } catch (error) {
      console.error('Migration verification error:', error);
      toast({
        variant: 'destructive',
        title: t('importFailed'),
        description: 'Please verify your legacy username and password.',
      });
    } finally {
      setIsLoading(false);
      if (tempApp) await deleteApp(tempApp);
    }
  };

  const handleMigrate = async () => {
    setIsLoading(true);
    try {
      const targets = legacyCharacters.filter(c => selectedIds.has(c.id));
      
      for (const char of targets) {
        // Prepare character for import (remove old ID and UserID)
        const { id, userId, ...characterData } = char;
        await addCharacter(characterData);
      }
      
      toast({
        title: t('importSuccess'),
        description: `${targets.length} characters copied to your Google account.`,
      });
      setIsOpen(false);
      reset();
    } catch (error) {
      console.error('Migration process error:', error);
      toast({
        variant: 'destructive',
        title: 'Migration Failed',
        description: 'An error occurred while copying characters.',
      });
    } finally {
      setIsLoading(false);
    }
  };

  const toggleSelection = (id: string) => {
    const next = new Set(selectedIds);
    if (next.has(id)) next.delete(id);
    else next.add(id);
    setSelectedIds(next);
  };

  return (
    <Dialog open={isOpen} onOpenChange={(open) => { setIsOpen(open); if(!open) reset(); }}>
      <DialogTrigger asChild>{children}</DialogTrigger>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <RefreshCcw className="h-5 w-5" />
            {t('migrateTitle')}
          </DialogTitle>
          <DialogDescription>
            {t('migrateDesc')}
          </DialogDescription>
        </DialogHeader>

        {step === 'credentials' ? (
          <div className="space-y-4 py-4">
            <div className="space-y-2">
              <Label htmlFor="legacy-username">{t('legacyUsername')}</Label>
              <Input 
                id="legacy-username" 
                placeholder="Legacy username" 
                value={username}
                onChange={(e) => setUsername(e.target.value)}
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="legacy-password">{t('legacyPassword')}</Label>
              <Input 
                id="legacy-password" 
                type="password" 
                placeholder="••••••••" 
                value={password}
                onChange={(e) => setPassword(e.target.value)}
              />
            </div>
            <Button 
              className="w-full" 
              onClick={handleVerify} 
              disabled={isLoading || !username || !password}
            >
              {isLoading ? <Loader className="mr-2 h-4 w-4" /> : null}
              {t('verifyAccount')}
            </Button>
          </div>
        ) : (
          <div className="space-y-4 py-4">
            <Label>{t('selectCharacters')}</Label>
            <div className="max-h-[300px] overflow-y-auto border rounded-md p-2 space-y-2 bg-muted/30">
              {legacyCharacters.map((char) => (
                <div key={char.id} className="flex items-center space-x-2 p-2 rounded hover:bg-muted transition-colors">
                  <Checkbox 
                    id={`char-${char.id}`} 
                    checked={selectedIds.has(char.id)}
                    onCheckedChange={() => toggleSelection(char.id)}
                  />
                  <label htmlFor={`char-${char.id}`} className="flex-1 text-sm font-medium cursor-pointer">
                    <div className="font-bold">{char.name}</div>
                    <div className="text-xs text-muted-foreground">{char.gameSystem} | {char.characterClass}</div>
                  </label>
                </div>
              ))}
            </div>
            <Button 
              className="w-full" 
              onClick={handleMigrate} 
              disabled={isLoading || selectedIds.size === 0}
            >
              {isLoading ? <Loader className="mr-2 h-4 w-4" /> : <MoveRight className="mr-2 h-4 w-4" />}
              {t('migrateButton')} ({selectedIds.size})
            </Button>
          </div>
        )}
      </DialogContent>
    </Dialog>
  );
}
