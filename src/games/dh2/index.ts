import { CHARACTER_SCHEMA_VERSION } from '@/lib/character-version';

import { toPortableRecord } from '../shared/export';
import type { GameModule } from '../types';
import { createDh2Defaults } from './defaults';
import { createDh2Demo } from './demo';
import { dh2CharacterSchema } from './schema';
import type { DH2Character } from './types';

/**
 * ─── LANDMARK: DH2 MODULE ──────────────────────────────────────────────────
 * Модуль Dark Heresy 2-й редакции. Capability-конфиг: `influence`, колонка
 * `+30`, усталость — `fatigue2nd`.
 *
 * 💬 Лист — тонкая обёртка над общим DH-компонентом; редакцию определяет
 * capability, а не поле `edition` в данных.
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
  createDemo: createDh2Demo,
  components: {
    loadCreateForm: () =>
      import('./create-form').then((m) => ({ default: m.Dh2CharacterForm })),
    loadSheet: () => import('./sheet').then((m) => ({ default: m.Dh2Sheet })),
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
