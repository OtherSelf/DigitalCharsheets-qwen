import { CURRENT_SCHEMA_VERSION } from '../plugin-api';
import type { ExportTranslate, GameExportConfig, GameModule } from '../types';
import { createDh2Defaults } from './defaults';
import { createDh2Demo } from './demo';
import { buildDh2ExcelSections } from './excel';
import { buildDh2PortableJson } from './export';
import dh2En from './i18n/en.json';
import dh2Ru from './i18n/ru.json';
import { mergeDh2Data } from './merge';
import { normalizeDh2 } from './normalize';
import { dh2CharacterSchema } from './schema';
import type { DH2Character } from './types';

/**
 * ─── LANDMARK: DH2 ENTRY POINTS ───────────────────────────────────────────
 * Именованные экспорты для манифеста `plugin.json` (`index.ts#createDemo`,
 * `index.ts#toPortableJson`, …). Реестр плагинов генерируется из
 * манифестов, поэтому точки входа — отдельные экспорты, а не только поля
 * объекта модуля; тест сверяет манифест с реальным набором экспортов.
 */
export const createDefaults = createDh2Defaults;
export const createDemo = createDh2Demo;

export function toPortableJson(
  character: DH2Character,
  config: GameExportConfig,
): Record<string, unknown> {
  return buildDh2PortableJson(character, config);
}

export function buildExcelSections(
  character: DH2Character,
  config: GameExportConfig,
  translate: ExportTranslate,
) {
  return buildDh2ExcelSections(character, config, translate);
}

/**
 * ─── LANDMARK: DH2 MODULE ──────────────────────────────────────────────────
 * Модуль Dark Heresy 2-й редакции. Capability-конфиг фиксирует возможности
 * модуля: `influence`, колонка `+30`, усталость — `fatigue2nd`.
 *
 * Лист, форма, секции и словарь — собственные файлы модуля. Общего
 * DH-кода между редакциями нет: dh2 можно менять независимо.
 */
export const dh2Module: GameModule<DH2Character> = {
  id: 'dh2',
  gameId: 'darkHeresy',
  order: 30,
  defaultStatus: 'published',
  nameKey: 'games.dh2.name',
  descriptionKey: 'games.dh2.description',
  schemaVersion: CURRENT_SCHEMA_VERSION,
  schema: dh2CharacterSchema,
  i18n: { en: dh2En, ru: dh2Ru },
  capabilities: {
    influence: true,
    plus30: true,
    fatigueField: 'fatigue2nd',
  },
  createDefaults,
  createDemo,
  normalize: normalizeDh2,
  merge: mergeDh2Data,
  components: {
    loadCreateForm: () =>
      import('./create-form').then((m) => ({ default: m.Dh2CharacterForm })),
    loadSheet: () => import('./sheet').then((m) => ({ default: m.Dh2Sheet })),
  },
  export: {
    toPortableJson,
    buildExcelSections,
  },
  migrations: [],
};
