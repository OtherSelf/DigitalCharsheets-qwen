'use client';

import { useState } from 'react';

import { DynamicFavicon } from '@/components/dynamic-favicon';
import { Header } from '@/components/header';
import { SharedHistoryView } from '@/components/history/shared-history-view';
import { CharacterSheet } from '@/components/sheets/character-sheet';
import { SheetStateBanner } from '@/components/sheets/sheet-state-banner';
import { UnknownSheetView } from '@/components/sheets/unknown-sheet-view';
import { Button } from '@/components/ui/button';
import { useTranslation } from '@/context/language-context';
import { SharedCharacterProvider } from '@/context/shared-character-context';
import {
  getCharacterModule,
  resolveCharacterSystemId,
} from '@/games/character-system';
import { useGameUiSlots } from '@/hooks/use-game-ui-slots';
import type { SharedHistoryPage } from '@/lib/history-types';
import type { Character } from '@/lib/types';

/**
 * ─── LANDMARK: SHARED SHEET VIEW ───────────────────────────────────────────
 * Клиентская часть гостевой страницы: тот же диспетчер листов, что и на
 * `/character/<id>`, но без аккаунта, без сайдбара и диалогов. Провайдер
 * отдаёт один лист и no-op мутации, а `inert` не пускает фокус в поля.
 *
 * Это UX-защита: запись всё равно невозможна, потому что у гостя нет cookie,
 * а owner-API отвечает 401.
 */
export function SharedSheetView({
  character,
  history,
}: {
  character: Character;
  history?: SharedHistoryPage | null;
}) {
  const { t } = useTranslation();
  const [tab, setTab] = useState<'sheet' | 'history'>('sheet');
  const systemId = resolveCharacterSystemId(character);
  const gameModule = getCharacterModule(character);
  const uiSlots = useGameUiSlots(systemId);
  const historyConfig = gameModule?.history;

  return (
    <SharedCharacterProvider character={character}>
      <DynamicFavicon href={uiSlots?.favicon} />

      <div className="flex h-dvh flex-col">
        <Header
          characterOverride={character}
          readOnly
          hideCompactToggle
          authAction="login"
        />

        <main className="safe-area-bottom flex-1 overflow-y-auto p-3 sm:p-4 md:p-6 lg:p-8">
          <SheetStateBanner
            testId="shared-read-only-banner"
            title={t('share.readOnlyTitle')}
            hint={t('share.readOnlyHint')}
          />

          {history && (
            <div
              role="tablist"
              aria-label={t('share.historyTab')}
              className="mb-3 flex flex-wrap gap-2"
            >
              <Button
                type="button"
                role="tab"
                aria-selected={tab === 'sheet'}
                variant={tab === 'sheet' ? 'default' : 'outline'}
                size="sm"
                onClick={() => setTab('sheet')}
                data-testid="shared-tab-sheet"
              >
                {t('share.sheetTab')}
              </Button>
              <Button
                type="button"
                role="tab"
                aria-selected={tab === 'history'}
                variant={tab === 'history' ? 'default' : 'outline'}
                size="sm"
                onClick={() => setTab('history')}
                data-testid="shared-tab-history"
              >
                {t('share.historyTab')}
              </Button>
            </div>
          )}

          {tab === 'history' && history ? (
            <SharedHistoryView
              history={history}
              historyConfig={historyConfig}
            />
          ) : gameModule ? (
            <div inert data-testid="shared-sheet-inert">
              <CharacterSheet
                character={character}
                activeCompactSection="info-section"
              />
            </div>
          ) : (
            <UnknownSheetView character={character} hideActions />
          )}
        </main>
      </div>
    </SharedCharacterProvider>
  );
}
