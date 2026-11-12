import type { GameUiSlots } from '@/games/types';

import { dh2BulkEditor } from './bulk-editor';
import { dh2CardSummary } from './slots/card-summary';
import { dh2CompactNav } from './slots/compact-nav';
import {
  Dh2HeaderActions,
  dh2HeaderSubtitle,
  Dh2HouseRulesDialogSlot,
} from './slots/header';
import type { DH2Character } from './types';

/**
 * ─── LANDMARK: DH2 UI SLOTS ──────────────────────────────────────
 * UI-слоты плагина: шапка, компактная навигация, карточка, домашние правила,
 * иконка вкладки и таблицы массового редактора. Отдельный файл, чтобы
 * `registry.generated.ts` не тянул React-компоненты и контекст хоста в общий
 * бандл и не создавал цикл `registry → slots → context → registry` (этап 3).
 * Загружается лениво через `plugin.json#ui.entry`.
 */
export const uiSlots: GameUiSlots<DH2Character> = {
  HeaderActions: Dh2HeaderActions,
  HeaderSubtitle: dh2HeaderSubtitle,
  CompactNav: dh2CompactNav,
  CardSummary: dh2CardSummary,
  HouseRulesDialog: Dh2HouseRulesDialogSlot,
  bulkEditor: dh2BulkEditor,
  favicon: '/favicon-dh.png',
};
