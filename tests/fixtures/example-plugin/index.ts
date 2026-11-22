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
import { mergeExampleData } from './merge';
import { normalizeExample } from './normalize';
import { exampleCharacterSchema } from './schema';
import { PLUGIN_SCHEMA_VERSION } from './schema-version';
import { EXAMPLE_SYSTEM_ID, type ExampleCharacter } from './types';

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

/**
 * Шаг цепочки миграций фикстуры: `1 → 2` — дискриминант редакции. Он нужен,
 * чтобы фикстура проходила тот же гейт, что и боевые плагины.
 */
export function migrateV1toV2(
  character: Readonly<Record<string, unknown>>,
): Record<string, unknown> {
  const next = { ...character };
  delete next.edition;
  return next;
}

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
  id: EXAMPLE_SYSTEM_ID,
  gameId: 'exampleGame',
  order: 90,
  defaultStatus: 'hidden',
  nameKey: 'example.name',
  descriptionKey: 'example.description',
  shortCode: 'example',
  schemaVersion: PLUGIN_SCHEMA_VERSION,
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
  normalize: normalizeExample,
  merge: mergeExampleData,
  migrations: [{ from: 1, to: 2, migrate: migrateV1toV2 }],
};
