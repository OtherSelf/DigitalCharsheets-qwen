'use client';

import { Button } from '@/components/ui/button';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { useCharacterContext, useTranslation } from '@/games/plugin-host';

/**
 * Слот `HouseRulesDialog`: тело диалога домашних правил. Хост рисует кнопку и
 * даёт `characterId`; содержимое — знание игры. Песочница показывает имя
 * листа, чтобы было видно, что диалог открыт именно для него.
 */
export function SandboxHouseRulesDialog({
  characterId,
  open,
  onOpenChange,
}: {
  characterId: string;
  open: boolean;
  onOpenChange: (open: boolean) => void;
}) {
  const { getCharacter } = useCharacterContext();
  const { t } = useTranslation();
  const character = getCharacter(characterId);

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>{t('sandbox.houseRulesTitle')}</DialogTitle>
          <DialogDescription>
            {character
              ? `${t('sandbox.houseRulesFor')} ${character.name}`
              : t('sandbox.houseRulesForUnknown')}
          </DialogDescription>
        </DialogHeader>
        <p className="text-sm">{t('sandbox.houseRulesBody')}</p>
        <DialogFooter>
          <Button onClick={() => onOpenChange(false)}>
            {t('common.cancel')}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
