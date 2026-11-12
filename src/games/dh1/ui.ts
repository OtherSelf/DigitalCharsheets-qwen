import type { GameUiSlots } from '@/games/types';

import { dh1BulkEditor } from './bulk-editor';
import { dh1CardSummary } from './slots/card-summary';
import { dh1CompactNav } from './slots/compact-nav';
import {
  Dh1HeaderActions,
  dh1HeaderSubtitle,
  Dh1HouseRulesDialogSlot,
} from './slots/header';
import type { DH1Character } from './types';

/**
 * ─── LANDMARK: DH1 UI SLOTS ──────────────────────────────────────
 * UI-слоты плагина: шапка, компактная навигация, карточка, домашние правила,
 * иконка вкладки и таблицы массового редактора. Отдельный файл, чтобы
 * `registry.generated.ts` не тянул React-компоненты и контекст хоста в общий
 * бандл и не создавал цикл `registry → slots → context → registry` (этап 3).
 * Загружается лениво через `plugin.json#ui.entry`.
 */
export const uiSlots: GameUiSlots<DH1Character> = {
  HeaderActions: Dh1HeaderActions,
  HeaderSubtitle: dh1HeaderSubtitle,
  CompactNav: dh1CompactNav,
  CardSummary: dh1CardSummary,
  HouseRulesDialog: Dh1HouseRulesDialogSlot,
  bulkEditor: dh1BulkEditor,
  favicon: '/favicon-dh.png',
};
