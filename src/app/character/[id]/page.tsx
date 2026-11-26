// src/app/character/[id]/page.tsx
'use client';

import { useEffect, useRef, useState } from 'react';
import { useParams, useRouter } from 'next/navigation';

import { DynamicFavicon } from '@/components/dynamic-favicon';
import { AppFrame } from '@/components/layout/app-frame';
import { GameThemeScope } from '@/components/layout/game-theme-scope';
import { PageLoader } from '@/components/loader';
import { ShareDialog } from '@/components/share/share-dialog';
import { CharacterSheet } from '@/components/sheets/character-sheet';
import { CompactSidebar } from '@/components/sheets/compact-sidebar';
import { NotesSheet } from '@/components/sheets/notes-sheet';
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
import { useLocalAuth } from '@/context/local-auth-context';
import {
  getCharacterModule,
  resolveCharacterSystemId,
  resolveSheetReadOnly,
} from '@/games/character-system';
import type { SheetHandle } from '@/games/types';
import { useCompactSectionScroll } from '@/hooks/use-compact-section-scroll';
import { useGameUiSlots } from '@/hooks/use-game-ui-slots';
import {
  characterPath,
  currentPathname,
  historyPath,
  loginPath,
} from '@/lib/routes';

export default function CharacterPage() {
  const params = useParams<{ id: string }>();
  const router = useRouter();
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
  const { user, isUserLoading } = useLocalAuth();
  const [activeCompactSection, setActiveCompactSection] =
    useState('info-section');
  // Счётчик запросов на прокрутку: повторный тап по уже выбранному пункту
  // рейла не меняет `activeCompactSection`, но вернуть пользователя к секции
  // всё равно нужно — иначе со прокрученной страницы пункт «не работает».
  const [sectionScrollRequest, setSectionScrollRequest] = useState(0);
  const [notesOpen, setNotesOpen] = useState(false);
  const [journalOpen, setJournalOpen] = useState(false);
  const [shareOpen, setShareOpen] = useState(false);
  const [pendingSectionId, setPendingSectionId] = useState<string | null>(null);
  const sheetRef = useRef<SheetHandle | null>(null);

  const character = getCharacter(params.id);
  const systemId = character ? resolveCharacterSystemId(character) : undefined;
  const uiSlots = useGameUiSlots(systemId);
  const [disabledIds, setDisabledIds] = useState<string[]>([]);
  // Флаг «стили ядра» по редакциям. `null` — ответа ещё нет: тему не рисуем,
  // иначе первый кадр показывает тему плагина и переключается (вспышка).
  const [hostThemeById, setHostThemeById] = useState<Record<
    string,
    boolean
  > | null>(null);

  // Отключённые админом плагины: их листы открываются только для чтения.
  // Видимость по ролям приходит отдельно (/api/games), поэтому здесь нужен
  // только список отключённых — он не зависит от роли.
  useEffect(() => {
    let active = true;
    void fetch('/api/games', { cache: 'no-store' })
      .then((res) => (res.ok ? res.json() : null))
      .then(
        (
          data: {
            disabled?: string[];
            games?: { editions?: { id: string; useHostTheme?: boolean }[] }[];
          } | null,
        ) => {
          if (!active) return;
          if (Array.isArray(data?.disabled)) setDisabledIds(data.disabled);
          const themes: Record<string, boolean> = {};
          for (const game of data?.games ?? []) {
            for (const edition of game.editions ?? []) {
              themes[edition.id] = Boolean(edition.useHostTheme);
            }
          }
          setHostThemeById(themes);
        },
      )
      .catch(() => {
        // Каталог недоступен — считаем флаг известным (тема плагина), иначе
        // страница навсегда останется на экране загрузки.
        if (active) setHostThemeById({});
      });
    return () => {
      active = false;
    };
  }, []);

  // После создания «/new» может вести сюда с `?panel=notes`: плагин попросил
  // показать «Заметки» (например, там подсказки создания). Флаг из URL
  // убираем, чтобы обновление страницы не открывало Sheet повторно.
  const panelAutoOpenRef = useRef(false);
  useEffect(() => {
    if (panelAutoOpenRef.current || !character) return;
    const search = new URLSearchParams(window.location.search);
    const panel = search.get('panel');
    if (!panel) return;
    panelAutoOpenRef.current = true;
    search.delete('panel');
    const query = search.toString();
    router.replace(`${characterPath(character.id)}${query ? `?${query}` : ''}`);
    if (panel === 'notes') setNotesOpen(true);
  }, [character, router]);

  const performNavigation = (id: string) => {
    if (id === 'notes-section') {
      setNotesOpen(true);
    } else if (id === 'journal-section') {
      setJournalOpen(true);
    } else {
      setActiveCompactSection(id);
      setSectionScrollRequest((request) => request + 1);
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

  useCompactSectionScroll(
    activeCompactSection,
    isCompactView,
    sectionScrollRequest,
  );

  /*
    Гость по прямой ссылке на лист: раньше он видел «Лист не найден» — и это
    было враньём, лист существует, просто не ему. Уводим на вход и запоминаем
    цель, чтобы после входа вернуться сюда (см. `?next=` в /login).
  */
  useEffect(() => {
    if (isUserLoading || user) return;
    router.replace(loginPath(currentPathname()));
  }, [isUserLoading, user, router]);

  if (isUserLoading || !user || !isLoaded || hostThemeById === null) {
    return <PageLoader />;
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
  // Плагин не установлен или выключен — редактирование недоступно.
  const sheetState = resolveSheetReadOnly(character, disabledIds);
  const isDisabled = sheetState.reason === 'disabled';
  const isReadOnly = sheetState.readOnly;

  return (
    <>
      {/* LANDMARK: DYNAMIC SHEET FAVICON INJECTION */}

      <DynamicFavicon href={uiSlots?.favicon} />

      <GameThemeScope
        systemId={systemId}
        hostTheme={systemId ? Boolean(hostThemeById[systemId]) : false}
      >
        <AppFrame
          className="h-full"
          variant="sheet"
          header={{
            readOnly: isReadOnly,
            onNotesClick: isReadOnly ? undefined : () => setNotesOpen(true),
            onJournalClick: isReadOnly ? undefined : () => setJournalOpen(true),
            onShareClick: isReadOnly ? undefined : () => setShareOpen(true),
            onHistoryClick: isReadOnly
              ? undefined
              : () => {
                  sheetRef.current?.saveAll();
                  void flushSaves().then(() =>
                    router.push(historyPath(character.id)),
                  );
                },
          }}
          sidebar={
            isCompactView && !isReadOnly ? (
              <CompactSidebar
                character={character}
                activeSection={activeCompactSection}
                onSectionChange={handleSectionChange}
              />
            ) : undefined
          }
          after={
            <>
              {character && !isReadOnly && (
                <>
                  <NotesSheet
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
                    <AlertDialogTitle>
                      {t('common.unsavedChanges')}
                    </AlertDialogTitle>
                    <AlertDialogDescription>
                      {t('common.unsavedChangesDesc')}
                    </AlertDialogDescription>
                  </AlertDialogHeader>
                  <AlertDialogFooter>
                    <AlertDialogCancel
                      onClick={() => setPendingSectionId(null)}
                    >
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
            </>
          }
        >
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
        </AppFrame>
      </GameThemeScope>
    </>
  );
}
