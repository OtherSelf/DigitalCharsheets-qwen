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
import { useRouter } from 'next/navigation';
import { useLocalAuth } from './local-auth-context';
import { useTranslation } from './language-context';

export const MOBILE_BREAKPOINT = 768;
export const DESKTOP_BREAKPOINT = 1300;

interface CharacterContextType {
  characters: Character[];
  getCharacter: (id: string) => Character | undefined;
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

const CharacterContext = createContext<CharacterContextType | undefined>(undefined);

export function CharacterProvider({ children }: { children: ReactNode }) {
  const { toast } = useToast();
  const router = useRouter();
  const { user, isUserLoading } = useLocalAuth();
  const { t } = useTranslation();

  const [characters, setCharacters] = useState<Character[]>([]);
  const [isLoaded, setIsLoaded] = useState(false);

  const [userPrefersCompact, setUserPrefersCompact] = useState(false);
  const [isSmallScreen, setIsSmallScreen] = useState(false);
  const [isTabletScreen, setIsTabletScreen] = useState(false);
  const [hasUnsavedChanges, setHasUnsavedChanges] = useState(false);
  const [hideNotes, setHideNotes] = useState(false);
  const [showEditButtons, setShowEditButtons] = useState(true);

  useEffect(() => {
    const handleResize = () => {
      const width = window.innerWidth;
      setIsSmallScreen(width < MOBILE_BREAKPOINT);
      setIsTabletScreen(width >= MOBILE_BREAKPOINT && width < DESKTOP_BREAKPOINT);
    };
    handleResize();
    window.addEventListener('resize', handleResize);
    return () => window.removeEventListener('resize', handleResize);
  }, []);

  useEffect(() => {
    if (!isUserLoading && user) {
      const pendingCharStr = typeof window !== 'undefined' ? sessionStorage.getItem('pending_character') : null;
      
      const loadCharacters = () => {
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
      };

      if (pendingCharStr) {
        try {
          const pendingCharData = JSON.parse(pendingCharStr);
          fetch('/api/characters', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ ...pendingCharData, userId: user.uid }),
          })
          .then(res => res.json())
          .then((newCharacter: Character) => {
             // LANDMARK: Remove from sessionStorage ONLY AFTER successful creation
             if (typeof window !== 'undefined') {
               sessionStorage.removeItem('pending_character');
             }
             // LANDMARK: Add character to state immediately before redirecting
             setCharacters(prev => [...prev, newCharacter]);
             const needsSetup = !user.hasRecoveryPhrase ? '?setup_phrase=true' : '';
             router.push(`/${newCharacter.id}${needsSetup}`);
          })
          .catch(err => {
             console.error('Failed to create pending character:', err);
             loadCharacters();
          });
        } catch (e) {
          console.error('Failed to parse pending character', e);
          loadCharacters();
        }
        return;
      }
      
      loadCharacters();
    } else if (!isUserLoading && !user) {
      setCharacters([]);
      setIsLoaded(true);
    }
  }, [user, isUserLoading]);

  const isCompactView = isSmallScreen || userPrefersCompact;
  const toggleCompactView = () => setUserPrefersCompact(prev => !prev);

  const addCharacter = useCallback(
    async (characterData: Omit<Character, 'id' | 'userId'>) => {
      if (!user) {
        if (typeof window !== 'undefined') {
          sessionStorage.setItem('pending_character', JSON.stringify(characterData));
          router.push('/login');
        }
        return undefined;
      }
      try {
        const res = await fetch('/api/characters', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ ...characterData, userId: user.uid }),
        });
        const newCharacter: Character = await res.json();
        setCharacters(prev => [...prev, newCharacter]);
        return newCharacter;
      } catch (error) {
        toast({
          variant: 'destructive',
          title: t('error'),
          description: t('failedToCreateCharacter'),
        });
        return undefined;
      }
    },
    [user, toast, t, router]
  );

  const updateCharacter = useCallback(
    (id: string, data: Partial<Character>) => {
      if (!user) return;

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
                  newCompanions[compIndex] = { ...newCompanions[compIndex], ...data };
                  fetch(`/api/characters/${char.id}`, {
                    method: 'PUT',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify({ companions: newCompanions, userId: user.uid }),
                  }).catch(err => console.error('Failed to update companion:', err));
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

      setCharacters(prev => prev.map(c => c.id === id ? ({ ...c, ...data } as Character) : c));
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

  const getCharacter = useCallback(
    (id: string) => {
      if (id.startsWith('companion-')) {
        const companionId = id.replace('companion-', '');
        for (const char of characters) {
          if (char.gameSystem === 'Dungeons & Dragons') {
            const comp = (char as any).companions?.find((c: any) => c.id === companionId);
            if (comp) return { ...char, ...comp } as any;
          }
        }
        return undefined;
      }
      return characters.find(c => c.id === id);
    },
    [characters]
  );

  const value = {
    characters, getCharacter, addCharacter, updateCharacter, deleteCharacter,
    isLoaded, toast, isCompactView, isSmallScreen, isTabletScreen,
    toggleCompactView, hasUnsavedChanges, setHasUnsavedChanges,
    hideNotes, setHideNotes, showEditButtons, setShowEditButtons,
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
    throw new Error('useCharacterContext must be used within a CharacterProvider');
  }
  return context;
}