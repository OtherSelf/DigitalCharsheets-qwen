import type { GameUiSlots } from '@/games/types';

import favicon from './assets/favicon.png';
import { sandboxBulkEditor } from './bulk-editor';
import {
  sandboxCardSummary,
  sandboxCompactNav,
  sandboxHeaderSubtitle,
} from './slots';
import type { SandboxCharacter } from './types';

// Next отдаёт StaticImageData, Vite (unit-тесты) — строку.
const faviconSrc =
  typeof favicon === 'string'
    ? favicon
    : (favicon as unknown as { src: string }).src;

/** UI-слоты плагина (грузятся лениво через `plugin.json#ui.entry`). */
export const uiSlots: GameUiSlots<SandboxCharacter> = {
  HeaderSubtitle: sandboxHeaderSubtitle,
  CompactNav: sandboxCompactNav,
  CardSummary: sandboxCardSummary,
  BulkEditor: sandboxBulkEditor,
  // Иконка вкладки живёт в папке игры: ядро только ставит её в `<link>`.
  favicon: faviconSrc,
};
