'use client';

import * as React from 'react';

import { Scale } from 'lucide-react';

import { Button } from '@/components/ui/button';
import { useTranslation } from '@/games/plugin-host';

import { backgroundLabel, roleLabel } from '../dh2e-labels';
import { DhHouseRulesDialog } from '../sections/dh-house-rules-dialog';
import type { DH2Character } from '../types';

/**
 * ─── LANDMARK: DH2 HEADER SLOTS ────────────────────────────────────────────
 * Подпись «бэкграунд/роль | Dark Heresy» и кнопка домашних правил с диалогом.
 * Карьер и ранг DH1 в модуле 2e не существуют.
 */

function translateOr(
  t: (key: string) => string,
  key: string,
  fallback: string,
): string {
  const translated = t(key);
  return translated === key ? fallback : translated;
}

/** Подпись под именем в шапке: «Adeptus Arbites / Warrior | Dark Heresy». */
export function dh2HeaderSubtitle(
  character: DH2Character,
  t: (key: string) => string,
): string {
  const background = backgroundLabel(character.background, t);
  const role = roleLabel(character.role, t);
  const translatedSystem =
    translateOr(t, 'dh2.systemName', character.gameSystem) || 'Dark Heresy';
  const parts = [background, role].filter(Boolean);

  return `${parts.length ? `${parts.join(' / ')} | ` : ''}${translatedSystem}`;
}

/** Кнопка домашних правил в шапке (в компактном виде живёт в сайдбаре). */
export function Dh2HeaderActions({
  character,
  isCompactView,
}: {
  character: DH2Character;
  isCompactView: boolean;
}) {
  const { t } = useTranslation();
  const [isHouseRulesOpen, setIsHouseRulesOpen] = React.useState(false);

  if (isCompactView) return null;

  return (
    <>
      <div className="ml-2 flex shrink-0 items-center gap-2 border-l pl-2 md:gap-3 md:pl-4">
        <Button
          variant="outline"
          size="sm"
          onClick={() => setIsHouseRulesOpen(true)}
          className="h-7 px-2"
          aria-label={t('common.houseRules')}
        >
          <Scale className="h-4 w-4 xl:mr-2" />
          <span className="hidden xl:inline">{t('common.houseRules')}</span>
        </Button>
      </div>

      <DhHouseRulesDialog
        open={isHouseRulesOpen}
        onOpenChange={setIsHouseRulesOpen}
        characterId={character.id}
      />
    </>
  );
}

/** Тело диалога домашних правил — хост даёт кнопку, плагин — содержимое. */
export function Dh2HouseRulesDialogSlot({
  characterId,
  open,
  onOpenChange,
}: {
  characterId: string;
  open: boolean;
  onOpenChange: (open: boolean) => void;
}) {
  return (
    <DhHouseRulesDialog
      open={open}
      onOpenChange={onOpenChange}
      characterId={characterId}
    />
  );
}
