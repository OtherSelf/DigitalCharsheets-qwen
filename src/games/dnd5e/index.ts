import { CURRENT_SCHEMA_VERSION } from '../plugin-api';
import type { ExportTranslate, GameExportConfig, GameModule } from '../types';
import { createDnd5eDefaults } from './defaults';
import { createDnd5eDemo } from './demo';
import { buildDnd5eExcelSections } from './excel';
import { buildDnd5ePortableJson } from './export';
import { en as dnd5eEn } from './i18n/en';
import { ru as dnd5eRu } from './i18n/ru';
import { mergeDnd5eData } from './merge';
import { normalizeDnd5e } from './normalize';
import { dnd5eCharacterSchema } from './schema';
import type { DnD5eCharacter } from './types';

/**
 * ─── LANDMARK: DND5E ENTRY POINTS ─────────────────────────────────────────
 * Именованные экспорты, на которые ссылается манифест `plugin.json`
 * (`index.ts#createDemo`, `index.ts#toPortableJson`, …). Реестр плагинов
 * генерируется из манифестов, поэтому точка входа должна быть отдельным
 * экспортом, а не только полем объекта модуля; тест сверяет манифест с
 * реальным набором экспортов.
 */
export const createDefaults = createDnd5eDefaults;
export const createDemo = createDnd5eDemo;

export function toPortableJson(
  character: DnD5eCharacter,
  config: GameExportConfig,
): Record<string, unknown> {
  return buildDnd5ePortableJson(character, config);
}

export function buildExcelSections(
  character: DnD5eCharacter,
  config: GameExportConfig,
  translate: ExportTranslate,
) {
  return buildDnd5eExcelSections(character, config, translate);
}

/**
 * ─── LANDMARK: DND5E MODULE ────────────────────────────────────────────────
 * Модуль D&D 5e: метаданные для реестра и ленивые точки входа в UI.
 * Лист, форма, секции и данные — собственные файлы модуля.
 */
export const dnd5eModule: GameModule<DnD5eCharacter> = {
  id: 'dnd5e',
  gameId: 'dnd',
  order: 10,
  defaultStatus: 'published',
  nameKey: 'games.dnd5e.name',
  descriptionKey: 'games.dnd5e.description',
  schemaVersion: CURRENT_SCHEMA_VERSION,
  schema: dnd5eCharacterSchema,
  i18n: { en: dnd5eEn, ru: dnd5eRu },
  capabilities: {},
  createDefaults,
  createDemo,
  normalize: normalizeDnd5e,
  merge: mergeDnd5eData,
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
    toPortableJson,
    buildExcelSections,
  },
  migrations: [],
};
