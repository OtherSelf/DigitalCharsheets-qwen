'use client';

import * as React from 'react';

import { Scale } from 'lucide-react';

import { Button } from '@/components/ui/button';
import { useTranslation } from '@/games/plugin-host';

import {
  rankForCharacter,
  rankStateForCharacter,
  resolveCharacterClass,
} from '../dark-heresy-ranks';
import { DhHouseRulesDialog } from '../sections/dh-house-rules-dialog';
import type { DH1Character } from '../types';

/**
 * ─── LANDMARK: DH1 HEADER SLOTS ────────────────────────────────────────────
 * Подпись «ранг/карьера | Dark Heresy» и кнопка домашних правил с диалогом.
 * Раньше это жило в `src/components/header.tsx` с проверками `gameSystem`
 * и `resolveCharacterSystemId`; теперь — слот плагина (этап 3).
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
export function dh1HeaderSubtitle(
  character: DH1Character,
  t: (key: string) => string,
): string {
  // Ранг и класс считаются живьём: `updateCharacter` мержит патч локально, не
  // дожидаясь ответа сервера, и снимок создания отстал бы от опыта.
  const node = rankStateForCharacter(character).node;
  const characterClass = resolveCharacterClass(character);
  const rank = rankForCharacter(character);

  // Подпись узла карьерно-зависима (`Novice` у Cleric и Сороритас — разные
  // слова), поэтому для известного графа ключ берётся у узла, а старая карта
  // по EN-имени остаётся только для legacy-листов без карьеры.
  const translatedRank = node
    ? t(node.labelKey)
    : translateOr(t, `dh1.rank${stripNonLetters(rank)}`, rank);
  const translatedClass = translateOr(
    t,
    `dh1.career${stripNonLetters(characterClass)}`,
    characterClass,
  );
  const translatedSystem =
    translateOr(t, 'dh1.systemName', character.gameSystem) || 'Dark Heresy';

  return `${translatedRank} ${translatedClass} | ${translatedSystem}`;
}

/** Кнопка домашних правил в шапке (на телефоне живёт в рейле секций). */
export function Dh1HeaderActions({
  character,
  isPhoneView,
}: {
  character: DH1Character;
  isCompactView: boolean;
  isPhoneView: boolean;
}) {
  const { t } = useTranslation();
  const [isHouseRulesOpen, setIsHouseRulesOpen] = React.useState(false);

  if (isPhoneView) return null;

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
export function Dh1HouseRulesDialogSlot({
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
