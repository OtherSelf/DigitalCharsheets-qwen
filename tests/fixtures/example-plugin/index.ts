import { CURRENT_SCHEMA_VERSION } from '@/games/plugin-api';
import type {
  ExportTranslate,
  GameExportConfig,
  GameModule,
} from '@/games/types';

import { createExampleDefaults } from './defaults';
import { createExampleDemo } from './demo';
import { buildExampleExcelSections } from './excel';
import { buildExamplePortableJson } from './export';
import exampleEn from './i18n/en.json';
import exampleRu from './i18n/ru.json';
import { exampleCharacterSchema } from './schema';
import type { ExampleCharacter } from './types';

/**
 * ─── LANDMARK: EXAMPLE PLUGIN ──────────────────────────────────────────────
 * Эталонный плагин (фикстура, `defaultStatus: hidden`): собственная схема,
 * дефолты, демо, экспорт, кастомные React-лист и форма, i18n и UI-слоты.
 * Тест `tests/unit/example-plugin.test.ts` прогоняет его через тот же
 * генератор реестра, что и боевые плагины: чтобы добавить такую игру, нужны
 * только папка и `plugin.json` — правок ядра нет.
 */
export const createDefaults = createExampleDefaults;
export const createDemo = createExampleDemo;

export function toPortableJson(
  character: ExampleCharacter,
  config: GameExportConfig,
): Record<string, unknown> {
  return buildExamplePortableJson(character, config);
}

export function buildExcelSections(
  character: ExampleCharacter,
  config: GameExportConfig,
  translate: ExportTranslate,
) {
  return buildExampleExcelSections(character, config, translate);
}

export const exampleModule: GameModule<ExampleCharacter> = {
  id: 'example',
  gameId: 'exampleGame',
  order: 90,
  defaultStatus: 'hidden',
  nameKey: 'example.name',
  descriptionKey: 'example.description',
  schemaVersion: CURRENT_SCHEMA_VERSION,
  schema: exampleCharacterSchema,
  i18n: { en: exampleEn, ru: exampleRu },
  capabilities: {},
  createDefaults,
  createDemo,
  components: {
    loadCreateForm: () =>
      import('./create-form').then((module) => ({
        default: module.ExampleCharacterForm,
      })),
    loadSheet: () =>
      import('./sheet').then((module) => ({ default: module.ExampleSheet })),
  },
  export: { toPortableJson, buildExcelSections },
  migrations: [],
};
