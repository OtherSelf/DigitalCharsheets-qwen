// src/components/layout/display-settings-modal.tsx

'use client';

import { Minus, Plus, RotateCcw } from 'lucide-react';

import { Button } from '@/components/ui/button';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { Label } from '@/components/ui/label';
import { Separator } from '@/components/ui/separator';
import { useTranslation } from '@/context/language-context';
import { useUISettings } from '@/hooks/use-ui-settings';

interface DisplaySettingsModalProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  /**
   * Куда вернуть фокус при закрытии. Триггером модалки служит пункт меню,
   * который к моменту закрытия уже удалён из DOM, поэтому без этого Radix
   * оставляет фокус на `body` (клавиатурный пользователь «теряет место»).
   */
  returnFocusRef?: React.RefObject<HTMLElement | null>;
}

export function DisplaySettingsModal({
  open,
  onOpenChange,
  returnFocusRef,
}: DisplaySettingsModalProps) {
  const { t } = useTranslation();
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
  } = useUISettings();

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent
        className="sm:max-w-[425px]"
        onCloseAutoFocus={(event) => {
          if (!returnFocusRef?.current) return;
          event.preventDefault();
          returnFocusRef.current.focus();
        }}
      >
        <DialogHeader>
          <DialogTitle>
            {t('settings.displaySettings') || 'Display Settings'}
          </DialogTitle>
          <DialogDescription>
            {t('settings.adjustUiAppearance') ||
              'Adjust text size and overall UI scale independently. Changes apply in real-time.'}
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-6 py-4">
          {/* LANDMARK: MODAL_TEXT_SIZE_CONTROLS */}
          <div className="space-y-3">
            <Label>{t('settings.fontSize') || 'Text Size'}</Label>
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
                {Math.round(textScale * 100)}% ({(12 * textScale).toFixed(1)}{' '}
                pt)
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
              {t('settings.minFontSizeWarning') ||
                'Minimum 8pt. Boxes, padding and spacing stay unchanged.'}
            </p>
          </div>

          <Separator />

          {/* LANDMARK: MODAL_UI_SCALE_CONTROLS */}
          <div className="space-y-3">
            <Label>{t('settings.uiScale') || 'UI Scale'}</Label>
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
              {t('settings.uiScaleWarning') ||
                'Range: 50% to 150%. Scales the whole interface.'}
            </p>
          </div>

          <div className="pt-2">
            <Button
              type="button"
              variant="secondary"
              onClick={resetSettings}
              className="w-full"
            >
              <RotateCcw className="mr-2 h-4 w-4" />
              {t('settings.resetToDefaults') || 'Reset to Defaults'}
            </Button>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}
