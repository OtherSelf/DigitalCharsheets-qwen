'use client';

import {
  createContext,
  useContext,
  ReactNode,
  useCallback,
  useState,
  useEffect,
} from 'react';
import { Character } from '@/lib/types';
import { useToast } from '@/hooks/use-toast';
import { useLocalAuth } from './local-auth-context';
// LANDMARK: ADDED TRANSLATION HOOK
import { useTranslation } from './language-context';

// ─── LANDMARK: SHEET_BREAKPOINTS ────────────────────────────────────
// Mobile  : < 768px            -> compact (one section at a time)
// Tablet  : 768px .. 1299px    -> all sections visible, reflowed grid
// Desktop : >= 1300px          -> full 12-column sheet
export const MOBILE_BREAKPOINT = 768;
export const DESKTOP_BREAKPOINT = 1300;

interface CharacterContextType {
  characters: Character[];
  getCharacter: (id: string) => Character | undefined;
  // LANDMARK: FIXED RETURN TYPE TO CHARACTER | UNDEFINED
  addCharacter: (character: Omit<Character, 'id' | 'userId'>) => Promise<Character | undefined>;
  updateCharacter: (id: string, data: Partial<Character>) => void;
  deleteCharacter: (id: string) => void;
  isLoaded: boolean;
  toast: (options: {
    title: string;
    description: string;
    variant?: 'default' | 'destructive' | null | undefined;
  }) => void;
  isCompactView: boolean;
  isSmallScreen: boolean;
  isTabletScreen: boolean;
  toggleCompactView: () => void;
  hasUnsavedChanges: boolean;
  setHasUnsavedChanges: (val: boolean) => void;
  hideNotes: boolean;
  setHideNotes: (val: boolean) => void;
  showEditButtons: boolean;
  setShowEditButtons: (val: boolean) => void;
}

const CharacterContext = createContext<CharacterContextType | undefined>(
  undefined
);

export function CharacterProvider({ children }: { children: ReactNode }) {
  const { toast } = useToast();
  const { user, isUserLoading } = useLocalAuth();
  // LANDMARK: INITIALIZE TRANSLATION HOOK
  const { t } = useTranslation();

  const [characters, setCharacters] = useState<Character[]>([]);
  const [isLoaded, setIsLoaded] = useState(false);

  const [userPrefersCompact, setUserPrefersCompact] = useState(false);
  const [isSmallScreen, setIsSmallScreen] = useState(false);
  const [isTabletScreen, setIsTabletScreen] = useState(false);
  const [hasUnsavedChanges, setHasUnsavedChanges] = useState(false);
  const [hideNotes, setHideNotes] = useState(true);
  const [showEditButtons, setShowEditButtons] = useState(true);

  useEffect(() => {
    const handleResize = () => {
      const width = window.innerWidth;
      setIsSmallScreen(width < MOBILE_BREAKPOINT);
      setIsTabletScreen(
        width >= MOBILE_BREAKPOINT && width < DESKTOP_BREAKPOINT
      );
    };
    handleResize();
    window.addEventListener('resize', handleResize);
    return () => window.removeEventListener('resize', handleResize);
  }, []);

  useEffect(() => {
    if (!isUserLoading && user) {
      setIsLoaded(false);
      fetch(`/api/characters?userId=${user.uid}`)
        .then(res => res.json())
        .then(data => {
          setCharacters(data);
          setIsLoaded(true);
        })
        .catch(err => {
          console.error('Failed to load characters:', err);
          setIsLoaded(true);
        });
    } else if (!isUserLoading && !user) {
      setCharacters([]);
      setIsLoaded(true);
    }
  }, [user, isUserLoading]);

  // Compact is automatic ONLY on real mobile, or when the user asks for it.
  // The tablet band deliberately does NOT force compact.
  const isCompactView = isSmallScreen || userPrefersCompact;
  const toggleCompactView = () => setUserPrefersCompact(prev => !prev);

  const addCharacter = useCallback(
    async (characterData: Omit<Character, 'id' | 'userId'>) => {
      if (!user) return undefined;
      try {
        const res = await fetch('/api/characters', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ ...characterData, userId: user.uid }),
        });
        const newCharacter: Character = await res.json();
        setCharacters(prev => [...prev, newCharacter]);
        
        // REMOVED DUPLICATE ENGLISH TOAST HERE. 
        // The forms handle the success toast using your translated keys!
        
        return newCharacter; // LANDMARK: RETURN THE DOCUMENT SO `docRef` ISN'T VOID
      } catch (error) {
        toast({
          variant: 'destructive',
          title: t('error'),
          description: t('failedToCreateCharacter'),
        });
        return undefined;
      }
    },
    [user, toast, t]
  );

  // --- UPDATED WITH COMPANION INTERCEPTOR ---
  const updateCharacter = useCallback(
    (id: string, data: Partial<Character>) => {
      if (!user) return;

      // 1. INTERCEPT COMPANION UPDATES
      if (id.startsWith('companion-')) {
        const companionId = id.replace('companion-', '');
        setCharacters(prev => {
          let updated = false;
          const nextChars = prev.map(char => {
            if (char.gameSystem === 'Dungeons & Dragons') {
              const dndChar = char as any;
              if (dndChar.companions && Array.isArray(dndChar.companions)) {
                const compIndex = dndChar.companions.findIndex(
                  (c: any) => c.id === companionId
                );
                if (compIndex !== -1) {
                  updated = true;
                  const newCompanions = [...dndChar.companions];
                  newCompanions[compIndex] = {
                    ...newCompanions[compIndex],
                    ...data,
                  };
                  fetch(`/api/characters/${char.id}`, {
                    method: 'PUT',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify({
                      companions: newCompanions,
                      userId: user.uid,
                    }),
                  }).catch(err =>
                    console.error('Failed to update companion:', err)
                  );
                  return { ...char, companions: newCompanions };
                }
              }
            }
            return char;
          });
          return updated ? nextChars : prev;
        });
        return;
      }

      // 2. NORMAL CHARACTER UPDATE
      setCharacters(prev =>
        prev.map(c =>
          c.id === id ? ({ ...c, ...data } as Character) : c
        )
      );
      fetch(`/api/characters/${id}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ ...data, userId: user.uid }),
      }).catch(err => console.error('Failed to update character:', err));
    },
    [user]
  );

  const deleteCharacter = useCallback(
    (id: string) => {
      if (!user) return;
      const characterToDelete = characters.find(c => c.id === id);
      setCharacters(prev => prev.filter(c => c.id !== id));
      fetch(`/api/characters/${id}?userId=${user.uid}`, { method: 'DELETE' })
        .then(() => {
          if (characterToDelete) {
            // LANDMARK: TRANSLATED DELETE TOAST
            toast({
              title: t('characterDeleted'),
              description: `${characterToDelete.name} ${t('characterDeletedDesc')}`,
            });
          }
        })
        .catch(err => console.error('Failed to delete character:', err));
    },
    [user, characters, toast, t]
  );

  // --- UPDATED WITH COMPANION INTERCEPTOR ---
  const getCharacter = useCallback(
    (id: string) => {
      if (id.startsWith('companion-')) {
        const companionId = id.replace('companion-', '');
        for (const char of characters) {
          if (char.gameSystem === 'Dungeons & Dragons') {
            const comp = (char as any).companions?.find(
              (c: any) => c.id === companionId
            );
            if (comp) {
              return { ...char, ...comp } as any;
            }
          }
        }
        return undefined;
      }
      return characters.find(c => c.id === id);
    },
    [characters]
  );

  const value = {
    characters,
    getCharacter,
    addCharacter,
    updateCharacter,
    deleteCharacter,
    isLoaded,
    toast,
    isCompactView,
    isSmallScreen,
    isTabletScreen,
    toggleCompactView,
    hasUnsavedChanges,
    setHasUnsavedChanges,
    hideNotes,
    setHideNotes,
    showEditButtons,
    setShowEditButtons,
  };

  return (
    <CharacterContext.Provider value={value}>
      {children}
    </CharacterContext.Provider>
  );
}

export function useCharacterContext() {
  const context = useContext(CharacterContext);
  if (context === undefined) {
    throw new Error(
      'useCharacterContext must be used within a CharacterProvider'
    );
  }
  return context;
}