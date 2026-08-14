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

interface CharacterContextType {
  characters: Character[];
  getCharacter: (id: string) => Character | undefined;
  addCharacter: (character: Omit<Character, 'id' | 'userId'>) => Promise<void>;
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
  const [isLoaded, setIsLoaded] = useState(false);
  
  const [userPrefersCompact, setUserPrefersCompact] = useState(false);
  const [isSmallScreen, setIsSmallScreen] = useState(false);
  const [hasUnsavedChanges, setHasUnsavedChanges] = useState(false);
  const [hideNotes, setHideNotes] = useState(false);
  const [showEditButtons, setShowEditButtons] = useState(true);

  useEffect(() => {
    const handleResize = () => setIsSmallScreen(window.innerWidth < 1300);
    handleResize();
    window.addEventListener('resize', handleResize);
    return () => window.removeEventListener('resize', handleResize);
  }, []);

  // FETCH: Load characters for the current user
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
          console.error("Failed to load characters:", err);
          setIsLoaded(true);
        });
    } else if (!isUserLoading && !user) {
      setCharacters([]);
      setIsLoaded(true);
    }
  }, [user, isUserLoading]);

  const isCompactView = isSmallScreen || userPrefersCompact;
  const toggleCompactView = () => setUserPrefersCompact((prev) => !prev);

  // CREATE: Send to server API with userId
  const addCharacter = useCallback(
    async (characterData: Omit<Character, 'id' | 'userId'>) => {
      if (!user) return;
      
      try {
        const res = await fetch('/api/characters', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ ...characterData, userId: user.uid }),
        });
        const newCharacter = await res.json();
        
        setCharacters(prev => [...prev, newCharacter]);
        toast({
          title: 'Character Created',
          description: `${newCharacter.name} has been added to your list.`,
        });
      } catch (error) {
        toast({ variant: 'destructive', title: 'Error', description: 'Failed to create character.' });
      }
    },
    [user, toast]
  );

  // UPDATE: Send to server API with userId
  const updateCharacter = useCallback(
    (id: string, data: Partial<Character>) => {
      if (!user) return;
      
      setCharacters(prev => prev.map(c => c.id === id ? { ...c, ...data } : c));
      
      fetch(`/api/characters/${id}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ ...data, userId: user.uid }),
      }).catch(err => console.error("Failed to update character:", err));
    },
    [user]
  );

  // DELETE: Send to server API with userId
  const deleteCharacter = useCallback(
    (id: string) => {
      if (!user) return;
      
      const characterToDelete = characters.find(c => c.id === id);
      setCharacters(prev => prev.filter(c => c.id !== id));
      
      fetch(`/api/characters/${id}?userId=${user.uid}`, { method: 'DELETE' })
        .then(() => {
          if (characterToDelete) {
            toast({
              title: 'Character Deleted',
              description: `${characterToDelete.name} has been removed from your list.`,
            });
          }
        })
        .catch(err => console.error("Failed to delete character:", err));
    },
    [user, characters, toast]
  );

  const getCharacter = useCallback(
    (id: string) => characters.find((c) => c.id === id),
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
    throw new Error('useCharacterContext must be used within a CharacterProvider');
  }
  return context;
}