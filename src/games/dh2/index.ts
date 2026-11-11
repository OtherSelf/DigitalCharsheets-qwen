import { CHARACTER_SCHEMA_VERSION } from '@/lib/character-version';

import { buildDarkHeresyExcelSections } from '../dh-shared/excel';
import { buildDarkHeresyPortableJson } from '../dh-shared/export';
import type { GameModule } from '../types';
import { createDh2Defaults } from './defaults';
import { createDh2Demo } from './demo';
import { en as dh2En } from './i18n/en';
import { ru as dh2Ru } from './i18n/ru';
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
  nameKey: 'games.dh2.name',
  descriptionKey: 'games.dh2.description',
  schemaVersion: CHARACTER_SCHEMA_VERSION,
  schema: dh2CharacterSchema,
  i18n: { en: dh2En, ru: dh2Ru },
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
    toPortableJson: (character, config) =>
      buildDarkHeresyPortableJson(character, config),
    buildExcelSections: (character, config, translate) =>
      buildDarkHeresyExcelSections(character, config, translate),
  },
  migrations: [],
};
