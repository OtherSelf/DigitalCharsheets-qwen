import { CHARACTER_SCHEMA_VERSION } from '@/lib/character-version';

import type { GameModule } from '../types';
import { createDh1Defaults } from './defaults';
import { createDh1Demo } from './demo';
import { buildDh1ExcelSections } from './excel';
import { buildDh1PortableJson } from './export';
import { en as dh1En } from './i18n/en';
import { ru as dh1Ru } from './i18n/ru';
import { dh1CharacterSchema } from './schema';
import type { DH1Character } from './types';

/**
 * ─── LANDMARK: DH1 MODULE ──────────────────────────────────────────────────
 * Модуль Dark Heresy 1-й редакции. Capability-конфиг фиксирует возможности
 * модуля: без `influence`, без колонки `+30`, усталость — `fatigue1st`.
 *
 * 💬 Лист, форма, секции и словарь — собственные файлы модуля. Общего
 * DH-кода между редакциями нет: dh1 можно менять независимо.
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
      buildDh1PortableJson(character, config),
    buildExcelSections: (character, config, translate) =>
      buildDh1ExcelSections(character, config, translate),
  },
  migrations: [],
};
