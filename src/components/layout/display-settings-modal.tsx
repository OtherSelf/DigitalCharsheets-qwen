// src/components/layout/display-settings-modal.tsx

'use client';

import { DisplaySettingsControls } from '@/components/settings/display-settings-controls';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { useTranslation } from '@/context/language-context';

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
          <DialogTitle>{t('settings.displaySettings')}</DialogTitle>
          <DialogDescription>
            {t('settings.adjustUiAppearance')}
          </DialogDescription>
        </DialogHeader>

        <DisplaySettingsControls className="py-4" resetClassName="w-full" />
      </DialogContent>
    </Dialog>
  );
}
