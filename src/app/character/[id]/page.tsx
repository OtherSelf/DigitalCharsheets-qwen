// src/app/character/[id]/page.tsx
'use client';

import { useEffect, useRef, useState } from 'react';
import { useParams, useRouter } from 'next/navigation';

import Loading from '@/app/loading';
import { DynamicFavicon } from '@/components/dynamic-favicon';
import { Header } from '@/components/header';
import { GameThemeScope } from '@/components/layout/game-theme-scope';
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
import {
  getCharacterModule,
  resolveCharacterSystemId,
  resolveSheetReadOnly,
} from '@/games/character-system';
import type { SheetHandle } from '@/games/types';
import { useGameUiSlots } from '@/hooks/use-game-ui-slots';
import { characterPath, historyPath } from '@/lib/routes';

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

  // Отключённые админом плагины: их листы открываются только для чтения.
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
    if (!isCompactView) return;

    // Прокрутка откладывается на кадр: смена секции в том же коммите меняет
    // высоту листа, и до пересчёта раскладки `scrollTop` ещё держит прежнее
    // значение (браузер обрезает его лениво). Посчитанный по такому замеру
    // target уводил секцию на сотни пикселей вниз.
    const frame = requestAnimationFrame(() => {
      const element = document.getElementById(activeCompactSection);
      const scroller = element?.closest('main');
      if (!element || !(scroller instanceof HTMLElement)) {
        // Контракт плагина: id пункта CompactNav обязан совпадать с id секции.
        // Молчаливый выход делал нарушение невидимым: тап по рейлу не двигал
        // экран, а тест «секция видна» проходил, потому что компакт и так
        // скрывает остальные секции.
        if (process.env.NODE_ENV !== 'production') {
          console.warn(
            `[sheet] секция «${activeCompactSection}» из CompactNav не найдена в DOM`,
          );
        }
        return;
      }

      const scrollerRect = scroller.getBoundingClientRect();
      const elementRect = element.getBoundingClientRect();
      const scale =
        scroller.clientHeight > 0
          ? scrollerRect.height / scroller.clientHeight
          : 1;
      const max = scroller.scrollHeight - scroller.clientHeight;
      // Отступ `main` оставляем в кадре: без вычитания паддинга секция
      // встаёт на самый край scrollport и её верхняя рамка обрезается.
      const padding =
        Number.parseFloat(getComputedStyle(scroller).paddingTop) || 0;
      const top =
        scroller.scrollTop +
        (elementRect.top - scrollerRect.top) / (scale || 1) -
        padding;

      scroller.scrollTo({
        top: Math.min(Math.max(top, 0), Math.max(max, 0)),
        behavior: 'smooth',
      });
    });

    return () => cancelAnimationFrame(frame);
  }, [activeCompactSection, isCompactView, sectionScrollRequest]);

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
  // Плагин не установлен или выключен — редактирование недоступно.
  const sheetState = resolveSheetReadOnly(character, disabledIds);
  const isDisabled = sheetState.reason === 'disabled';
  const isReadOnly = sheetState.readOnly;

  return (
    <>
      {/* LANDMARK: DYNAMIC SHEET FAVICON INJECTION */}

      <DynamicFavicon href={uiSlots?.favicon} />

      <GameThemeScope systemId={systemId}>
        <div className="flex h-full flex-col">
          <Header
            readOnly={isReadOnly}
            onNotesClick={isReadOnly ? undefined : () => setNotesOpen(true)}
            onJournalClick={isReadOnly ? undefined : () => setJournalOpen(true)}
            onShareClick={isReadOnly ? undefined : () => setShareOpen(true)}
            onHistoryClick={
              isReadOnly
                ? undefined
                : () => {
                    sheetRef.current?.saveAll();
                    void flushSaves().then(() =>
                      router.push(historyPath(character.id)),
                    );
                  }
            }
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
      </GameThemeScope>
    </>
  );
}
