import type { GameUiSlots } from '@/games/types';

import { exampleBulkEditor } from './bulk-editor';
import {
  exampleCardSummary,
  exampleCompactNav,
  exampleHeaderSubtitle,
} from './slots';
import type { ExampleCharacter } from './types';

/** UI-слоты эталонного плагина (грузятся лениво через `plugin.json#ui.entry`). */
export const uiSlots: GameUiSlots<ExampleCharacter> = {
  HeaderSubtitle: exampleHeaderSubtitle,
  CompactNav: exampleCompactNav,
  CardSummary: exampleCardSummary,
  BulkEditor: exampleBulkEditor,
};
