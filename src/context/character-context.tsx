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
import {
  useCollection,
  useFirestore,
  //useMemoFirebase,
  useUser,
} from '@/firebase';
//import { collection, doc, DocumentReference } from 'firebase/firestore';
/*import {
  addDocumentNonBlocking,
  deleteDocumentNonBlocking,
  updateDocumentNonBlocking,
} from '@/firebase/non-blocking-updates';*/
import { MOCK_CHARACTERS } from '@/lib/mock-data';

interface CharacterContextType {
  characters: Character[];
  getCharacter: (id: string) => Character | undefined;
  addCharacter: (
    character: Omit<Character, 'id' | 'userId'>
  ) => Promise<DocumentReference | void>;
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
  const { user, isUserLoading } = useUser();
  const firestore = useFirestore();

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

  const isCompactView = isSmallScreen || userPrefersCompact;
  const toggleCompactView = () => {
    setUserPrefersCompact((prev) => !prev);
  };

  /*const characterCollectionQuery = useMemoFirebase(() => {
    if (!user) return null;
    return collection(firestore, 'users', user.uid, 'characterSheets');
  }, [firestore, user]);*/

  const { data: firestoreCharacters, isLoading: areCharactersLoading } =
    useCollection<Character>(characterCollectionQuery);

  const characters = user ? firestoreCharacters ?? [] : MOCK_CHARACTERS;
  const isLoaded = user
    ? !isUserLoading && !areCharactersLoading
    : !isUserLoading;

  const addCharacter = useCallback(
    async (
      characterData: Omit<Character, 'id' | 'userId'>
    ): Promise<DocumentReference | void> => {
      if (!user) {
        toast({
          variant: 'destructive',
          title: 'Sign In Required',
          description:
            'You must sign in with a Google account to create and save characters.',
        });
        return;
      }

      const characterCollection = collection(
        firestore,
        'users',
        user.uid,
        'characterSheets'
      );

      const characterWithUser = {
        ...characterData,
        userId: user.uid,
      };

      return addDocumentNonBlocking(characterCollection, characterWithUser);
    },
    [user, firestore, toast]
  );

  const updateCharacter = useCallback(
    (id: string, data: Partial<Character>) => {
      if (!user) {
        toast({
          variant: 'destructive',
          title: 'Sign In Required',
          description: 'You must be signed in to edit characters.',
        });
        return;
      }
      const docRef = doc(firestore, 'users', user.uid, 'characterSheets', id);
      updateDocumentNonBlocking(docRef, data);
    },
    [user, firestore, toast]
  );

  const deleteCharacter = useCallback(
    (id: string) => {
      if (!user) {
        toast({
          variant: 'destructive',
          title: 'Sign In Required',
          description: 'You must be signed in to delete characters.',
        });
        return;
      }

      const characterToDelete = firestoreCharacters?.find((c) => c.id === id);
      if (characterToDelete) {
        const docRef = doc(firestore, 'users', user.uid, 'characterSheets', id);
        deleteDocumentNonBlocking(docRef);

        toast({
          title: 'Character Deleted',
          description: `${characterToDelete.name} has been removed from your list.`,
        });
      }
    },
    [user, firestore, firestoreCharacters, toast]
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
    throw new Error(
      'useCharacterContext must be used within a CharacterProvider'
    );
  }
  return context;
}
