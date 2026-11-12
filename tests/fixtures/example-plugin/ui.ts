import type { GameUiSlots } from '@/games/types';

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
};
