'use client';

import { useSyncExternalStore } from 'react';

import { Minus, Plus, RotateCcw } from 'lucide-react';

import { Button } from '@/components/ui/button';
import { Checkbox } from '@/components/ui/checkbox';
import { Label } from '@/components/ui/label';
import { Separator } from '@/components/ui/separator';
import { useTranslation } from '@/context/language-context';
import { useUISettings } from '@/hooks/use-ui-settings';
import {
  WAKE_LOCK_SERVER_STATE,
  wakeLockController,
} from '@/lib/screen-wake-lock';
import { cn } from '@/lib/utils';

/**
 * Контролы размера текста, масштаба интерфейса и сброса. Одинаковы в
 * карточке `/settings` и в модалке из меню профиля: значения, лимиты и
 * подписи не должны расходиться между двумя входами.
 */
export function DisplaySettingsControls({
  className,
  resetClassName,
}: {
  className?: string;
  resetClassName?: string;
}) {
  const { t } = useTranslation();
  const {
    textScale,
    uiScale,
    keepScreenAwake,
    updateTextScale,
    updateUiScale,
    updateKeepScreenAwake,
    resetSettings,
    minTextScale,
    maxTextScale,
    minUiScale,
    maxUiScale,
  } = useUISettings();
  const wakeState = useSyncExternalStore(
    wakeLockController.subscribe,
    wakeLockController.getState,
    () => WAKE_LOCK_SERVER_STATE,
  );

  return (
    <div className={cn('space-y-6', className)}>
      <div className="space-y-3">
        <Label>{t('settings.fontSize')}</Label>
        <div className="flex items-center gap-3">
          <Button
            type="button"
            variant="outline"
            size="icon"
            onClick={() => updateTextScale(textScale - 0.1)}
            disabled={textScale <= minTextScale}
            aria-label={t('settings.decreaseTextSize')}
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
            aria-label={t('settings.increaseTextSize')}
          >
            <Plus className="h-4 w-4" />
          </Button>
        </div>
        <p className="text-muted-foreground text-xs">
          {t('settings.minFontSizeWarning')}
        </p>
      </div>

      <Separator />

      <div className="space-y-3">
        <Label>{t('settings.uiScale')}</Label>
        <div className="flex items-center gap-3">
          <Button
            type="button"
            variant="outline"
            size="icon"
            onClick={() => updateUiScale(uiScale - 0.1)}
            disabled={uiScale <= minUiScale}
            aria-label={t('settings.decreaseUiScale')}
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
            aria-label={t('settings.increaseUiScale')}
          >
            <Plus className="h-4 w-4" />
          </Button>
        </div>
        <p className="text-muted-foreground text-xs">
          {t('settings.uiScaleWarning')}
        </p>
      </div>

      <Separator />

      <div className="space-y-2">
        <div className="flex items-center gap-2">
          <Checkbox
            id="keep-screen-awake"
            checked={keepScreenAwake}
            onCheckedChange={(checked) =>
              updateKeepScreenAwake(checked === true)
            }
          />
          <Label htmlFor="keep-screen-awake">
            {t('settings.keepScreenAwake')}
          </Label>
        </div>
        <p className="text-muted-foreground text-xs">
          {t('settings.keepScreenAwakeHint')}
        </p>
        {!wakeState.supported && (
          <p className="text-muted-foreground text-xs">
            {t('settings.keepScreenAwakeUnsupported')}
          </p>
        )}
        {wakeState.supported && wakeState.error && (
          <p className="text-destructive text-xs">
            {t('settings.keepScreenAwakeError')}
          </p>
        )}
      </div>

      <div className="pt-2">
        <Button
          type="button"
          variant="secondary"
          onClick={resetSettings}
          className={resetClassName}
        >
          <RotateCcw className="mr-2 h-4 w-4" />
          {t('settings.resetToDefaults')}
        </Button>
      </div>
    </div>
  );
}
