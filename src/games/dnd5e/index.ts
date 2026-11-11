import { CHARACTER_SCHEMA_VERSION } from '@/lib/character-version';

import { toPortableRecord } from '../shared/export';
import type { GameModule } from '../types';
import { createDnd5eDefaults } from './defaults';
import { createDnd5eDemo } from './demo';
import { en as dnd5eEn } from './i18n/en';
import { ru as dnd5eRu } from './i18n/ru';
import { dnd5eCharacterSchema } from './schema';
import type { DnD5eCharacter } from './types';

/**
 * ─── LANDMARK: DND5E MODULE ────────────────────────────────────────────────
 * Модуль D&D 5e: метаданные для реестра и ленивые точки входа в UI. Пока
 * форма и лист лежат по старым путям (`src/components/...`); на шаге 1.4 они
 * переедут в `src/games/dnd5e/` и loader'ы поменяются без правок ядра.
 */
export const dnd5eModule: GameModule<DnD5eCharacter> = {
  id: 'dnd5e',
  gameId: 'dnd',
  order: 10,
  defaultStatus: 'published',
  nameKey: 'games.dnd5e.name',
  descriptionKey: 'games.dnd5e.description',
  schemaVersion: CHARACTER_SCHEMA_VERSION,
  schema: dnd5eCharacterSchema,
  i18n: { en: dnd5eEn, ru: dnd5eRu },
  capabilities: {},
  createDefaults: createDnd5eDefaults,
  createDemo: createDnd5eDemo,
  components: {
    loadCreateForm: () =>
      import('./create-form').then((m) => ({
        default: m.DndCharacterForm,
      })),
    loadSheet: () =>
      import('./sheet').then((m) => ({
        default: m.DndSheet,
      })),
  },
  export: {
    toPortableJson: (character) => toPortableRecord(character),
    buildExcelSections: () => {
      // LANDMARK: EXCEL_SECTIONS — секции Excel переезжают из
      // `src/lib/export-utils.ts` в модуль на этапе 5.
      throw new Error(
        'dnd5e: секции Excel ещё не перенесены в модуль (этап 5)',
      );
    },
  },
  migrations: [],
};
