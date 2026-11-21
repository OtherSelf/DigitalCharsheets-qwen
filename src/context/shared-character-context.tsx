'use client';

import { ReactNode, useMemo } from 'react';

import { useViewportFlags } from '@/hooks/use-viewport-flags';
import type { Character } from '@/lib/types';

import {
  CharacterContext,
  type CharacterContextType,
} from './character-context';

/**
 * ─── LANDMARK: SHARED CHARACTER PROVIDER ────────────────────────────────────
 * Гостевая страница не имеет сессии и не должна грузить список чужих листов.
 * Этот провайдер подменяет `CharacterProvider` одним листом из props: лист
 * рендерится теми же секциями, но все мутации — no-op.
 *
 * Реальная защита от записи — серверная (у гостя нет cookie и PUT), а no-op
 * контекст и `readOnly` лишь не дают UI выглядеть редактируемым.
 */
export function SharedCharacterProvider({
  character,
  children,
}: {
  character: Character;
  children: ReactNode;
}) {
  const { isSmallScreen, isTabletScreen } = useViewportFlags();

  const value = useMemo<CharacterContextType>(
    () => ({
      characters: [character],
      getCharacter: (id) => (id === character.id ? character : undefined),
      addCharacter: async () => undefined,
      updateCharacter: () => undefined,
      deleteCharacter: () => undefined,
      pendingDraft: null,
      createPendingDraft: async () => undefined,
      discardPendingDraft: () => undefined,
      isLoaded: true,
      loadError: false,
      retryCharacters: async () => undefined,
      toast: () => undefined,
      // Гость видит весь лист: в `/share` нет компактного рейла, поэтому
      // компактный режим означал бы «одна секция из шести без переключения».
      // Флаги экрана при этом настоящие — от них зависит шапка и отступы.
      isCompactView: false,
      isSmallScreen,
      isTabletScreen,
      toggleCompactView: () => undefined,
      hasUnsavedChanges: false,
      setHasUnsavedChanges: () => undefined,
      refreshCharacters: async () => undefined,
      hideNotes: false,
      setHideNotes: () => undefined,
      showEditButtons: false,
      setShowEditButtons: () => undefined,
      readOnly: true,
      flushSaves: async () => undefined,
    }),
    [character, isSmallScreen, isTabletScreen],
  );

  return (
    <CharacterContext.Provider value={value}>
      {children}
    </CharacterContext.Provider>
  );
}
