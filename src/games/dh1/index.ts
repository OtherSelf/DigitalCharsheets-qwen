import { CHARACTER_SCHEMA_VERSION } from '@/lib/character-version';

import { buildDarkHeresyExcelSections } from '../dh-shared/excel';
import { buildDarkHeresyPortableJson } from '../dh-shared/export';
import type { GameModule } from '../types';
import { createDh1Defaults } from './defaults';
import { createDh1Demo } from './demo';
import { en as dh1En } from './i18n/en';
import { ru as dh1Ru } from './i18n/ru';
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
  nameKey: 'games.dh1.name',
  descriptionKey: 'games.dh1.description',
  schemaVersion: CHARACTER_SCHEMA_VERSION,
  schema: dh1CharacterSchema,
  i18n: { en: dh1En, ru: dh1Ru },
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
    toPortableJson: (character, config) =>
      buildDarkHeresyPortableJson(character, config),
    buildExcelSections: (character, config, translate) =>
      buildDarkHeresyExcelSections(character, config, translate),
  },
  migrations: [],
};
