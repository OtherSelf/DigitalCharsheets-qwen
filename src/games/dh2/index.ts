import { CHARACTER_SCHEMA_VERSION } from '@/lib/character-version';

import { toPortableRecord } from '../shared/export';
import type { GameModule, SheetComponent } from '../types';
import { createDh2Defaults } from './defaults';
import { dh2CharacterSchema } from './schema';
import type { DH2Character } from './types';

/**
 * ─── LANDMARK: DH2 MODULE ──────────────────────────────────────────────────
 * Модуль Dark Heresy 2-й редакции. Capability-конфиг: `influence`, колонка
 * `+30`, усталость — `fatigue2nd`.
 *
 * 💬 До шага 1.4/этапа 3 лист общий (legacy): loader приводит его к типу
 * DH2Character. После переноса сюда появится собственная точка входа.
 */
export const dh2Module: GameModule<DH2Character> = {
  id: 'dh2',
  gameId: 'darkHeresy',
  order: 30,
  defaultStatus: 'published',
  nameKey: 'common.secondEdition',
  descriptionKey: 'games.dh2.description',
  schemaVersion: CHARACTER_SCHEMA_VERSION,
  schema: dh2CharacterSchema,
  i18n: { en: {}, ru: {} },
  capabilities: {
    influence: true,
    plus30: true,
    fatigueField: 'fatigue2nd',
  },
  createDefaults: createDh2Defaults,
  components: {
    loadCreateForm: () =>
      import('../dh-shared/create-form').then((m) => ({
        default: m.DarkHeresyCharacterForm,
      })),
    loadSheet: () =>
      import('../dh-shared/sheet').then((m) => ({
        // TODO(stage 3): заменить на лист dh2; пока — общий legacy-лист.
        default: m.DarkHeresySheet as unknown as SheetComponent<DH2Character>,
      })),
  },
  export: {
    toPortableJson: (character) => toPortableRecord(character),
    buildExcelSections: () => {
      // LANDMARK: EXCEL_SECTIONS — перенос секций Excel на этапе 5.
      throw new Error('dh2: секции Excel ещё не перенесены в модуль (этап 5)');
    },
  },
  migrations: [],
};
