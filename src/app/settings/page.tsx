// src/app/settings/page.tsx

'use client';

import { useEffect, useState } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';

import { AlertCircle, Save } from 'lucide-react';

import { AppFrame } from '@/components/layout/app-frame';
import { DeleteAccountCard } from '@/components/settings/delete-account-card';
import { DisplaySettingsControls } from '@/components/settings/display-settings-controls';
import { SessionsCard } from '@/components/settings/sessions-card';
import { TotpCard } from '@/components/settings/totp-card';
import { Button } from '@/components/ui/button';
import {
  Card,
  CardContent,
  CardDescription,
  CardFooter,
  CardHeader,
  CardTitle,
} from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { PasswordInput } from '@/components/ui/password-input';
import { Separator } from '@/components/ui/separator';
import { useTranslation } from '@/context/language-context';
import { useLocalAuth } from '@/context/local-auth-context';
import { useUISettings } from '@/hooks/use-ui-settings';
import { safeInternalPath } from '@/lib/routes';
import { MIN_PASSWORD_LENGTH } from '@/lib/security/password-policy';
import { phrasePolicyError } from '@/lib/security/phrase-policy';

export default function ProfileSettingsPage() {
  const { user, isUserLoading, restoreSession } = useLocalAuth();
  const { t } = useTranslation();
  const router = useRouter();
  const searchParams = useSearchParams();

  // LANDMARK: BACK_NAVIGATION_LOGIC
  // Только внутренний путь: `//evil.example` — уже внешний URL.
  const backTarget = safeInternalPath(searchParams.get('from'));
  const isFromDashboard = backTarget === '/';

  const { isLoaded } = useUISettings();

  const [displayName, setDisplayName] = useState('');
  const [username, setUsername] = useState('');
  const [password, setPassword] = useState('');
  const [recoveryPhrase, setRecoveryPhrase] = useState('');
  const [currentPassword, setCurrentPassword] = useState('');
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

    if (password && password.length < MIN_PASSWORD_LENGTH) {
      setError(t('common.passwordMinLength'));
      return;
    }

    const changesPassword = password.trim() !== '';
    const changesPhrase = recoveryPhrase.trim() !== '';
    if (changesPhrase && phrasePolicyError(recoveryPhrase)) {
      setError(t('auth.phrasePolicy'));
      return;
    }
    if ((changesPassword || changesPhrase) && !currentPassword) {
      setError(t('settings.currentPasswordRequired'));
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
          // Пароль нужен только при смене секрета: смена имени/логина его
          // не требует.
          currentPassword:
            changesPassword || changesPhrase ? currentPassword : undefined,
        }),
      });

      const data = await res.json();
      if (data.success) {
        restoreSession(data.user);
        setSuccess(t('settings.saved'));
        setPassword('');
        setRecoveryPhrase('');
        setCurrentPassword('');
      } else {
        setError(data.error || t('settings.saveFailed'));
      }
    } catch (err) {
      setError(t('common.serverConnectionFailed'));
    } finally {
      setIsSaving(false);
    }
  };

  if (isUserLoading || !user || !isLoaded) return null;

  return (
    <AppFrame
      variant="wide"
      header={{
        title: t('settings.profileSettings'),
        backHref: !isFromDashboard ? backTarget : undefined,
      }}
    >
      <div className="mx-auto max-w-2xl space-y-6">
        {error && (
          <div className="bg-destructive/15 text-destructive flex items-center gap-2 rounded-md p-3 text-sm">
            <AlertCircle className="h-4 w-4" />
            <span>{error}</span>
          </div>
        )}
        {success && (
          <div className="rounded-md bg-green-100 p-3 text-sm text-green-800 dark:bg-green-900/30 dark:text-green-300">
            {success}
          </div>
        )}

        {/*
            ─── LANDMARK: GENERATED_ADMIN_PASSWORD_WARNING ───
            Если служебный админ создан при первом запуске, его пароль лежит в
            консоли и data/.initial-admin.txt. Напоминаем сменить его в карточке
            Security; после сохранения с новым паролем флаг снимается.
          */}
        {user.mustChangePassword && (
          <div className="rounded-md border border-amber-500/50 bg-amber-500/10 p-3 text-sm">
            {t('admin.mustChangePassword')}
          </div>
        )}

        <form onSubmit={handleSave} className="space-y-6">
          <Card>
            <CardHeader>
              <CardTitle>{t('settings.generalInformation')}</CardTitle>
              <CardDescription>
                {t('settings.updateYourDisplayNameAndLogin')}
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              {user.role && user.role !== 'user' && (
                <p className="text-muted-foreground text-right text-xs">
                  {t('settings.role')}:{' '}
                  {t(
                    user.role === 'admin'
                      ? 'admin.roleAdmin'
                      : 'admin.roleTester',
                  )}
                </p>
              )}
              <div className="space-y-2">
                <Label htmlFor="displayName">{t('common.displayName')}</Label>
                <Input
                  id="displayName"
                  value={displayName}
                  onChange={(e) => setDisplayName(e.target.value)}
                  placeholder={t('settings.usernamePlaceholder')}
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="username">{t('auth.login')}</Label>
                <Input
                  id="username"
                  value={username}
                  onChange={(e) => setUsername(e.target.value)}
                  placeholder={t('settings.emailPlaceholder')}
                />
              </div>
            </CardContent>
          </Card>

          {/* LANDMARK: DISPLAY_SETTINGS_CARD */}
          <Card>
            <CardHeader>
              <CardTitle>{t('settings.displaySettings')}</CardTitle>
              <CardDescription>
                {t('settings.adjustUiAppearance')}
              </CardDescription>
            </CardHeader>
            <CardContent>
              <DisplaySettingsControls resetClassName="w-full sm:w-auto" />
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle>{t('settings.security')}</CardTitle>
              <CardDescription>
                {t('settings.updatePasswordAndRecovery')}
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="space-y-2">
                <Label htmlFor="currentPassword">
                  {t('settings.currentPassword')}
                </Label>
                <PasswordInput
                  id="currentPassword"
                  value={currentPassword}
                  onChange={(e) => setCurrentPassword(e.target.value)}
                  placeholder={t('settings.currentPasswordPlaceholder')}
                  autoComplete="current-password"
                />
                <p className="text-muted-foreground text-xs">
                  {t('settings.currentPasswordHint')}
                </p>
              </div>
              <div className="space-y-2">
                <Label htmlFor="password">{t('common.newPassword')}</Label>
                <PasswordInput
                  id="password"
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  placeholder={t('settings.leaveBlankToKeepCurrent')}
                  autoComplete="new-password"
                />
              </div>
              <Separator />
              <div className="space-y-2">
                <Label htmlFor="recoveryPhrase">{t('auth.phrase')}</Label>
                <Input
                  id="recoveryPhrase"
                  value={recoveryPhrase}
                  onChange={(e) => setRecoveryPhrase(e.target.value)}
                  placeholder={
                    user.hasRecoveryPhrase
                      ? t('settings.updateRecoveryPhrase')
                      : t('settings.addRecoveryPhrase')
                  }
                />
              </div>
            </CardContent>
            <CardFooter>
              <Button type="submit" className="w-full" disabled={isSaving}>
                {isSaving ? (
                  t('common.saving')
                ) : (
                  <>
                    <Save className="mr-2 h-4 w-4" />
                    {t('common.saveChanges')}
                  </>
                )}
              </Button>
            </CardFooter>
          </Card>
        </form>

        <TotpCard />

        <SessionsCard />

        {/* LANDMARK: DANGER_ZONE_OUTSIDE_PROFILE_FORM
              Вне <form>: у карточки свой диалог со своей формой; вложенные
              формы недопустимы и сломали бы submit профиля. */}
        <DeleteAccountCard />
      </div>
    </AppFrame>
  );
}
