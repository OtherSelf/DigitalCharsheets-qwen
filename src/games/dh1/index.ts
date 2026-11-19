import type { ExportTranslate, GameExportConfig, GameModule } from '../types';
import { createDh1Defaults } from './defaults';
import { createDh1Demo } from './demo';
import { deriveDh1 } from './derive';
import { buildDh1ExcelSections } from './excel';
import { buildDh1PortableJson } from './export';
import { dh1History } from './history';
import dh1En from './i18n/en.json';
import dh1Ru from './i18n/ru.json';
import {
  dh1ConvertLegacyImport,
  dh1LegacyImportName,
  dh1MatchesLegacyImport,
} from './legacy-import';
import { mergeDh1Data } from './merge';
import {
  migrateDh1V1toV2,
  migrateDh1V2toV3,
  migrateDh1V3toV4,
  migrateDh1V4toV5,
} from './migrations';
import { normalizeDh1 } from './normalize';
import { dh1CharacterSchema } from './schema';
import { DH1_SCHEMA_VERSION } from './schema-version';
import type { DH1Character } from './types';

/**
 * ─── LANDMARK: DH1 ENTRY POINTS ───────────────────────────────────────────
 * Именованные экспорты для манифеста `plugin.json` (`index.ts#createDemo`,
 * `index.ts#toPortableJson`, …). Реестр плагинов генерируется из
 * манифестов, поэтому точки входа — отдельные экспорты, а не только поля
 * объекта модуля; тест сверяет манифест с реальным набором экспортов.
 */
export const createDefaults = createDh1Defaults;

/**
 * Точка входа пересчёта производных (`plugin.json#derive`): мост в
 * рантайм-реестр, пока GameModule не слился с GamePlugin (D2).
 */
export const deriveCharacter = deriveDh1;

export {
  migrateDh1V1toV2,
  migrateDh1V2toV3,
  migrateDh1V3toV4,
  migrateDh1V4toV5,
} from './migrations';
export const createDemo = createDh1Demo;

export function toPortableJson(
  character: DH1Character,
  config: GameExportConfig,
): Record<string, unknown> {
  return buildDh1PortableJson(character, config);
}

export function buildExcelSections(
  character: DH1Character,
  config: GameExportConfig,
  translate: ExportTranslate,
) {
  return buildDh1ExcelSections(character, config, translate);
}

/**
 * ─── LANDMARK: DH1 MODULE ──────────────────────────────────────────────────
 * Модуль Dark Heresy 1-й редакции. Capability-конфиг фиксирует возможности
 * модуля: без `influence`, без колонки `+30`, усталость — `fatigue1st`.
 *
 * Лист, форма, секции и словарь — собственные файлы модуля. Общего
 * DH-кода между редакциями нет: dh1 можно менять независимо.
 */
export const dh1Module: GameModule<DH1Character> = {
  id: 'dh1',
  gameId: 'darkHeresy',
  order: 20,
  defaultStatus: 'published',
  nameKey: 'games.dh1.name',
  descriptionKey: 'games.dh1.description',
  shortCode: 'dh1e',
  schemaVersion: DH1_SCHEMA_VERSION,
  schema: dh1CharacterSchema,
  i18n: { en: dh1En, ru: dh1Ru },
  capabilities: {
    plus30: false,
    fatigueField: 'fatigue1st',
  },
  createDefaults,
  createDemo,
  normalize: normalizeDh1,
  merge: mergeDh1Data,
  components: {
    loadCreateForm: () =>
      import('./create-form').then((m) => ({ default: m.Dh1CharacterForm })),
    loadSheet: () => import('./sheet').then((m) => ({ default: m.Dh1Sheet })),
  },
  export: {
    toPortableJson,
    buildExcelSections,
  },
  migrations: [
    { from: 1, to: 2, migrate: migrateDh1V1toV2 },
    { from: 2, to: 3, migrate: migrateDh1V2toV3 },
    { from: 3, to: 4, migrate: migrateDh1V3toV4 },
    { from: 4, to: 5, migrate: migrateDh1V4toV5 },
  ],
  history: dh1History,
  matchesLegacyImport: dh1MatchesLegacyImport,
  legacyImportName: dh1LegacyImportName,
  convertLegacyImport: dh1ConvertLegacyImport,
};
