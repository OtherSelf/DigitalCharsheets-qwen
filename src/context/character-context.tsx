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
import {
  getLocalCharacters,
  addLocalCharacter,
  updateLocalCharacter,
  deleteLocalCharacter,
} from '@/lib/local-storage';
import { MOCK_CHARACTERS } from '@/lib/mock-data';

interface CharacterContextType {
  characters: Character[];
  getCharacter: (id: string) => Character | undefined;
  addCharacter: (character: Omit<Character, 'id' | 'userId'>) => void;
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

  const [characters, setCharacters] = useState<Character[]>([]);
  const [userPrefersCompact, setUserPrefersCompact] = useState(false);
  const [isSmallScreen, setIsSmallScreen] = useState(false);
  const [hasUnsavedChanges, setHasUnsavedChanges] = useState(false);
  const [hideNotes, setHideNotes] = useState(false);
  const [showEditButtons, setShowEditButtons] = useState(true);

  useEffect(() => {
    const handleResize = () => {
      setIsSmallScreen(window.innerWidth < 1300);
    };

    handleResize();
    window.addEventListener('resize', handleResize);
    return () => window.removeEventListener('resize', handleResize);
  }, []);

  // Load characters from local storage
  useEffect(() => {
    if (!isUserLoading) {
      if (user) {
        setCharacters(getLocalCharacters());
      } else {
        setCharacters(MOCK_CHARACTERS);
      }
    }
  }, [user, isUserLoading]);

  const isCompactView = isSmallScreen || userPrefersCompact;

  const toggleCompactView = () => {
    setUserPrefersCompact((prev) => !prev);
  };

  const addCharacter = useCallback(
    (characterData: Omit<Character, 'id' | 'userId'>) => {
      const newCharacter = addLocalCharacter(characterData);
      setCharacters(prev => [...prev, newCharacter]);
      toast({
        title: 'Character Created',
        description: `${newCharacter.name} has been added to your list.`,
      });
    },
    [toast]
  );

  const updateCharacter = useCallback(
    (id: string, data: Partial<Character>) => {
      updateLocalCharacter(id, data);
      setCharacters(prev => prev.map(c => c.id === id ? { ...c, ...data } : c));
    },
    []
  );

  const deleteCharacter = useCallback(
    (id: string) => {
      const characterToDelete = characters.find(c => c.id === id);
      deleteLocalCharacter(id);
      setCharacters(prev => prev.filter(c => c.id !== id));
      
      if (characterToDelete) {
        toast({
          title: 'Character Deleted',
          description: `${characterToDelete.name} has been removed from your list.`,
        });
      }
    },
    [characters, toast]
  );

  const getCharacter = useCallback(
    (id: string) => {
      return characters.find((c) => c.id === id);
    },
    [characters]
  );

  const value = {
    characters,
    getCharacter,
    addCharacter,
    updateCharacter,
    deleteCharacter,
    isLoaded: !isUserLoading,
    toast,
    isCompactView,
    isSmallScreen,
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