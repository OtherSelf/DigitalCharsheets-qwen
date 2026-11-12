'use client';

import React, { forwardRef, Suspense } from 'react';

import { Loader } from '@/components/loader';
import { useCharacterContext } from '@/context/character-context';
import { resolveCharacterSystemId } from '@/games/character-system';
import { getGameModule } from '@/games/registry';
import type { SheetHandle } from '@/games/types';
import { type Character } from '@/lib/types';

import { SheetErrorBoundary } from './sheet-error-boundary';

/**
 * ─── LANDMARK: SHEET DISPATCHER ────────────────────────────────────────────
 * Лист выбирается по `systemId` через реестр: ядро больше не импортирует
 * компоненты редакций напрямую (этап 3). Компонент грузится лениво
 * (`components.loadSheet`), оборачивается в `Suspense` и `ErrorBoundary`,
 * а `ref` имеет типизированный контракт `SheetHandle.saveAll()`.
 *
 * Ошибка плагина не роняет страницу: шапка/сайдбар/диалоги рисуются ядром, а
 * вместо листа показывается «лист недоступен».
 */
export const CharacterSheet = forwardRef<
  SheetHandle,
  { character: Character; activeCompactSection: string }
>(({ character, activeCompactSection }, ref) => {
  const { isCompactView } = useCharacterContext();
  const systemId = resolveCharacterSystemId(character);
  const gameModule = systemId ? getGameModule(systemId) : undefined;

  // Lazy-компонент создаётся один раз на модуль: повторный рендер не
  // перезагружает бандл листа.
  const Sheet = React.useMemo(() => {
    if (!gameModule) return null;
    return React.lazy(gameModule.components.loadSheet);
  }, [gameModule]);

  if (!Sheet || !gameModule) return null;

  return (
    <SheetErrorBoundary systemId={systemId}>
      <Suspense
        fallback={
          <div
            className="flex items-center justify-center p-12"
            data-testid="sheet-loading"
          >
            <Loader className="h-6 w-6" />
          </div>
        }
      >
        <Sheet
          ref={ref}
          character={character}
          isCompactView={isCompactView}
          activeCompactSection={activeCompactSection}
        />
      </Suspense>
    </SheetErrorBoundary>
  );
});

CharacterSheet.displayName = 'CharacterSheet';
