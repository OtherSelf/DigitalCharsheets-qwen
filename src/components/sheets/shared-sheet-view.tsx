'use client';

import { DynamicFavicon } from '@/components/dynamic-favicon';
import { Header } from '@/components/header';
import { CharacterSheet } from '@/components/sheets/character-sheet';
import { SheetStateBanner } from '@/components/sheets/sheet-state-banner';
import { UnknownSheetView } from '@/components/sheets/unknown-sheet-view';
import { useTranslation } from '@/context/language-context';
import { SharedCharacterProvider } from '@/context/shared-character-context';
import {
  getCharacterModule,
  resolveCharacterSystemId,
} from '@/games/character-system';
import { useGameUiSlots } from '@/hooks/use-game-ui-slots';
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
export function SharedSheetView({ character }: { character: Character }) {
  const { t } = useTranslation();
  const systemId = resolveCharacterSystemId(character);
  const gameModule = getCharacterModule(character);
  const uiSlots = useGameUiSlots(systemId);

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

          {gameModule ? (
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
