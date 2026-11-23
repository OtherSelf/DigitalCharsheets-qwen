'use client';

import { useState } from 'react';

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
import { useTranslation } from '@/context/language-context';
import { useLocalAuth } from '@/context/local-auth-context';

interface TotpResponse {
  success?: boolean;
  error?: string;
  reason?: string;
  secret?: string;
  otpauthUri?: string;
  backupCodes?: string[];
}

/**
 * ─── LANDMARK: TOTP SETTINGS ───────────────────────────────────────────────
 * Включение второго фактора требует текущий пароль и код; секрет показывается
 * один раз, backup-коды — тоже. Секрет не попадает в лог и не сохраняется в
 * localStorage: пользователь переносит его в authenticator вручную.
 */
export function TotpCard() {
  const { t } = useTranslation();
  const { user, updateUser } = useLocalAuth();
  const [password, setPassword] = useState('');
  const [code, setCode] = useState('');
  const [pendingSecret, setPendingSecret] = useState<string | null>(null);
  const [backupCodes, setBackupCodes] = useState<string[] | null>(null);
  const [error, setError] = useState('');
  const [busy, setBusy] = useState(false);

  const enabled = !!user?.totpEnabled;

  const message = (data: TotpResponse): string => {
    if (data.reason === 'totp_unavailable') {
      return t('settings.twoFactorUnavailable');
    }
    if (data.reason === 'totp_invalid') return t('settings.twoFactorInvalid');
    if (data.reason === 'invalid_password') {
      return t('settings.currentPasswordRequired');
    }
    return data.error || t('settings.saveFailed');
  };

  const post = async (
    path: string,
    body: Record<string, unknown>,
  ): Promise<TotpResponse> => {
    const res = await fetch(path, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(body),
    });
    const data = (await res.json().catch(() => null)) as TotpResponse | null;
    return (
      data ?? { success: false, error: t('common.serverConnectionFailed') }
    );
  };

  const run = async (action: () => Promise<void>) => {
    setError('');
    setBusy(true);
    try {
      await action();
    } catch {
      setError(t('common.serverConnectionFailed'));
    } finally {
      setBusy(false);
    }
  };

  const startSetup = () =>
    run(async () => {
      const data = await post('/api/auth/totp/setup', {
        currentPassword: password,
      });
      if (!data.success || !data.secret) {
        setError(message(data));
        return;
      }
      setPendingSecret(data.secret);
      setBackupCodes(null);
      setCode('');
    });

  const enable = () =>
    run(async () => {
      const data = await post('/api/auth/totp/enable', { code });
      if (!data.success || !data.backupCodes) {
        setError(message(data));
        return;
      }
      setPendingSecret(null);
      setBackupCodes(data.backupCodes);
      setPassword('');
      setCode('');
      if (user) updateUser({ ...user, totpEnabled: true });
    });

  const disable = () =>
    run(async () => {
      const data = await post('/api/auth/totp/disable', {
        currentPassword: password,
        code,
      });
      if (!data.success) {
        setError(message(data));
        return;
      }
      setPendingSecret(null);
      setBackupCodes(null);
      setPassword('');
      setCode('');
      if (user) updateUser({ ...user, totpEnabled: false });
    });

  const regenerate = () =>
    run(async () => {
      const data = await post('/api/auth/totp/backup-codes', {
        currentPassword: password,
      });
      if (!data.success || !data.backupCodes) {
        setError(message(data));
        return;
      }
      setBackupCodes(data.backupCodes);
    });

  return (
    <Card>
      <CardHeader>
        <CardTitle>{t('settings.twoFactor')}</CardTitle>
        <CardDescription>{t('settings.twoFactorDesc')}</CardDescription>
      </CardHeader>
      <CardContent className="space-y-4">
        {error && <p className="text-destructive text-sm">{error}</p>}

        <p className="text-sm font-medium">
          {enabled
            ? t('settings.twoFactorEnabled')
            : t('settings.twoFactorDisabled')}
        </p>

        {backupCodes && (
          <div className="space-y-2 rounded-md border p-3">
            <p className="text-sm font-medium">
              {t('settings.twoFactorBackupCodes')}
            </p>
            <div className="grid grid-cols-2 gap-1 font-mono text-sm">
              {backupCodes.map((value) => (
                <span key={value}>{value}</span>
              ))}
            </div>
            <p className="text-muted-foreground text-xs">
              {t('settings.twoFactorBackupHint')}
            </p>
          </div>
        )}

        {pendingSecret && (
          <div className="space-y-2 rounded-md border p-3">
            <p className="text-sm">{t('settings.twoFactorSecretHint')}</p>
            <code
              className="bg-muted block rounded p-2 text-sm break-all"
              data-testid="totp-secret"
            >
              {pendingSecret}
            </code>
          </div>
        )}

        <div className="space-y-2">
          <Label htmlFor="totp-password">{t('settings.currentPassword')}</Label>
          <PasswordInput
            id="totp-password"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            placeholder={t('settings.currentPasswordPlaceholder')}
            autoComplete="current-password"
          />
        </div>

        {(pendingSecret || enabled) && (
          <div className="space-y-2">
            <Label htmlFor="totp-code">{t('auth.totpCode')}</Label>
            <Input
              id="totp-code"
              value={code}
              onChange={(e) => setCode(e.target.value)}
              placeholder={t('auth.totpCodePlaceholder')}
              autoComplete="one-time-code"
              inputMode="numeric"
            />
          </div>
        )}
      </CardContent>
      <CardFooter className="flex flex-wrap gap-2">
        {!enabled && !pendingSecret && (
          <Button
            type="button"
            onClick={startSetup}
            disabled={busy || !password}
          >
            {t('settings.twoFactorSetup')}
          </Button>
        )}
        {pendingSecret && (
          <Button type="button" onClick={enable} disabled={busy || !code}>
            {t('settings.twoFactorEnable')}
          </Button>
        )}
        {enabled && (
          <>
            <Button
              type="button"
              variant="outline"
              onClick={regenerate}
              disabled={busy || !password}
            >
              {t('settings.twoFactorRegenerate')}
            </Button>
            <Button
              type="button"
              variant="destructive"
              onClick={disable}
              disabled={busy || !password || !code}
            >
              {t('settings.twoFactorDisable')}
            </Button>
          </>
        )}
      </CardFooter>
    </Card>
  );
}
