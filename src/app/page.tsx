// src/app/page.tsx

'use client';

import { useMemo, useState } from 'react';
import Link from 'next/link';

import {
  closestCenter,
  DndContext,
  KeyboardSensor,
  PointerSensor,
  useSensor,
  useSensors,
  type Announcements,
  type DragEndEvent,
} from '@dnd-kit/core';
import {
  arrayMove,
  rectSortingStrategy,
  SortableContext,
  sortableKeyboardCoordinates,
} from '@dnd-kit/sortable';
import { Archive, PlusCircle, Scroll } from 'lucide-react';

import { SortableCharacterCard } from '@/components/characters/sortable-character-card';
import { DemoLandingView } from '@/components/demo-landing-view';
import { DynamicFavicon } from '@/components/dynamic-favicon';
import { ImportCharacterDialog } from '@/components/import-character-dialog';
import { AppFrame } from '@/components/layout/app-frame';
import { PageLoader } from '@/components/loader';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { Button } from '@/components/ui/button';
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from '@/components/ui/card';
import { useCharacterContext } from '@/context/character-context';
import { useTranslation } from '@/context/language-context';
import { useLocalAuth } from '@/context/local-auth-context';
import { resolveCharacterSystemId } from '@/games/character-system';
import { getPluginManifest } from '@/games/registry';
import type { SystemId } from '@/games/types';
import { useEditionThemeFlags } from '@/hooks/use-edition-theme';
import { gameAccentCss } from '@/lib/game-theme';
import { cn } from '@/lib/utils';

// LANDMARK: MAIN_DASHBOARD_PAGE
export default function DashboardPage() {
  const {
    characters,
    isLoaded,
    loadError,
    retryCharacters,
    isCompactView,
    pendingDraft,
    createPendingDraft,
    discardPendingDraft,
    reorderCharacters,
    toast,
  } = useCharacterContext();
  const { user, isUserLoading } = useLocalAuth();
  const { t } = useTranslation();
  const [isRetrying, setIsRetrying] = useState(false);

  // Перетаскивание карточек: тянем только за ручку (сенсоры навешаны на неё),
  // поэтому клик по карточке и выделение текста не превращаются в drag.
  const sensors = useSensors(
    useSensor(PointerSensor, { activationConstraint: { distance: 8 } }),
    useSensor(KeyboardSensor, {
      coordinateGetter: sortableKeyboardCoordinates,
    }),
  );
  const orderedIds = characters.map((character) => character.id);

  // Акцент редакции: один `<style>` на страницу, только для видимых редакций,
  // у которых админ не включил «стили ядра». Пока флагов нет — нейтральные
  // карточки, чтобы не было вспышки чужой темы.
  const themeFlags = useEditionThemeFlags();
  const accentCss = useMemo(() => {
    if (!themeFlags) return '';
    const seen = new Set<string>();
    let css = '';
    for (const character of characters) {
      const systemId = resolveCharacterSystemId(character);
      if (!systemId || seen.has(systemId) || themeFlags[systemId]) continue;
      seen.add(systemId);
      css += gameAccentCss(
        systemId,
        getPluginManifest(systemId as SystemId)?.ui?.theme,
      );
    }
    return css;
  }, [characters, themeFlags]);
  const nameById = new Map(
    characters.map((character) => [character.id, character.name]),
  );
  const announcements: Announcements = {
    onDragStart: ({ active }) =>
      t('common.reorderPicked', {
        name: nameById.get(String(active.id)) ?? '',
      }),
    onDragOver: ({ over }) =>
      t('common.reorderOver', { name: nameById.get(String(over?.id)) ?? '' }),
    onDragEnd: () => t('common.reorderDropped'),
    onDragCancel: () => t('common.reorderCancelled'),
  };

  const handleDragEnd = ({ active, over }: DragEndEvent) => {
    if (!over || active.id === over.id) return;
    const oldIndex = orderedIds.indexOf(String(active.id));
    const newIndex = orderedIds.indexOf(String(over.id));
    if (oldIndex < 0 || newIndex < 0) return;

    void reorderCharacters(arrayMove(orderedIds, oldIndex, newIndex)).then(
      (saved) => {
        if (saved) return;
        toast({
          title: t('common.error'),
          description: t('common.reorderFailed'),
          variant: 'destructive',
        });
      },
    );
  };

  const handleRetry = async () => {
    setIsRetrying(true);
    try {
      await retryCharacters();
    } finally {
      setIsRetrying(false);
    }
  };

  if (!isLoaded || isUserLoading) {
    return <PageLoader />;
  }

  // LANDMARK: UNREGISTERED_DEMO_VIEW_REDIRECT
  if (!user) {
    return <DemoLandingView />;
  }

  return (
    <>
      <DynamicFavicon />
      <AppFrame header={{}}>
        {/* LANDMARK: PENDING_DRAFT_BANNER
              Персонаж, начерченный гостем до входа, не создаётся автоматически
              в существующем аккаунте: он ждёт здесь явного решения. Иначе после
              входа список выглядел так, будто старые листы потерялись. */}
        {pendingDraft && (
          <Alert
            className="border-primary/30 bg-primary/5 mb-6"
            data-testid="pending-draft"
          >
            <Scroll className="text-primary h-4 w-4" />
            <AlertDescription className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
              <div className="min-w-0">
                <p className="text-foreground font-medium">
                  {t('common.pendingDraftTitle')}
                </p>
                <p className="text-muted-foreground">
                  {t('common.pendingDraftDesc').replace(
                    '{name}',
                    String(pendingDraft.name ?? '') || '—',
                  )}
                </p>
              </div>
              <div className="flex shrink-0 flex-col gap-2 sm:flex-row">
                <Button
                  size="sm"
                  onClick={createPendingDraft}
                  data-testid="pending-draft-create"
                >
                  <PlusCircle className="mr-2 h-4 w-4" />
                  {t('common.pendingDraftCreate')}
                </Button>
                <Button
                  size="sm"
                  variant="outline"
                  onClick={discardPendingDraft}
                  data-testid="pending-draft-discard"
                >
                  {t('common.pendingDraftDiscard')}
                </Button>
              </div>
            </AlertDescription>
          </Alert>
        )}

        <div className="mb-6 flex flex-col gap-4 sm:mb-8">
          <div className="flex flex-col gap-2">
            <h1 className="font-headline text-2xl font-bold sm:text-3xl">
              {t('common.existingCharacters')}
            </h1>
            <p className="text-muted-foreground max-w-2xl text-sm sm:text-base">
              {t('common.companionText')}
            </p>
          </div>
        </div>

        <Card>
          <CardHeader className="flex flex-row items-start justify-between gap-3">
            <div className="min-w-0">
              <CardTitle>{t('common.myCharacters')}</CardTitle>
              <CardDescription>{t('common.allHeroes')}</CardDescription>
            </div>
            <Button
              variant="outline"
              size="sm"
              asChild
              className="shrink-0"
              data-testid="open-archive"
            >
              <Link href="/archive" aria-label={t('common.archive')}>
                <Archive className="h-4 w-4 sm:mr-2" />
                <span className="hidden sm:inline">{t('common.archive')}</span>
              </Link>
            </Button>
          </CardHeader>
          <CardContent>
            {loadError && characters.length === 0 ? (
              <div
                data-testid="characters-load-error"
                className="flex flex-col items-start gap-3 rounded-lg border p-4"
              >
                <div>
                  <p className="font-medium">{t('common.loadErrorTitle')}</p>
                  <p className="text-muted-foreground text-sm">
                    {t('common.loadErrorDesc')}
                  </p>
                </div>
                <Button
                  onClick={() => void handleRetry()}
                  disabled={isRetrying}
                >
                  {t('common.retry')}
                </Button>
              </div>
            ) : (
              <DndContext
                sensors={sensors}
                collisionDetection={closestCenter}
                onDragEnd={handleDragEnd}
                accessibility={{
                  announcements,
                  screenReaderInstructions: {
                    draggable: t('common.reorderHint'),
                  },
                }}
              >
                {accentCss ? <style>{accentCss}</style> : null}
                <SortableContext
                  items={orderedIds}
                  strategy={rectSortingStrategy}
                >
                  <div
                    className={cn(
                      'grid gap-4',
                      isCompactView
                        ? 'grid-cols-1'
                        : // Колонок столько, сколько помещается при минимальной
                          // ширине карточки 18rem (288px): 3 на планшете, 4 на
                          // 1440, 5 на 1760. Прежняя лестница `lg:3 xl:4` не
                          // давала пятой и оставляла «мёртвую» полосу 1280–1300.
                          '[grid-template-columns:repeat(auto-fill,minmax(18rem,1fr))]',
                    )}
                  >
                    {characters.map((character) => {
                      const systemId = resolveCharacterSystemId(character);
                      return (
                        <SortableCharacterCard
                          key={character.id}
                          character={character}
                          accent={Boolean(
                            themeFlags && systemId && !themeFlags[systemId],
                          )}
                        />
                      );
                    })}
                    {isCompactView ? (
                      <Button
                        variant="outline"
                        asChild
                        className="border-muted-foreground/30 text-muted-foreground hover:border-accent hover:bg-accent/10 hover:text-accent-foreground flex h-16 w-full items-center justify-center rounded-lg border-2 border-dashed bg-transparent p-0 transition-colors duration-200 sm:h-20"
                      >
                        <Link href="/new">
                          <PlusCircle className="mr-3 h-6 w-6 sm:mr-4 sm:h-8 sm:w-8" />
                          <span className="text-sm font-semibold sm:text-base">
                            {t('common.createNew')}
                          </span>
                        </Link>
                      </Button>
                    ) : (
                      <Button
                        variant="outline"
                        asChild
                        className="border-muted-foreground/30 text-muted-foreground hover:border-accent hover:bg-accent/10 hover:text-accent-foreground flex h-full min-h-[180px] w-full flex-col items-center justify-center rounded-lg border-2 border-dashed bg-transparent p-0 transition-colors duration-200 sm:min-h-[200px]"
                      >
                        <Link href="/new">
                          <PlusCircle className="mb-2 h-10 w-10 sm:h-12 sm:w-12" />
                          <span className="text-sm font-semibold sm:text-base">
                            {t('common.createNew')}
                          </span>
                        </Link>
                      </Button>
                    )}
                    <ImportCharacterDialog isCompactView={isCompactView} />
                  </div>
                </SortableContext>
              </DndContext>
            )}
          </CardContent>
        </Card>
      </AppFrame>
    </>
  );
}
