import { CURRENT_SCHEMA_VERSION } from '@/games/plugin-api';
import type {
  ExportTranslate,
  GameExportConfig,
  GameModule,
} from '@/games/types';

import { createSandboxDefaults } from './defaults';
import { createSandboxDemo } from './demo';
import { buildSandboxExcelSections } from './excel';
import { buildSandboxPortableJson } from './export';
import sandboxEn from './i18n/en.json';
import sandboxRu from './i18n/ru.json';
import { mergeSandboxData } from './merge';
import { normalizeSandbox } from './normalize';
import { sandboxCharacterSchema } from './schema';
import { SANDBOX_SYSTEM_ID, type SandboxCharacter } from './types';

/**
 * ─── LANDMARK: SANDBOX PLUGIN ──────────────────────────────────────────────
 * Живой эталон контракта плагина: собственная схема, дефолты, демо, экспорт,
 * React-лист и форма, i18n, UI-слоты, CSS-модуль раскладки и скоупленная
 * тема. `defaultStatus: 'test'` — игру видят только тестировщики и админ,
 * поэтому она не появляется у обычных пользователей, но остаётся в сборке
 * как работающий пример: удалить или добавить игру по-прежнему значит
 * «папка + `plugin.json` + пересборка», без правок ядра.
 */
export const createDefaults = createSandboxDefaults;
export const createDemo = createSandboxDemo;

/**
 * Шаг цепочки миграций (`1 → 2` — дискриминант редакции): песочница проходит
 * тот же гейт, что и боевые плагины, включая миграции.
 */
export function migrateV1toV2(
  character: Readonly<Record<string, unknown>>,
): Record<string, unknown> {
  const next = { ...character };
  delete next.edition;
  return next;
}

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
  schemaVersion: CURRENT_SCHEMA_VERSION,
  schema: sandboxCharacterSchema,
  i18n: { en: sandboxEn, ru: sandboxRu },
  capabilities: {},
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
  migrations: [{ from: 1, to: 2, migrate: migrateV1toV2 }],
};
