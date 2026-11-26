'use client';

import { useCallback, useEffect, useState } from 'react';

import { Loader2, Save } from 'lucide-react';

import { Button } from '@/components/ui/button';
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from '@/components/ui/card';
import { Checkbox } from '@/components/ui/checkbox';
import { useTranslation } from '@/context/language-context';
import { useToast } from '@/hooks/use-toast';
import type { SiteSettings } from '@/lib/site-settings';

/**
 * ─── LANDMARK: ADMIN SITE SETTINGS ─────────────────────────────────────────
 * Переключатели инстанса в админке: публичная регистрация, вход только для
 * админов и тестеров, режим обслуживания.
 *
 * Сохранение — по кнопке, а не на каждое переключение: это не персональные
 * настройки, а состояние всего сайта, и «щёлкнул случайно» не должно на
 * секунду закрывать вход всем.
 */
export function SiteSettingsSection() {
  const { t } = useTranslation();
  const { toast } = useToast();

  const [settings, setSettings] = useState<SiteSettings | null>(null);
  const [saved, setSaved] = useState<SiteSettings | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [isSaving, setIsSaving] = useState(false);

  useEffect(() => {
    let cancelled = false;
    void (async () => {
      try {
        const response = await fetch('/api/admin/settings', {
          cache: 'no-store',
        });
        const data = await response.json().catch(() => null);
        if (cancelled) return;
        if (response.ok && data?.settings) {
          setSettings(data.settings);
          setSaved(data.settings);
        }
      } finally {
        if (!cancelled) setIsLoading(false);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, []);

  const save = useCallback(async () => {
    if (!settings) return;
    setIsSaving(true);
    try {
      const response = await fetch('/api/admin/settings', {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(settings),
      });
      const data = await response.json().catch(() => null);
      if (!response.ok || !data?.settings) {
        toast({
          variant: 'destructive',
          title: t('admin.settingsSaveFailed'),
        });
        return;
      }
      setSettings(data.settings);
      setSaved(data.settings);
      toast({ title: t('admin.settingsSaved') });
    } catch {
      toast({ variant: 'destructive', title: t('admin.settingsSaveFailed') });
    } finally {
      setIsSaving(false);
    }
  }, [settings, t, toast]);

  const isDirty =
    settings && saved
      ? JSON.stringify(settings) !== JSON.stringify(saved)
      : false;

  const rows: Array<{
    key: string;
    checked: boolean;
    label: string;
    hint: string;
    onChange: (value: boolean) => void;
    testId: string;
  }> = settings
    ? [
        {
          key: 'registration',
          checked: settings.registration.open,
          label: t('admin.settingsRegistration'),
          hint: t('admin.settingsRegistrationHint'),
          onChange: (value) =>
            setSettings({
              ...settings,
              registration: { open: value },
            }),
          testId: 'settings-registration',
        },
        {
          key: 'loginRestricted',
          checked: settings.access.loginRestrictedToStaff,
          label: t('admin.settingsLoginRestricted'),
          hint: t('admin.settingsLoginRestrictedHint'),
          onChange: (value) =>
            setSettings({
              ...settings,
              access: { ...settings.access, loginRestrictedToStaff: value },
            }),
          testId: 'settings-login-restricted',
        },
        {
          key: 'maintenance',
          checked: settings.access.maintenance,
          label: t('admin.settingsMaintenance'),
          hint: t('admin.settingsMaintenanceHint'),
          onChange: (value) =>
            setSettings({
              ...settings,
              access: { ...settings.access, maintenance: value },
            }),
          testId: 'settings-maintenance',
        },
      ]
    : [];

  return (
    <Card data-testid="admin-site-settings">
      <CardHeader>
        <CardTitle>{t('admin.settingsTitle')}</CardTitle>
        <CardDescription>{t('admin.settingsDescription')}</CardDescription>
      </CardHeader>
      <CardContent className="space-y-4">
        {isLoading && (
          <p className="text-muted-foreground flex items-center gap-2 text-sm">
            <Loader2 className="h-4 w-4 animate-spin" aria-hidden />
            {t('admin.settingsLoading')}
          </p>
        )}

        {rows.map((row) => (
          <div key={row.key} className="flex items-start gap-3">
            <Checkbox
              id={`site-settings-${row.key}`}
              checked={row.checked}
              onCheckedChange={(value) => row.onChange(value === true)}
              data-testid={row.testId}
            />
            <div className="space-y-1">
              <label
                htmlFor={`site-settings-${row.key}`}
                className="text-sm leading-snug font-medium"
              >
                {row.label}
              </label>
              <p className="text-muted-foreground text-xs leading-snug">
                {row.hint}
              </p>
            </div>
          </div>
        ))}

        {settings && (
          <Button
            type="button"
            onClick={() => void save()}
            disabled={!isDirty || isSaving}
            className="mt-2"
            data-testid="settings-save"
          >
            {isSaving ? (
              <Loader2 className="mr-2 h-4 w-4 animate-spin" aria-hidden />
            ) : (
              <Save className="mr-2 h-4 w-4" aria-hidden />
            )}
            {t('common.save')}
          </Button>
        )}
      </CardContent>
    </Card>
  );
}
