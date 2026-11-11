'use client';

import React, { forwardRef } from 'react';

import { useCharacterContext } from '@/context/character-context';
import { resolveCharacterSystemId } from '@/games/character-system';
import { Dh1Sheet } from '@/games/dh1/sheet';
import { Dh2Sheet } from '@/games/dh2/sheet';
import { DndSheet } from '@/games/dnd5e/sheet';
import { type Character } from '@/lib/types';

/**
 * ─── LANDMARK: SHEET DISPATCHER ────────────────────────────────────────────
 * Выбирает лист по `systemId` (legacy DH без systemId — dh1, 📌 D3).
 * Компоненты импортированы статически: `ref` прокидывается в лист для
 * `saveAll`, а `next/dynamic` не гарантирует forwarding ref. Список модулей
 * по-прежнему живёт в реестре; это лишь карта рендера.
 */
const SHEETS: Record<string, React.ComponentType<any>> = {
  dnd5e: DndSheet,
  dh1: Dh1Sheet,
  dh2: Dh2Sheet,
};

export const CharacterSheet = forwardRef<
  any,
  { character: Character; activeCompactSection: string }
>(({ character, activeCompactSection }, ref) => {
  const { isCompactView } = useCharacterContext();
  const systemId = resolveCharacterSystemId(character);
  const Sheet = systemId ? SHEETS[systemId] : undefined;

  if (!Sheet) return null;

  return (
    <div className="space-y-6">
      <Sheet
        ref={ref}
        character={character}
        isCompactView={isCompactView}
        activeCompactSection={activeCompactSection}
      />
    </div>
  );
});

CharacterSheet.displayName = 'CharacterSheet';
