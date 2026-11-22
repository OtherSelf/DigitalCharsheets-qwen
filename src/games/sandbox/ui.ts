import type { GameUiSlots } from '@/games/types';

import favicon from './assets/favicon.png';
import { sandboxBulkEditor } from './bulk-editor';
import { SandboxHouseRulesDialog } from './sections/house-rules-dialog';
import {
  sandboxCardSummary,
  sandboxCompactNav,
  SandboxHeaderActions,
  sandboxHeaderSubtitle,
} from './slots';
import type { SandboxCharacter } from './types';

// Next отдаёт StaticImageData, Vite (unit-тесты) — строку.
const faviconSrc =
  typeof favicon === 'string'
    ? favicon
    : (favicon as unknown as { src: string }).src;

/**
 * UI-слоты плагина (грузятся лениво через `plugin.json#ui.entry`). Здесь
 * заполнены все шесть слотов SDK плюс `favicon`: шапка, подпись, мобильная
 * навигация, карточка, массовый редактор и домашние правила.
 */
export const uiSlots: GameUiSlots<SandboxCharacter> = {
  HeaderActions: SandboxHeaderActions,
  HeaderSubtitle: sandboxHeaderSubtitle,
  CompactNav: sandboxCompactNav,
  CardSummary: sandboxCardSummary,
  BulkEditor: sandboxBulkEditor,
  HouseRulesDialog: SandboxHouseRulesDialog,
  // Иконка вкладки живёт в папке игры: ядро только ставит её в `<link>`.
  favicon: faviconSrc,
};
