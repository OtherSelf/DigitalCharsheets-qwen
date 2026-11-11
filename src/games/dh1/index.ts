import { CHARACTER_SCHEMA_VERSION } from '@/lib/character-version';

import { toPortableRecord } from '../shared/export';
import type { GameModule, SheetComponent } from '../types';
import { createDh1Defaults } from './defaults';
import { dh1CharacterSchema } from './schema';
import type { DH1Character } from './types';

/**
 * ─── LANDMARK: DH1 MODULE ──────────────────────────────────────────────────
 * Модуль Dark Heresy 1-й редакции. Capability-конфиг описывает отличия от
 * dh2 для общих компонентов: без `influence`, без колонки `+30`, усталость —
 * `fatigue1st`.
 *
 * 💬 До шага 1.4/этапа 3 лист общий (legacy): loader приводит его к типу
 * DH1Character. После переноса сюда появится собственная точка входа.
 */
export const dh1Module: GameModule<DH1Character> = {
  id: 'dh1',
  gameId: 'darkHeresy',
  order: 20,
  defaultStatus: 'published',
  nameKey: 'common.firstEdition',
  descriptionKey: 'games.dh1.description',
  schemaVersion: CHARACTER_SCHEMA_VERSION,
  schema: dh1CharacterSchema,
  i18n: { en: {}, ru: {} },
  capabilities: {
    influence: false,
    plus30: false,
    fatigueField: 'fatigue1st',
  },
  createDefaults: createDh1Defaults,
  components: {
    loadCreateForm: () =>
      import('@/components/characters/forms/dark-heresy-character-form').then(
        (m) => ({ default: m.DarkHeresyCharacterForm }),
      ),
    loadSheet: () =>
      import('@/components/sheets/dark-heresy-sheet').then((m) => ({
        // TODO(stage 3): заменить на лист dh1; пока — общий legacy-лист.
        default: m.DarkHeresySheet as unknown as SheetComponent<DH1Character>,
      })),
  },
  export: {
    toPortableJson: (character) => toPortableRecord(character),
    buildExcelSections: () => {
      // LANDMARK: EXCEL_SECTIONS — перенос секций Excel на этапе 5.
      throw new Error('dh1: секции Excel ещё не перенесены в модуль (этап 5)');
    },
  },
  migrations: [],
};
