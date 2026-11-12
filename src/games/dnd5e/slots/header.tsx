'use client';

import * as React from 'react';

import { Minus, Plus, Scale } from 'lucide-react';

import { Button } from '@/components/ui/button';
import { useCharacterContext, useTranslation } from '@/games/plugin-host';

import { HouseRulesDialog } from '../sections/house-rules-dialog';
import type { DnD5eCharacter } from '../types';

/**
 * ─── LANDMARK: DND5E HEADER SLOTS ──────────────────────────────────────────
 * Всё игровое в шапке: подпись «уровень/раса/класс/предыстория», счётчик
 * вдохновения, кнопка домашних правил и сам диалог. Раньше это жило в
 * `src/components/header.tsx` с `if (gameSystem === 'Dungeons & Dragons')`;
 * теперь хост просто вызывает слот плагина (этап 3, D11).
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

/** Подпись под именем в шапке: «Lvl 5 Human Fighter | Soldier». */
export function dnd5eHeaderSubtitle(
  character: DnD5eCharacter,
  t: (key: string) => string,
): string {
  const race = character.race || '';
  const background = character.background || '';
  const characterClass = character.characterClass || '';

  const translatedRace = translateOr(
    t,
    `dnd.race${stripNonLetters(race)}`,
    race,
  );
  const translatedClass = translateOr(
    t,
    `dnd.class${characterClass}`,
    characterClass,
  );
  const translatedBackground = translateOr(
    t,
    `dnd.bg${stripNonLetters(background)}`,
    background,
  );

  return `${t('dnd.lvl')} ${character.level || 1} ${translatedRace} ${translatedClass} | ${translatedBackground}`;
}

/** Кнопка/счётчик вдохновения + домашние правила. */
export function DndHeaderActions({
  character,
  isCompactView,
}: {
  character: DnD5eCharacter;
  isCompactView: boolean;
}) {
  const { updateCharacter } = useCharacterContext();
  const { t } = useTranslation();
  const [isHouseRulesOpen, setIsHouseRulesOpen] = React.useState(false);

  const handleInspirationChange = (delta: number) => {
    const current = parseInt(character.inspiration) || 0;
    const maxInspiration = character.allowInspirationHomeRule ? 999 : 1;
    const next = Math.max(0, Math.min(maxInspiration, current + delta));
    updateCharacter(character.id, { inspiration: next.toString() });
  };

  return (
    <>
      <div className="border-primary/20 bg-primary/10 flex shrink-0 items-center gap-2 rounded-full border px-2 py-1 md:ml-2 md:px-3">
        {/* На узком планшете (768..1023) подпись скрывается, чтобы имя
            персонажа не сжималось: смысл «+/-» понятен по иконкам. */}
        <span className="header-field-label text-primary hidden text-[10px] font-bold tracking-widest uppercase sm:inline">
          {t('common.inspiration')}
        </span>
        <div className="flex items-center gap-1">
          <Button
            size="icon"
            variant="ghost"
            className="text-primary hover:bg-primary/20 h-6 w-6"
            onClick={() => handleInspirationChange(-1)}
          >
            <Minus className="h-3 w-3" />
          </Button>
          <span className="text-primary min-w-[1rem] text-center text-sm font-black">
            {character.inspiration || '0'}
          </span>
          <Button
            size="icon"
            variant="ghost"
            className="text-primary hover:bg-primary/20 h-6 w-6"
            onClick={() => handleInspirationChange(1)}
          >
            <Plus className="h-3 w-3" />
          </Button>
        </div>
        {!isCompactView && (
          <Button
            variant="outline"
            size="sm"
            onClick={() => setIsHouseRulesOpen(true)}
            className="h-7 px-2 xl:ml-2"
            aria-label={t('common.houseRules')}
          >
            <Scale className="h-4 w-4 xl:mr-2" />
            <span className="hidden xl:inline">{t('common.houseRules')}</span>
          </Button>
        )}
      </div>

      <HouseRulesDialog
        open={isHouseRulesOpen}
        onOpenChange={setIsHouseRulesOpen}
        characterId={character.id}
      />
    </>
  );
}

/** Тело диалога домашних правил — хост даёт кнопку, плагин — содержимое. */
export function DndHouseRulesDialogSlot({
  characterId,
  open,
  onOpenChange,
}: {
  characterId: string;
  open: boolean;
  onOpenChange: (open: boolean) => void;
}) {
  return (
    <HouseRulesDialog
      open={open}
      onOpenChange={onOpenChange}
      characterId={characterId}
    />
  );
}
