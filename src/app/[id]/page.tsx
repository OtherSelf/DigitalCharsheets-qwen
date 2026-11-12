// src/app/[id]/page.tsx
'use client';

import { useEffect, useRef, useState } from 'react';
import { useParams, useRouter } from 'next/navigation';

import Loading from '@/app/loading';
import { DynamicFavicon } from '@/components/dynamic-favicon';
import { Header } from '@/components/header';
import { CharacterSheet } from '@/components/sheets/character-sheet';
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
} from '@/components/ui/alert-dialog';
import { useCharacterContext } from '@/context/character-context';
import { useTranslation } from '@/context/language-context';
import { getCharacterModule } from '@/games/character-system';
import type { SheetHandle } from '@/games/types';
import { cn } from '@/lib/utils';

export default function CharacterPage() {
  const params = useParams<{ id: string }>();
  const router = useRouter();
  const {
    getCharacter,
    isLoaded,
    isCompactView,
    hasUnsavedChanges,
    setHasUnsavedChanges,
  } = useCharacterContext();
  const { t } = useTranslation();
  const [activeCompactSection, setActiveCompactSection] =
    useState('info-section');
  const [notesOpen, setNotesOpen] = useState(false);
  const [journalOpen, setJournalOpen] = useState(false);
  const [pendingSectionId, setPendingSectionId] = useState<string | null>(null);
  const sheetRef = useRef<SheetHandle | null>(null);

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

  /*
    LANDMARK: SCROLL_ONLY_INSIDE_MAIN
    Прокручиваем ТОЛЬКО контейнер контента, а не `scrollIntoView()`.
    `scrollIntoView` двигает всех прокручиваемых предков, включая корень
    документа; при масштабе интерфейса ≠ 100% у корня есть «излишек»
    высоты, и он уезжал вместе с шапкой и левым меню. Здесь корень не
    участвует вообще: считаем смещение секции внутри `<main>` и скроллим
    его. Делим на эффективный масштаб (у оболочки `transform: scale()`),
    потому что `getBoundingClientRect()` возвращает визуальные пиксели,
    а `scrollTop` — layout-пиксели.
  */
  useEffect(() => {
    if (!isCompactView || activeCompactSection === 'info-section') return;
    const element = document.getElementById(activeCompactSection);
    const scroller = element?.closest('main');
    if (!element || !(scroller instanceof HTMLElement)) return;

    const scrollerRect = scroller.getBoundingClientRect();
    const elementRect = element.getBoundingClientRect();
    const scale =
      scroller.clientHeight > 0
        ? scrollerRect.height / scroller.clientHeight
        : 1;
    const top =
      scroller.scrollTop + (elementRect.top - scrollerRect.top) / (scale || 1);

    scroller.scrollTo({ top, behavior: 'smooth' });
  }, [activeCompactSection, isCompactView]);

  if (!isLoaded || !character) {
    return <Loading />;
  }

  const gameModule = getCharacterModule(character);

  return (
    <>
      {/* LANDMARK: DYNAMIC SHEET FAVICON INJECTION */}

      <DynamicFavicon href={gameModule?.ui?.favicon} />

      <div className="flex h-full flex-col">
        <Header
          onNotesClick={() => setNotesOpen(true)}
          onJournalClick={() => setJournalOpen(true)}
        />
        <div className="flex flex-1 overflow-hidden">
          {isCompactView && (
            <CompactSidebar
              character={character}
              activeSection={activeCompactSection}
              onSectionChange={handleSectionChange}
            />
          )}
          <main className="flex-1 overflow-y-auto p-4 md:p-6 lg:p-8">
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
        <AlertDialog
          open={!!pendingSectionId}
          onOpenChange={(open) => !open && setPendingSectionId(null)}
        >
          <AlertDialogContent>
            <AlertDialogHeader>
              <AlertDialogTitle>{t('common.unsavedChanges')}</AlertDialogTitle>
              <AlertDialogDescription>
                {t('common.unsavedChangesDesc')}
              </AlertDialogDescription>
            </AlertDialogHeader>
            <AlertDialogFooter>
              <AlertDialogCancel onClick={() => setPendingSectionId(null)}>
                {t('common.stayAndEdit')}
              </AlertDialogCancel>
              <AlertDialogAction
                onClick={() => confirmFailsafe(false)}
                className="border-destructive text-destructive hover:bg-destructive hover:text-destructive-foreground"
              >
                {t('common.discardAndContinue')}
              </AlertDialogAction>
              <AlertDialogAction onClick={() => confirmFailsafe(true)}>
                {t('auth.saveAndContinue')}
              </AlertDialogAction>
            </AlertDialogFooter>
          </AlertDialogContent>
        </AlertDialog>
      </div>
    </>
  );
}
