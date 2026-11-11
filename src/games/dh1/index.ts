import { CHARACTER_SCHEMA_VERSION } from '@/lib/character-version';

import { toPortableRecord } from '../shared/export';
import type { GameModule } from '../types';
import { createDh1Defaults } from './defaults';
import { createDh1Demo } from './demo';
import { dh1CharacterSchema } from './schema';
import type { DH1Character } from './types';

/**
 * ─── LANDMARK: DH1 MODULE ──────────────────────────────────────────────────
 * Модуль Dark Heresy 1-й редакции. Capability-конфиг описывает отличия от
 * dh2 для общих компонентов: без `influence`, без колонки `+30`, усталость —
 * `fatigue1st`.
 *
 * 💬 Лист — тонкая обёртка над общим DH-компонентом; редакцию определяет
 * capability, а не поле `edition` в данных.
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
  createDemo: createDh1Demo,
  components: {
    loadCreateForm: () =>
      import('./create-form').then((m) => ({ default: m.Dh1CharacterForm })),
    loadSheet: () => import('./sheet').then((m) => ({ default: m.Dh1Sheet })),
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
