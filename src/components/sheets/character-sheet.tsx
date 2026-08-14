'use client';

import React, { forwardRef } from 'react';
import { type Character } from '@/lib/types';
import { DndSheet } from './dnd-sheet';
import { DarkHeresySheet } from './dark-heresy-sheet';
import { useCharacterContext } from '@/context/character-context';

export const CharacterSheet = forwardRef<any, { character: Character; activeCompactSection: string; }>(
  ({ character, activeCompactSection }, ref) => {
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
  }
);

CharacterSheet.displayName = 'CharacterSheet';
