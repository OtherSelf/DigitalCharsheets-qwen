import type { GameUiSlots } from '@/games/types';

import favicon from './assets/favicon.png';
import { exampleBulkEditor } from './bulk-editor';
import {
  exampleCardSummary,
  exampleCompactNav,
  exampleHeaderSubtitle,
} from './slots';
import type { ExampleCharacter } from './types';

// Next отдаёт StaticImageData, Vite (unit-тесты) — строку.
const faviconSrc =
  typeof favicon === 'string'
    ? favicon
    : (favicon as unknown as { src: string }).src;

/** UI-слоты эталонного плагина (грузятся лениво через `plugin.json#ui.entry`). */
export const uiSlots: GameUiSlots<ExampleCharacter> = {
  HeaderSubtitle: exampleHeaderSubtitle,
  CompactNav: exampleCompactNav,
  CardSummary: exampleCardSummary,
  BulkEditor: exampleBulkEditor,
  favicon: faviconSrc,
};
