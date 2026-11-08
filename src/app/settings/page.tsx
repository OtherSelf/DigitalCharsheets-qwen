// src/app/settings/page.tsx

'use client';

import { useState, useEffect } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import Link from 'next/link';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Card, CardContent, CardDescription, CardFooter, CardHeader, CardTitle } from '@/components/ui/card';
import { Separator } from '@/components/ui/separator';
import { useLocalAuth } from '@/context/local-auth-context';
import { useTranslation } from '@/context/language-context';
import { Home, Save, AlertCircle, Minus, Plus, RotateCcw, ArrowLeft } from 'lucide-react';
import { LanguageToggle } from '@/components/layout/language-toggle';
import { ThemeToggle } from '@/components/layout/theme-toggle';
import { useUISettings } from '@/hooks/use-ui-settings';

export default function ProfileSettingsPage() {
  const { user, isUserLoading, restoreSession } = useLocalAuth();
  const { t } = useTranslation();
  const router = useRouter();
  const searchParams = useSearchParams();
  
  // 🎯 LANDMARK: BACK_NAVIGATION_LOGIC
  const from = searchParams.get('from');
  const backTarget = (from && from.startsWith('/')) ? from : '/';
  const isFromDashboard = backTarget === '/';

  const {
    textScale,
    uiScale,
    updateTextScale,
    updateUiScale,
    resetSettings,
    minTextScale,
    maxTextScale,
    minUiScale,
    maxUiScale,
    isLoaded,
  } = useUISettings();

  const [displayName, setDisplayName] = useState('');
  const [username, setUsername] = useState('');
  const [password, setPassword] = useState('');
  const [recoveryPhrase, setRecoveryPhrase] = useState('');
  const [isSaving, setIsSaving] = useState(false);
  const [error, setError] = useState('');
  const [success, setSuccess] = useState('');

  useEffect(() => {
    if (!isUserLoading && !user) {
      router.push('/login');
    } else if (user) {
      setDisplayName(user.displayName || '');
      setUsername(user.username || '');
    }
  }, [user, isUserLoading, router]);

  const handleSave = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');
    setSuccess('');
    if (!user) return;

    if (password && password.length < 4) {
      setError(t('passwordMinLength') || 'Password must be at least 4 characters.');
      return;
    }

    setIsSaving(true);
    try {
      const res = await fetch('/api/auth/profile', {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          newUsername: username,
          newDisplayName: displayName,
          newPassword: password || undefined,
          newRecoveryPhrase: recoveryPhrase || undefined,
        }),
      });

      const data = await res.json();
      if (data.success) {
        restoreSession(data.user);
        setSuccess(t('settingsSaved') || 'Settings saved successfully!');
        setPassword('');
        setRecoveryPhrase('');
      } else {
        setError(data.error || (t('settingsSaveFailed') || 'Failed to save settings.'));
      }
    } catch (err) {
      setError(t('serverConnectionFailed') || 'Failed to connect to server.');
    } finally {
      setIsSaving(false);
    }
  };

  if (isUserLoading || !user || !isLoaded) return null;

  return (
    <div className="flex flex-col min-h-screen">
      <header className="sticky top-0 z-50 flex items-center justify-between gap-4 border-b bg-background/95 p-4 backdrop-blur supports-[backdrop-filter]:bg-background/60">
        <div className="flex items-center gap-4">
          
          {/* 🎯 LANDMARK: SETTINGS_BACK_BUTTON */}
          <Button 
            variant="ghost" 
            size="icon" 
            onClick={() => router.push(backTarget)}
            aria-label={isFromDashboard ? (t('backToDashboard') || 'Back to Dashboard') : (t('back') || 'Back')}
          >
            {isFromDashboard ? <Home className="h-5 w-5" /> : <ArrowLeft className="h-5 w-5" />}
          </Button>
          
          <h1 className="text-xl font-headline font-bold">{t('profileSettings') || 'Profile Settings'}</h1>
        </div>
        <div className="flex items-center gap-2">
          <LanguageToggle />
          <ThemeToggle />
        </div>
      </header>

      <main className="flex-1 overflow-y-auto p-4 md:p-8 safe-area-bottom">
        <div className="mx-auto max-w-2xl space-y-6">
          {error && (
            <div className="flex items-center gap-2 rounded-md bg-destructive/15 p-3 text-sm text-destructive">
              <AlertCircle className="h-4 w-4" />
              <span>{error}</span>
            </div>
          )}
          {success && (
            <div className="rounded-md bg-green-100 p-3 text-sm text-green-800 dark:bg-green-900/30 dark:text-green-300">
              {success}
            </div>
          )}

          <form onSubmit={handleSave} className="space-y-6">
            <Card>
              <CardHeader>
                <CardTitle>{t('generalInformation') || 'General Information'}</CardTitle>
                <CardDescription>{t('updateYourDisplayNameAndLogin') || 'Update your display name and login credentials.'}</CardDescription>
              </CardHeader>
              <CardContent className="space-y-4">
                <div className="space-y-2">
                  <Label htmlFor="displayName">{t('displayName') || 'Display Name'}</Label>
                  <Input id="displayName" value={displayName} onChange={(e) => setDisplayName(e.target.value)} placeholder="e.g. DungeonMaster" />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="username">{t('login') || 'Login (Email or Username)'}</Label>
                  <Input id="username" value={username} onChange={(e) => setUsername(e.target.value)} placeholder="e.g. user@example.com" />
                </div>
              </CardContent>
            </Card>

            {/* 🎯 LANDMARK: DISPLAY_SETTINGS_CARD */}
            <Card>
              <CardHeader>
                <CardTitle>{t('displaySettings') || 'Display Settings'}</CardTitle>
                <CardDescription>
                  {t('adjustUiAppearance') || 'Adjust text size and overall UI scale independently.'}
                </CardDescription>
              </CardHeader>
              <CardContent className="space-y-6">
                <div className="space-y-3">
                  <Label>{t('fontSize') || 'Text Size'}</Label>
                  <div className="flex items-center gap-3">
                    <Button
                      type="button"
                      variant="outline"
                      size="icon"
                      onClick={() => updateTextScale(textScale - 0.1)}
                      disabled={textScale <= minTextScale}
                      aria-label="Decrease text size"
                    >
                      <Minus className="h-4 w-4" />
                    </Button>
                    <div className="flex-1 text-center font-medium tabular-nums">
                      {Math.round(textScale * 100)}% ({(12 * textScale).toFixed(1)} pt)
                    </div>
                    <Button
                      type="button"
                      variant="outline"
                      size="icon"
                      onClick={() => updateTextScale(textScale + 0.1)}
                      disabled={textScale >= maxTextScale}
                      aria-label="Increase text size"
                    >
                      <Plus className="h-4 w-4" />
                    </Button>
                  </div>
                  <p className="text-xs text-muted-foreground">
                    {t('minFontSizeWarning') || 'Minimum 8pt. Boxes, padding and spacing stay unchanged.'}
                  </p>
                </div>

                <Separator />

                <div className="space-y-3">
                  <Label>{t('uiScale') || 'UI Scale'}</Label>
                  <div className="flex items-center gap-3">
                    <Button
                      type="button"
                      variant="outline"
                      size="icon"
                      onClick={() => updateUiScale(uiScale - 0.1)}
                      disabled={uiScale <= minUiScale}
                      aria-label="Decrease UI scale"
                    >
                      <Minus className="h-4 w-4" />
                    </Button>
                    <div className="flex-1 text-center font-medium tabular-nums">
                      {Math.round(uiScale * 100)}%
                    </div>
                    <Button
                      type="button"
                      variant="outline"
                      size="icon"
                      onClick={() => updateUiScale(uiScale + 0.1)}
                      disabled={uiScale >= maxUiScale}
                      aria-label="Increase UI scale"
                    >
                      <Plus className="h-4 w-4" />
                    </Button>
                  </div>
                  <p className="text-xs text-muted-foreground">
                    {t('uiScaleWarning') || 'Range: 50% to 150%. Scales the whole interface.'}
                  </p>
                </div>

                <div className="pt-2">
                  <Button type="button" variant="secondary" onClick={resetSettings} className="w-full sm:w-auto">
                    <RotateCcw className="mr-2 h-4 w-4" />
                    {t('resetToDefaults') || 'Reset to Defaults'}
                  </Button>
                </div>
              </CardContent>
            </Card>

            <Card>
              <CardHeader>
                <CardTitle>{t('security') || 'Security'}</CardTitle>
                <CardDescription>{t('updatePasswordAndRecovery') || 'Update your password and recovery phrase.'}</CardDescription>
              </CardHeader>
              <CardContent className="space-y-4">
                <div className="space-y-2">
                  <Label htmlFor="password">{t('newPassword') || 'New Password'}</Label>
                  <Input
                    id="password"
                    type="password"
                    value={password}
                    onChange={(e) => setPassword(e.target.value)}
                    placeholder={t('leaveBlankToKeepCurrent') || 'Leave blank to keep current password'}
                  />
                </div>
                <Separator />
                <div className="space-y-2">
                  <Label htmlFor="recoveryPhrase">{t('recoveryPhrase') || 'Recovery Phrase'}</Label>
                  <Input
                    id="recoveryPhrase"
                    value={recoveryPhrase}
                    onChange={(e) => setRecoveryPhrase(e.target.value)}
                    placeholder={user.hasRecoveryPhrase ? (t('updateRecoveryPhrase') || 'Enter new recovery phrase') : (t('addRecoveryPhrase') || 'Add recovery phrase')}
                  />
                </div>
              </CardContent>
              <CardFooter>
                <Button type="submit" className="w-full" disabled={isSaving}>
                  {isSaving ? (t('saving') || 'Saving...') : (
                    <>
                      <Save className="mr-2 h-4 w-4" />
                      {t('saveChanges') || 'Save Changes'}
                    </>
                  )}
                </Button>
              </CardFooter>
            </Card>
          </form>
        </div>
      </main>
    </div>
  );
}