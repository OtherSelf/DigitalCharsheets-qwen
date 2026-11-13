// src/app/character/[id]/page.tsx
'use client';

import { useEffect, useRef, useState } from 'react';
import { useParams } from 'next/navigation';

import Loading from '@/app/loading';
import { DynamicFavicon } from '@/components/dynamic-favicon';
import { Header } from '@/components/header';
import { ShareDialog } from '@/components/share/share-dialog';
import { CharacterSheet } from '@/components/sheets/character-sheet';
import { CompactSidebar } from '@/components/sheets/compact-sidebar';
import { NotesDialog } from '@/components/sheets/notes-dialog';
import { QuestJournalSheet } from '@/components/sheets/quest-journal-dialog';
import { SheetStateBanner } from '@/components/sheets/sheet-state-banner';
import { UnknownSheetView } from '@/components/sheets/unknown-sheet-view';
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
import { UnavailableState } from '@/components/unavailable-state';
import { useCharacterContext } from '@/context/character-context';
import { useTranslation } from '@/context/language-context';
import {
  getCharacterModule,
  resolveCharacterSystemId,
  resolveSheetReadOnly,
} from '@/games/character-system';
import type { SheetHandle } from '@/games/types';
import { useGameUiSlots } from '@/hooks/use-game-ui-slots';

export default function CharacterPage() {
  const params = useParams<{ id: string }>();
  const {
    getCharacter,
    isLoaded,
    loadError,
    retryCharacters,
    isCompactView,
    hasUnsavedChanges,
    setHasUnsavedChanges,
    flushSaves,
  } = useCharacterContext();
  const { t } = useTranslation();
  const [activeCompactSection, setActiveCompactSection] =
    useState('info-section');
  const [notesOpen, setNotesOpen] = useState(false);
  const [journalOpen, setJournalOpen] = useState(false);
  const [shareOpen, setShareOpen] = useState(false);
  const [pendingSectionId, setPendingSectionId] = useState<string | null>(null);
  const sheetRef = useRef<SheetHandle | null>(null);

  const character = getCharacter(params.id);
  const systemId = character ? resolveCharacterSystemId(character) : undefined;
  const uiSlots = useGameUiSlots(systemId);
  const [disabledIds, setDisabledIds] = useState<string[]>([]);

  // Отключённые админом плагины: их листы открываются только для чтения (D9).
  // Видимость по ролям приходит отдельно (/api/games), поэтому здесь нужен
  // только список отключённых — он не зависит от роли.
  useEffect(() => {
    let active = true;
    void fetch('/api/games', { cache: 'no-store' })
      .then((res) => (res.ok ? res.json() : null))
      .then((data: { disabled?: string[] } | null) => {
        if (active && Array.isArray(data?.disabled)) {
          setDisabledIds(data.disabled);
        }
      })
      .catch(() => undefined);
    return () => {
      active = false;
    };
  }, []);

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

  if (!isLoaded) {
    return <Loading />;
  }

  if (!character) {
    // Неизвестный/удалённый id — это не «вечная загрузка», а понятный экран.
    // При сетевой ошибке предлагаем повторить, иначе — ссылку на главную.
    return loadError ? (
      <UnavailableState
        testId="sheet-load-error"
        title={t('common.loadErrorTitle')}
        description={t('common.loadErrorDesc')}
        actionLabel={t('common.retry')}
        onAction={() => void retryCharacters()}
      />
    ) : (
      <UnavailableState
        testId="sheet-not-found"
        title={t('common.characterNotFound')}
        description={t('common.characterNotFoundDesc')}
      />
    );
  }

  const gameModule = getCharacterModule(character);
  // Плагин не установлен или выключен — редактирование недоступно (D9).
  const sheetState = resolveSheetReadOnly(character, disabledIds);
  const isDisabled = sheetState.reason === 'disabled';
  const isReadOnly = sheetState.readOnly;

  return (
    <>
      {/* LANDMARK: DYNAMIC SHEET FAVICON INJECTION */}

      <DynamicFavicon href={uiSlots?.favicon} />

      <div className="flex h-full flex-col">
        <Header
          readOnly={isReadOnly}
          onNotesClick={isReadOnly ? undefined : () => setNotesOpen(true)}
          onJournalClick={isReadOnly ? undefined : () => setJournalOpen(true)}
          onShareClick={isReadOnly ? undefined : () => setShareOpen(true)}
        />
        <div className="flex flex-1 overflow-hidden">
          {isCompactView && !isReadOnly && (
            <CompactSidebar
              character={character}
              activeSection={activeCompactSection}
              onSectionChange={handleSectionChange}
            />
          )}
          <main className="flex-1 overflow-y-auto p-4 md:p-6 lg:p-8">
            {isDisabled && (
              <SheetStateBanner
                testId="game-disabled-banner"
                title={t('common.gameDisabled')}
                hint={t('common.gameDisabledHint')}
              />
            )}
            {!gameModule ? (
              <UnknownSheetView character={character} />
            ) : (
              <div inert={isDisabled}>
                <CharacterSheet
                  ref={sheetRef}
                  character={character}
                  activeCompactSection={activeCompactSection}
                />
              </div>
            )}
          </main>
        </div>
        {character && !isReadOnly && (
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
            <ShareDialog
              characterId={character.id}
              open={shareOpen}
              onOpenChange={setShareOpen}
              onBeforeCreate={async () => {
                sheetRef.current?.saveAll();
                await flushSaves();
              }}
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
