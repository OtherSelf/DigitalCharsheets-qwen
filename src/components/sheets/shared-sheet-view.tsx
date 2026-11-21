'use client';

import { useEffect, useRef, useState } from 'react';

import { DynamicFavicon } from '@/components/dynamic-favicon';
import { Header } from '@/components/header';
import { SharedHistoryView } from '@/components/history/shared-history-view';
import { SiteFooter } from '@/components/layout/site-footer';
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
 * отдаёт один лист и no-op мутации; `readOnly` в контексте закрывает ввод,
 * но оставляет рабочими свёртки, поповеры и вкладку истории.
 *
 * Это UX-защита: запись всё равно невозможна, потому что у гостя нет cookie,
 * а owner-API отвечает 401.
 */
export function SharedSheetView({
  character,
  history,
  ownerName,
}: {
  character: Character;
  history?: SharedHistoryPage | null;
  ownerName?: string;
}) {
  const { t } = useTranslation();
  const [tab, setTab] = useState<'sheet' | 'history'>('sheet');
  const systemId = resolveCharacterSystemId(character);
  const gameModule = getCharacterModule(character);
  const uiSlots = useGameUiSlots(systemId);
  const historyConfig = gameModule?.history;
  const sheetRef = useRef<HTMLDivElement>(null);

  // Гостевая страница не должна давать ввод даже там, где секция показывает
  // поле вне режима правки (заметки в поповерах, прямые переключатели).
  // Контекст закрывает NarrativeSheet/ExperienceLog, а этот страж — остальные
  // контролы, включая порталы Radix: их DOM живёт вне листа.
  useEffect(() => {
    const lock = () => {
      document
        .querySelectorAll<HTMLElement>(
          'input, textarea, select, button[role="checkbox"], button[role="switch"]',
        )
        .forEach((element) => {
          if (
            element instanceof HTMLTextAreaElement ||
            (element instanceof HTMLInputElement &&
              element.type !== 'checkbox' &&
              element.type !== 'radio')
          ) {
            if (!element.readOnly) element.readOnly = true;
            return;
          }
          if (!element.hasAttribute('disabled')) {
            element.setAttribute('disabled', '');
          }
        });
    };
    lock();
    const observer = new MutationObserver(lock);
    observer.observe(document.body, {
      subtree: true,
      childList: true,
      attributes: true,
      attributeFilter: ['readonly', 'disabled'],
    });
    return () => observer.disconnect();
  }, []);

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

        <main className="safe-area-bottom flex flex-1 flex-col overflow-y-auto p-3 sm:p-4 md:p-6 lg:p-8 [&>*]:w-full [&>*]:min-w-0">
          <SheetStateBanner
            testId="shared-read-only-banner"
            title={t('share.readOnlyTitle')}
            hint={t('share.readOnlyHint')}
          />

          {ownerName && (
            <p
              className="text-muted-foreground mb-3 text-xs"
              data-testid="shared-owner"
            >
              {t('share.ownerName')}: {ownerName}
            </p>
          )}

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
            <div ref={sheetRef} data-testid="shared-sheet">
              <CharacterSheet
                character={character}
                activeCompactSection="info-section"
              />
            </div>
          ) : (
            <UnknownSheetView character={character} hideActions />
          )}
          <SiteFooter />
        </main>
      </div>
    </SharedCharacterProvider>
  );
}
