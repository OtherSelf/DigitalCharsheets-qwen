'use client';

import { CharacterSheet } from '@/components/sheets/character-sheet';
import { useParams, useRouter } from 'next/navigation';
import { Header } from '@/components/header';
import { useCharacterContext } from '@/context/character-context';
import Loading from '@/app/loading';
import { useEffect, useState, useRef } from 'react';
import { CompactSidebar } from '@/components/sheets/compact-sidebar';
import { NotesDialog } from '@/components/sheets/notes-dialog';
import { QuestJournalSheet } from '@/components/sheets/quest-journal-dialog';
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import { useTranslation } from '@/context/language-context';
import { cn } from '@/lib/utils';

export default function CharacterPage() {
  const params = useParams<{ id: string }>();
  const router = useRouter();
  const { getCharacter, isLoaded, isCompactView, hasUnsavedChanges, setHasUnsavedChanges } = useCharacterContext();
  const { t } = useTranslation();
  const [activeCompactSection, setActiveCompactSection] = useState('info-section');
  const [notesOpen, setNotesOpen] = useState(false);
  const [journalOpen, setJournalOpen] = useState(false);
  const [pendingSectionId, setPendingSectionId] = useState<string | null>(null);
  const sheetRef = useRef<any>(null);
  
  const character = getCharacter(params.id);

  useEffect(() => {
    if (isLoaded && !character) {
      router.push('/');
    }
  }, [isLoaded, character, router]);
  
  const performNavigation = (id: string) => {
    if (id === 'notes-section') {
      setNotesOpen(true);
    } else if (id === 'journal-section') {
      setJournalOpen(true);
    } else {
      setActiveCompactSection(id);
    }
  };

  const handleSectionChange = (id: string) => {
    if (isCompactView && hasUnsavedChanges) {
      setPendingSectionId(id);
      return;
    }
    performNavigation(id);
  };

  const confirmFailsafe = (save: boolean) => {
    if (save && sheetRef.current?.saveAll) {
      sheetRef.current.saveAll();
    }
    
    const id = pendingSectionId;
    setPendingSectionId(null);
    setHasUnsavedChanges(false);
    
    if (id) {
      performNavigation(id);
    }
  };

  useEffect(() => {
    if (isCompactView && activeCompactSection !== 'info-section') {
      const element = document.getElementById(activeCompactSection);
      if (element) {
        element.scrollIntoView({ behavior: 'smooth', block: 'start' });
      }
    }
  }, [activeCompactSection, isCompactView]);

  if (!isLoaded || !character) {
    return <Loading />;
  }

  return (
    <div className="flex flex-col h-full">
      <Header onNotesClick={() => setNotesOpen(true)} onJournalClick={() => setJournalOpen(true)} />
      <div className="flex flex-1 overflow-hidden">
        {isCompactView && <CompactSidebar gameSystem={character.gameSystem} activeSection={activeCompactSection} onSectionChange={handleSectionChange} />}
        <main className="flex-1 p-4 md:p-6 lg:p-8 overflow-y-auto">
          <CharacterSheet 
            ref={sheetRef}
            character={character} 
            activeCompactSection={activeCompactSection} 
          />
        </main>
      </div>
      
      {character && (
        <>
            <NotesDialog
                character={character}
                open={notesOpen}
                onOpenChange={setNotesOpen}
            />
            <QuestJournalSheet
                character={character}
                open={journalOpen}
                onOpenChange={setJournalOpen}
            />
        </>
      )}

      <AlertDialog open={!!pendingSectionId} onOpenChange={(open) => !open && setPendingSectionId(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>{t('unsavedChanges')}</AlertDialogTitle>
            <AlertDialogDescription>{t('unsavedChangesDesc')}</AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel onClick={() => setPendingSectionId(null)}>{t('stayAndEdit')}</AlertDialogCancel>
            <AlertDialogAction 
              variant="outline" 
              onClick={() => confirmFailsafe(false)}
              className="border-destructive text-destructive hover:bg-destructive hover:text-destructive-foreground"
            >
              {t('discardAndContinue')}
            </AlertDialogAction>
            <AlertDialogAction onClick={() => confirmFailsafe(true)}>
              {t('saveAndContinue')}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}
