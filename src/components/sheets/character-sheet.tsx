'use client';

import React, { forwardRef } from 'react';

import { useCharacterContext } from '@/context/character-context';
import { type Character } from '@/lib/types';

import { DarkHeresySheet } from './dark-heresy-sheet';
import { DndSheet } from './dnd-sheet';

export const CharacterSheet = forwardRef<
  any,
  { character: Character; activeCompactSection: string }
>(({ character, activeCompactSection }, ref) => {
  const { isCompactView } = useCharacterContext();

  return (
    <div className="space-y-6">
      {character.gameSystem === 'Dungeons & Dragons' ? (
        <DndSheet
          ref={ref}
          character={character}
          isCompactView={isCompactView}
          activeCompactSection={activeCompactSection}
        />
      ) : (
        <DarkHeresySheet
          ref={ref}
          character={character}
          isCompactView={isCompactView}
          activeCompactSection={activeCompactSection}
        />
      )}
    </div>
  );
});

CharacterSheet.displayName = 'CharacterSheet';
