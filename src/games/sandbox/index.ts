import type {
  ExportTranslate,
  GameExportConfig,
  GameModule,
} from '@/games/types';

import { SANDBOX_CAPABILITIES } from './capabilities';
import { createSandboxDefaults } from './defaults';
import { createSandboxDemo } from './demo';
import { deriveSandbox } from './derive';
import { sandboxFindEmbedded, sandboxUpdateEmbedded } from './embedded';
import { buildSandboxExcelSections } from './excel';
import { buildSandboxPortableJson } from './export';
import { sandboxHistory } from './history';
import sandboxEn from './i18n/en.json';
import sandboxRu from './i18n/ru.json';
import {
  sandboxConvertLegacyImport,
  sandboxLegacyImportName,
  sandboxMatchesLegacyImport,
} from './legacy-import';
import { mergeSandboxData } from './merge';
import { migrateV1toV2, migrateV2toV3 } from './migrations';
import { normalizeSandbox } from './normalize';
import { sandboxCharacterSchema } from './schema';
import { SANDBOX_SCHEMA_VERSION } from './schema-version';
import { SANDBOX_SYSTEM_ID, type SandboxCharacter } from './types';

/**
 * ─── LANDMARK: SANDBOX PLUGIN ──────────────────────────────────────────────
 * Живой эталон контракта плагина: собственная схема, дефолты, демо, экспорт,
 * React-лист и форма, i18n, все UI-слоты, CSS-модуль раскладки, скоупленная
 * тема и шрифт. Дополнительно он проходит все необязательные ветки SDK:
 * `derive`/`derived`, `import` (normalize/merge), `history`, legacy-импорт,
 * вложенную сущность (`findEmbedded`/`updateEmbedded`) и полный набор
 * capability-флагов.
 *
 * `defaultStatus: 'test'` — игру видят только тестировщики и админ, поэтому
 * она не появляется у обычных пользователей, но остаётся в сборке как
 * работающий пример: удалить или добавить игру по-прежнему значит «папка +
 * `plugin.json` + пересборка», без правок ядра.
 */
export const createDefaults = createSandboxDefaults;
export const createDemo = createSandboxDemo;

/** Точка входа `plugin.json#derive`: пересчёт производных. */
export const deriveCharacter = deriveSandbox;

/** Точки входа `plugin.json#import`: тот же код, что в модуле. */
export { mergeSandboxData, normalizeSandbox };

export { migrateV1toV2, migrateV2toV3 } from './migrations';

export function toPortableJson(
  character: SandboxCharacter,
  config: GameExportConfig,
): Record<string, unknown> {
  return buildSandboxPortableJson(character, config);
}

export function buildExcelSections(
  character: SandboxCharacter,
  config: GameExportConfig,
  translate: ExportTranslate,
) {
  return buildSandboxExcelSections(character, config, translate);
}

export const sandboxModule: GameModule<SandboxCharacter> = {
  id: SANDBOX_SYSTEM_ID,
  gameId: 'sandbox',
  order: 900,
  defaultStatus: 'test',
  nameKey: 'sandbox.name',
  descriptionKey: 'sandbox.description',
  shortCode: 'sandbox',
  schemaVersion: SANDBOX_SCHEMA_VERSION,
  schema: sandboxCharacterSchema,
  i18n: { en: sandboxEn, ru: sandboxRu },
  capabilities: SANDBOX_CAPABILITIES,
  createDefaults,
  createDemo,
  components: {
    loadCreateForm: () =>
      import('./create-form').then((module) => ({
        default: module.SandboxCharacterForm,
      })),
    loadSheet: () =>
      import('./sheet').then((module) => ({ default: module.SandboxSheet })),
  },
  export: { toPortableJson, buildExcelSections },
  normalize: normalizeSandbox,
  merge: mergeSandboxData,
  migrations: [
    { from: 1, to: 2, migrate: migrateV1toV2 },
    { from: 2, to: 3, migrate: migrateV2toV3 },
  ],
  history: sandboxHistory,
  matchesLegacyImport: sandboxMatchesLegacyImport,
  legacyImportName: sandboxLegacyImportName,
  convertLegacyImport: sandboxConvertLegacyImport,
  findEmbedded: sandboxFindEmbedded,
  updateEmbedded: sandboxUpdateEmbedded,
};
