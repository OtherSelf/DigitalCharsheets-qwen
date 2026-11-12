import type { ComponentType } from 'react';

import type { ZodType } from 'zod';

import type {
  BulkEditorColumn,
  BulkEditorTab,
  BulkEditorTable,
  BulkEditorValue,
  CardSummary,
  CharacterMigration,
  CharacterRecord,
  CreateFormComponent,
  GameExportAdapter,
  GameExportConfig,
  GameModule,
  GameModuleComponents,
  GameUiSlots,
  LocalizedMessages,
  ModuleCapabilities,
  ModuleStatus,
  NormalizeOptions,
  NormalizeResult,
  PluginNavItem,
  SheetComponent,
  SheetHandle,
} from './types';

/**
 * ─── LANDMARK: PLUGIN API (v1) ─────────────────────────────────────────────
 * Публичный контракт плагина игры: манифест `plugin.json`, точки входа и
 * слоты UI. Плагин импортирует из ядра только этот файл (плюс `./types`,
 * UI-кит и i18n) — см. `scripts/plugins/boundaries.json`.
 *
 * Что уже работает (этап 1):
 *   • типы манифеста и его валидация по `src/games/plugin.schema.json`;
 *   • `PluginRegistration` — пара «манифест + модуль», из которой
 *     генерируется `src/games/registry.generated.ts`;
 *   • `parseEntryPoint` и проверка версии plugin API.
 *
 * Что появится позже и описано здесь «наперёд» (чтобы форматы не менялись):
 *   • `GamePlugin` — модуль, у которого метаданные берутся из манифеста
 *     (этап 2: `GameModule` схлопывается в него);
 *   • `GameUiSlots` — слоты `HeaderActions`/`CompactNav`/`BulkEditor`/
 *     `CardSummary` (этап 3, D11);
 *   • `normalize`/`merge` — импорт и слияние в плагине (этап 2).
 *
 * Файл чистый (без fs/DOM/Next): его импортируют и клиент, и сервер.
 */

/** Версия формата манифеста, которую понимает этот хост. */
export const PLUGIN_MANIFEST_VERSION = 1 as const;

/** Версия Plugin API; манифест объявляет совместимый диапазон. */
export const PLUGIN_API_VERSION = '1.0.0' as const;

/**
 * Версия схемы листа, с которой работает хост по умолчанию. Основной
 * источник — `schemaVersion` манифеста; константа нужна модулям для
 * фабрик/схем и ядру до того, как известен `systemId`.
 */
export const CURRENT_SCHEMA_VERSION = 2 as const;

/** Языки, на которых обязаны быть названия и описания в манифесте. */
export const PLUGIN_LOCALES = ['en', 'ru'] as const;
export type PluginLocale = (typeof PLUGIN_LOCALES)[number];

/** Название/описание на языках сайта (источник — манифест, D4). */
export interface LocalizedText {
  readonly en: string;
  readonly ru: string;
}

/** Блок семейства игр в манифесте (D17: одинаков у всех редакций). */
export interface PluginGameManifest {
  readonly id: string;
  readonly order: number;
  readonly name: LocalizedText;
}

/** Зависимости плагина: версия хоста и (зарезервировано) другие плагины. */
export interface PluginDependencies {
  readonly host: string;
  readonly plugins: Readonly<Record<string, string>>;
}

/**
 * Шаг цепочки миграций в манифесте. Исполнение — в модуле по `entry`
 * (`index.ts#migrateV1toV2`); манифест — источник порядка и описания (D4).
 */
export interface PluginMigrationManifest {
  readonly from: number;
  readonly to: number;
  readonly entry: string;
  readonly description?: string;
}

/**
 * UI-часть манифеста. `mode` пока единственный (`custom`): плагин владеет
 * React-компонентами листа и формы (D3). Поле оставлено как точка роста.
 */
export interface PluginSheetManifest {
  readonly mode: 'custom';
  readonly client: string;
  readonly createForm: string;
}

/** Именованные слоты UI, которые плагин может заполнить (этап 3, D11). */
export const PLUGIN_UI_SLOTS = [
  'HeaderActions',
  'HeaderSubtitle',
  'CompactNav',
  'BulkEditor',
  'CardSummary',
  'HouseRulesDialog',
] as const;
export type PluginUiSlot = (typeof PLUGIN_UI_SLOTS)[number];

/**
 * `plugin.json` — манифест плагина. Единый источник названий, порядка и
 * цепочек миграций; рантайм-код и UI описываются точками входа
 * (`<файл>#<экспорт>`).
 */
export interface PluginManifest {
  readonly manifestVersion: number;
  readonly pluginApi: string;
  readonly id: string;
  readonly gameId: string;
  readonly version: string;
  readonly order: number;
  readonly defaultStatus: ModuleStatus;
  readonly name: LocalizedText;
  readonly description: LocalizedText;
  readonly tags: readonly string[];
  readonly author: string;
  readonly license: string;
  readonly schemaVersion: number;
  readonly game: PluginGameManifest;
  readonly dependencies: PluginDependencies;
  readonly entry: { readonly module: string };
  readonly sheet: PluginSheetManifest;
  readonly i18n: { readonly en: string; readonly ru: string };
  readonly demo: { readonly entry: string };
  readonly export: {
    readonly json: string;
    readonly excel: string;
  };
  /**
   * Импорт и слияние legacy-данных силами плагина (этап 2). Пока поле
   * отсутствует: слияние делает `src/lib/export-utils.ts`.
   */
  readonly import?: {
    readonly normalize: string;
    readonly merge: string;
  };
  readonly migrations: readonly PluginMigrationManifest[];
  readonly tests?: {
    readonly conformance: string;
    readonly fixtures?: string;
  };
  readonly ui?: {
    readonly slots: readonly PluginUiSlot[];
  };
  /**
   * Legacy-имена листа (`gameSystem`/`edition`), по которым разрешается
   * `systemId` (этап 2). Чем больше полей совпало, тем специфичнее правило:
   * `{gameSystem:'Dark Heresy', edition:'2nd'}` выигрывает у
   * `{gameSystem:'Dark Heresy'}`.
   */
  readonly aliases?: readonly PluginAlias[];
}

/** Правило сопоставления legacy-полей листа с плагином. */
export interface PluginAlias {
  readonly gameSystem?: string;
  readonly edition?: string;
}

/** Разобранная точка входа `"index.ts#createDemo"`. */
export interface ParsedEntryPoint {
  readonly file: string;
  readonly member?: string;
}

/**
 * Разобрать точку входа `<файл>(#<экспорт>)?`.
 *
 * @throws если строка пустая, содержит абсолютный путь или `..`.
 */
export function parseEntryPoint(entry: string): ParsedEntryPoint {
  const [rawFile, member, ...rest] = entry.split('#');
  const file = rawFile?.trim() ?? '';
  if (!file || rest.length > 0) {
    throw new Error(`Некорректная точка входа плагина: "${entry}"`);
  }
  if (file.startsWith('/') || file.split(/[\\/]/).includes('..')) {
    throw new Error(
      `Точка входа должна быть относительным путём внутри плагина: "${entry}"`,
    );
  }
  if (member !== undefined) {
    const trimmed = member.trim();
    if (!/^[A-Za-z_$][A-Za-z0-9_$]*$/.test(trimmed)) {
      throw new Error(`Некорректное имя экспорта в точке входа: "${entry}"`);
    }
    return { file, member: trimmed };
  }
  return { file };
}

/**
 * Совместим ли диапазон `pluginApi` манифеста с версией хоста.
 * Поддерживаются `^1.2.3`, `~1.2.3`, точная версия, `*` и `>=1.0.0` —
 * этого достаточно для наших манифестов, без зависимости от semver (D1).
 */
export function isHostApiCompatible(
  range: string,
  hostVersion: string = PLUGIN_API_VERSION,
): boolean {
  const host = parseVersion(hostVersion);
  if (!host) return false;
  const trimmed = range.trim();
  if (trimmed === '' || trimmed === '*') return true;

  const lowerBound = trimmed.replace(/^[~^>=<\s]+/, '');
  const expected = parseVersion(lowerBound);
  if (!expected) return false;

  if (trimmed.startsWith('^')) {
    // ^1.2.3 → та же мажорная версия, не ниже 1.2.3.
    return (
      host.major === expected.major && compareVersions(host, expected) >= 0
    );
  }
  if (trimmed.startsWith('~')) {
    return (
      host.major === expected.major &&
      host.minor === expected.minor &&
      compareVersions(host, expected) >= 0
    );
  }
  if (trimmed.startsWith('>=')) {
    return compareVersions(host, expected) >= 0;
  }
  return compareVersions(host, expected) === 0;
}

interface ParsedVersion {
  major: number;
  minor: number;
  patch: number;
}

function parseVersion(version: string): ParsedVersion | undefined {
  const match = /^(\d+)\.(\d+)\.(\d+)$/.exec(version.trim());
  if (!match) return undefined;
  return {
    major: Number(match[1]),
    minor: Number(match[2]),
    patch: Number(match[3]),
  };
}

function compareVersions(a: ParsedVersion, b: ParsedVersion): number {
  return a.major - b.major || a.minor - b.minor || a.patch - b.patch;
}

/**
 * Целевой контракт плагина (этап 2–3): метаданные из манифеста, схема,
 * фабрики, экспорт, миграции и UI-слоты в одном объекте.
 *
 * На этапе 1 рантайм ещё работает через `GameModule`; `GamePlugin` описывает
 * форму, к которой модули сходятся по мере этапов.
 */
export interface GamePlugin<
  TCharacter extends CharacterRecord = CharacterRecord,
> {
  readonly manifest: PluginManifest;
  readonly schema: ZodType<TCharacter>;
  createDefaults(
    input?: Readonly<Record<string, unknown>>,
  ): Omit<TCharacter, 'id'>;
  createDemo(): Omit<TCharacter, 'id'>;
  readonly i18n: LocalizedMessages;
  readonly capabilities: ModuleCapabilities;
  readonly components: GameModuleComponents<TCharacter>;
  readonly export: GameExportAdapter<TCharacter>;
  normalize?(
    raw: Readonly<Record<string, unknown>>,
    options?: NormalizeOptions,
  ): NormalizeResult<TCharacter>;
  merge?(
    target: TCharacter,
    source: Readonly<Record<string, unknown>>,
    config: GameExportConfig,
  ): TCharacter;
  readonly migrations: readonly CharacterMigration[];
  readonly ui?: GameUiSlots<TCharacter>;
}

/**
 * Регистрация плагина на переходный период (этап 1 — 2): пара «манифест +
 * модуль». Именно её перечисляет сгенерированный реестр; когда `GameModule`
 * сольётся с `GamePlugin`, поле `module` заменится на сам плагин, а
 * `manifest` останется.
 */
export interface PluginRegistration<
  TCharacter extends CharacterRecord = CharacterRecord,
> {
  readonly manifest: PluginManifest;
  readonly module: GameModule<TCharacter>;
}

/**
 * Регистрация с «размытым» типом листа (как `AnyGameModule` в реестре):
 * сгенерированный реестр перечисляет модули разных редакций, а конкретный
 * тип восстанавливает вызывающий код.
 */
export type GeneratedPluginRegistration = PluginRegistration<any>;

/** Название плагина на языке сайта; неизвестный язык → английский. */
export function pluginDisplayName(
  manifest: PluginManifest,
  locale: string,
): string {
  return locale === 'ru' ? manifest.name.ru : manifest.name.en;
}

/** Описание плагина на языке сайта. */
export function pluginDescription(
  manifest: PluginManifest,
  locale: string,
): string {
  return locale === 'ru' ? manifest.description.ru : manifest.description.en;
}

/** Заполнен ли слот UI (используется хостом в этапе 3). */
export function hasUiSlot(
  manifest: PluginManifest,
  slot: PluginUiSlot,
): boolean {
  return manifest.ui?.slots.includes(slot) ?? false;
}

export type {
  BulkEditorColumn,
  BulkEditorTab,
  BulkEditorTable,
  BulkEditorValue,
  CardSummary,
  CharacterMigration,
  CharacterRecord,
  CreateFormComponent,
  GameExportAdapter,
  GameExportConfig,
  GameModule,
  GameModuleComponents,
  GameUiSlots,
  LocalizedMessages,
  ModuleCapabilities,
  ModuleStatus,
  NormalizeOptions,
  NormalizeResult,
  PluginNavItem,
  SheetComponent,
  SheetHandle,
};
