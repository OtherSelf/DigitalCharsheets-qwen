'use client';

import * as React from 'react';

import { Scale } from 'lucide-react';

import { Button } from '@/components/ui/button';
import { useTranslation } from '@/context/language-context';

import { DhHouseRulesDialog } from '../sections/dh-house-rules-dialog';
import type { DH2Character } from '../types';

/**
 * ─── LANDMARK: DH2 HEADER SLOTS ────────────────────────────────────────────
 * Подпись «ранг/карьера | Dark Heresy» и кнопка домашних правил с диалогом.
 * Раньше это жило в `src/components/header.tsx` с проверками `gameSystem`
 * и `resolveCharacterSystemId`; теперь — слот плагина (этап 3, D11).
 */

function translateOr(
  t: (key: string) => string,
  key: string,
  fallback: string,
): string {
  const translated = t(key);
  return translated === key ? fallback : translated;
}

function stripNonLetters(value: string): string {
  return value.replace(/[^a-zA-Z]/g, '');
}

/** Подпись под именем в шапке: «Scholar Adept | Dark Heresy». */
export function dh2HeaderSubtitle(
  character: DH2Character,
  t: (key: string) => string,
): string {
  const rank = character.rank || '';
  const characterClass = character.characterClass || '';

  const translatedRank = translateOr(
    t,
    `dh2.rank${stripNonLetters(rank)}`,
    rank,
  );
  const translatedClass = translateOr(
    t,
    `dh2.career${stripNonLetters(characterClass)}`,
    characterClass,
  );
  const translatedSystem =
    translateOr(t, 'common.gameSystemDarkHeresy', character.gameSystem) ||
    'Dark Heresy';

  return `${translatedRank} ${translatedClass} | ${translatedSystem}`;
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
