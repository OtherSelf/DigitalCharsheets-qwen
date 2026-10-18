'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { useLocalAuth } from '@/context/local-auth-context';
import { setLocalUser } from '@/lib/local-storage';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { Scroll, Lock, Mail, LogIn, KeyRound, ArrowLeft } from 'lucide-react';

export default function LoginPage() {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState('');
  const [successMessage, setSuccessMessage] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [mode, setMode] = useState<'login' | 'recover'>('login');

  const [word1, setWord1] = useState('');
  const [word2, setWord2] = useState('');
  const [word3, setWord3] = useState('');
  const [recoveryPhraseInput, setRecoveryPhraseInput] = useState('');

  const { login, setUser } = useLocalAuth();
  const router = useRouter();

  const handleLogin = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');
    setSuccessMessage('');
    if (!email || !password) {
      setError('Please enter both email and password.');
      return;
    }

    setIsLoading(true);
    const result = await login(email, password);
    if (result.success) {
      if (result.isNewUser || !result.user?.hasRecoveryPhrase) {
        router.push('/?setup_phrase=true');
      } else {
        router.push('/');
      }
    } else {
      setError(result.error || 'Login failed.');
      setIsLoading(false);
    }
  };

  const handleRecoveryVerify = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');
    if (!email || !word1 || !word2 || !word3 || !recoveryPhraseInput) {
      setError('Please fill in all fields.');
      return;
    }

    setIsLoading(true);
    try {
      const res = await fetch('/api/auth/recover/verify', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email, word1, word2, word3, recoveryPhraseInput }),
      });
      const data = await res.json();

      if (data.success) {
        setLocalUser(data.user);
        setUser(data.user);
        router.push('/?recovery_mode=true');
      } else {
        setError(data.error || 'Verification failed.');
      }
    } catch (err) {
      setError('Failed to connect to server.');
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <div className="flex items-center justify-center min-h-screen bg-gradient-to-br from-background via-background to-primary/5 p-4">
      <div className="w-full max-w-md">
        <div className="text-center mb-8">
          <div className="inline-flex items-center justify-center w-16 h-16 rounded-full bg-primary/10 border border-primary/20 mb-4">
            <Scroll className="w-8 h-8 text-primary" />
          </div>
          <h1 className="text-3xl font-headline font-bold tracking-tight">Digital Character Sheets</h1>
          <p className="text-muted-foreground mt-2">D&D 5e & Dark Heresy</p>
        </div>

        <Card className="shadow-lg border-primary/10">
          <CardHeader className="space-y-1 pb-4">
            <div className="flex items-center justify-between">
              <div>
                <CardTitle className="text-xl">{mode === 'login' ? 'Welcome Back' : 'Recover Account'}</CardTitle>
                <CardDescription>
                  {mode === 'login' 
                    ? 'New accounts are created automatically on first login.' 
                    : 'Prove ownership with 3 words from your sheets + your recovery phrase.'}
                </CardDescription>
              </div>
              {mode === 'recover' && (
                <Button variant="ghost" size="icon" onClick={() => { setMode('login'); setError(''); setSuccessMessage(''); }} title="Back to login">
                  <ArrowLeft className="h-4 w-4" />
                </Button>
              )}
            </div>
          </CardHeader>
          <CardContent>
            {mode === 'login' ? (
              <form onSubmit={handleLogin} className="space-y-4">
                {error && <Alert variant="destructive"><AlertDescription>{error}</AlertDescription></Alert>}
                {successMessage && <Alert className="border-green-500/50 bg-green-500/10 text-green-600 dark:text-green-400"><AlertDescription>{successMessage}</AlertDescription></Alert>}
                
                <div className="space-y-2">
                  <label className="text-sm font-medium flex items-center gap-2"><Mail className="h-4 w-4 text-muted-foreground" />Email</label>
                  <Input type="email" value={email} onChange={(e) => setEmail(e.target.value)} placeholder="your@email.com" required className="h-10" />
                </div>
                <div className="space-y-2">
                  <label className="text-sm font-medium flex items-center gap-2"><Lock className="h-4 w-4 text-muted-foreground" />Password</label>
                  <Input type="password" value={password} onChange={(e) => setPassword(e.target.value)} placeholder="••••••••" required className="h-10" />
                </div>
                <div className="flex items-center justify-between">
                  <Button type="button" variant="link" className="px-0 text-sm" onClick={() => { setMode('recover'); setError(''); setSuccessMessage(''); }}>Forgot password?</Button>
                </div>
                <Button type="submit" className="w-full h-10 mt-2" disabled={isLoading}>
                  {isLoading ? <span className="flex items-center gap-2"><span className="animate-spin h-4 w-4 border-2 border-current border-t-transparent rounded-full" />Processing...</span> : <span className="flex items-center gap-2"><LogIn className="h-4 w-4" />Sign Up / Log In</span>}
                </Button>
              </form>
            ) : (
              <form onSubmit={handleRecoveryVerify} className="space-y-4">
                {error && <Alert variant="destructive"><AlertDescription>{error}</AlertDescription></Alert>}
                
                <div className="space-y-2">
                  <label className="text-sm font-medium flex items-center gap-2"><Mail className="h-4 w-4 text-muted-foreground" />Account Email</label>
                  <Input type="email" value={email} onChange={(e) => setEmail(e.target.value)} placeholder="your@email.com" required className="h-10" />
                </div>
                
                <div className="space-y-3">
                  <label className="text-sm font-medium flex items-center gap-2"><KeyRound className="h-4 w-4 text-muted-foreground" />Three words from your sheets</label>
                  <Input value={word1} onChange={(e) => setWord1(e.target.value)} placeholder="Word 1 (e.g., Fighter)" required className="h-10" />
                  <Input value={word2} onChange={(e) => setWord2(e.target.value)} placeholder="Word 2 (e.g., Strength)" required className="h-10" />
                  <Input value={word3} onChange={(e) => setWord3(e.target.value)} placeholder="Word 3 (e.g., Longsword)" required className="h-10" />
                </div>

                <div className="space-y-2">
                  <label className="text-sm font-medium flex items-center gap-2"><Lock className="h-4 w-4 text-muted-foreground" />Your Recovery Phrase</label>
                  <Input value={recoveryPhraseInput} onChange={(e) => setRecoveryPhraseInput(e.target.value)} placeholder="e.g., french butter" required className="h-10" />
                  <p className="text-xs text-muted-foreground">Case-insensitive. Order doesn't matter. At least one word must match your original phrase.</p>
                </div>

                <Button type="submit" className="w-full h-10 mt-2" disabled={isLoading}>
                  {isLoading ? <span className="flex items-center gap-2"><span className="animate-spin h-4 w-4 border-2 border-current border-t-transparent rounded-full" />Verifying...</span> : <span className="flex items-center gap-2"><KeyRound className="h-4 w-4" />Verify & Continue</span>}
                </Button>
              </form>
            )}
            <p className="text-xs text-center text-muted-foreground mt-4">All data is stored locally on your server.</p>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}