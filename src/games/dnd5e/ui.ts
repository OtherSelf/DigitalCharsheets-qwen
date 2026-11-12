import type { GameUiSlots } from '@/games/types';

import { dnd5eBulkEditor } from './bulk-editor';
import { dnd5eCardSummary } from './slots/card-summary';
import { dnd5eCompactNav } from './slots/compact-nav';
import {
  dnd5eHeaderSubtitle,
  DndHeaderActions,
  DndHouseRulesDialogSlot,
} from './slots/header';
import type { DnD5eCharacter } from './types';

/**
 * ─── LANDMARK: DND5E UI SLOTS ──────────────────────────────────────
 * UI-слоты плагина: шапка, компактная навигация, карточка, домашние правила,
 * иконка вкладки и таблицы массового редактора. Отдельный файл, чтобы
 * `registry.generated.ts` не тянул React-компоненты и контекст хоста в общий
 * бандл и не создавал цикл `registry → slots → context → registry` (этап 3).
 * Загружается лениво через `plugin.json#ui.entry`.
 */
export const uiSlots: GameUiSlots<DnD5eCharacter> = {
  HeaderActions: DndHeaderActions,
  HeaderSubtitle: dnd5eHeaderSubtitle,
  CompactNav: dnd5eCompactNav,
  CardSummary: dnd5eCardSummary,
  HouseRulesDialog: DndHouseRulesDialogSlot,
  bulkEditor: dnd5eBulkEditor,
  favicon: '/favicon-dnd.png',
};
