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
  CreateFormCompletion,
  CreateFormComponent,
  CreateFormProps,
  GameExportAdapter,
  GameExportConfig,
  GameHistoryConfig,
  GameModule,
  GameModuleComponents,
  GameTheme,
  GameUiSlots,
  LegacyImportContext,
  LocalizedMessages,
  ModuleCapabilities,
  ModuleStatus,
  NormalizeOptions,
  NormalizeResult,
  PluginFont,
  PluginLocalizedMessages,
  PluginNavItem,
  SheetComponent,
  SheetHandle,
  SiteLanguage,
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
 *     `CardSummary` (этап 3);
 *   • `normalize`/`merge` — импорт и слияние в плагине (этап 2).
 *
 * Файл чистый (без fs/DOM/Next): его импортируют и клиент, и сервер.
 */

/**
 * Версия Plugin API и формата манифеста живут в исполняемом `.mjs`-источнике:
 * их читает и генератор реестра, который не может импортировать TypeScript.
 * Здесь только реэкспорт — второго определения быть не должно.
 */
export {
  PLUGIN_API_VERSION,
  PLUGIN_MANIFEST_VERSION,
  SUPPORTED_PLUGIN_API_RANGES,
  parseEntryPoint,
  isHostApiCompatible,
} from './plugin-api.constants.mjs';

/**
 * Версия схемы листа, с которой работает хост по умолчанию. Основной
 * источник — `schemaVersion` манифеста; константа нужна модулям для
 * фабрик/схем и ядру до того, как известен `systemId`.
 */
export const CURRENT_SCHEMA_VERSION = 2 as const;

/**
 * Языки сайта. Плагин обязан объявить хотя бы одну из этих локалей; остальные
 * локали допустимы, валидируются и хранятся, но сайтом не используются.
 */
export const PLUGIN_LOCALES = ['en', 'ru'] as const;
export type PluginLocale = (typeof PLUGIN_LOCALES)[number];

/** Название/описание на языках сайта (блок `game`, источник — манифест). */
export interface LocalizedText {
  readonly en: string;
  readonly ru: string;
}

/**
 * Название/описание самого плагина: карта «локаль → строка», минимум одна из
 * `en`/`ru`, дополнительные локали разрешены (SDK 1.3).
 */
export type PluginLocalizedText = Partial<Record<PluginLocale, string>> &
  Readonly<Record<string, string | undefined>>;

/**
 * Блок семейства игр в манифесте (одинаков у всех редакций).
 * `name` и `description` обязательны на обоих языках сайта: это источник
 * названий и описаний в каталоге (`plugin.schema.json#definitions.localizedText`).
 */
export interface PluginGameManifest {
  readonly id: string;
  readonly order: number;
  readonly name: LocalizedText;
  readonly description: LocalizedText;
}

/** Зависимости плагина: версия хоста и (зарезервировано) другие плагины. */
export interface PluginDependencies {
  readonly host: string;
  readonly plugins: Readonly<Record<string, string>>;
}

/**
 * Шаг цепочки миграций в манифесте. Исполнение — в модуле по `entry`
 * (`index.ts#migrateV1toV2`); манифест — источник порядка и описания.
 */
export interface PluginMigrationManifest {
  readonly from: number;
  readonly to: number;
  readonly entry: string;
  readonly description?: string;
  /**
   * Поля верхнего уровня, которые шаг удаляет сознательно. Проверка lossless
   * (`tests/unit/plugin-conformance.test.ts`) разрешает потерять только их:
   * остальные ключи обязаны пережить цепочку.
   */
  readonly removes?: readonly string[];
}

/**
 * UI-часть манифеста. `mode` пока единственный (`custom`): плагин владеет
 * React-компонентами листа и формы. Поле оставлено как точка роста.
 */
export interface PluginSheetManifest {
  readonly mode: 'custom';
  readonly client: string;
  readonly createForm: string;
}

/** Именованные слоты UI, которые плагин может заполнить (этап 3). */
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
  /** Короткий код редакции для админки (`dh1e`); уникален, не переводится. */
  readonly shortCode: string;
  readonly version: string;
  readonly order: number;
  readonly defaultStatus: ModuleStatus;
  readonly name: PluginLocalizedText;
  readonly description: PluginLocalizedText;
  readonly tags: readonly string[];
  readonly author: string;
  readonly license: string;
  readonly schemaVersion: number;
  readonly game: PluginGameManifest;
  readonly dependencies: PluginDependencies;
  readonly entry: { readonly module: string };
  readonly sheet: PluginSheetManifest;
  /** Локаль → путь к словарю; минимум одна из `en`/`ru`. */
  readonly i18n: Readonly<Record<string, string>>;
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
  /**
   * Точка входа пересчёта производных (`index.ts#deriveCharacter`). Плагин,
   * объявивший её, обязан перечислить поля в `derived`.
   */
  readonly derive?: { readonly entry: string };
  /**
   * Поля, которые пересчитывает `derive`: путь верхнего уровня или с `[]` для
   * элементов массива (`skills[].value`). Нужен `plugins:doctor` и OpenAPI.
   */
  readonly derived?: readonly string[];
  readonly migrations: readonly PluginMigrationManifest[];
  readonly tests?: {
    readonly conformance: string;
    readonly fixtures?: string;
  };
  readonly ui?: {
    /** Слоты, которые реализует `ui.entry`; без них `entry` не нужен. */
    readonly slots?: readonly PluginUiSlot[];
    /** Модуль, экспортирующий `uiSlots` (грузится лениво). */
    readonly entry?: string;
    /** Скоупленная тема: токены light/dark и опциональный шрифт. */
    readonly theme?: GameTheme;
  };
  /**
   * Legacy-имена листа (`gameSystem`/`edition`), по которым разрешается
   * `systemId` (этап 2). Чем больше полей совпало, тем специфичнее правило:
   * `{gameSystem:'Dark Heresy', edition:'2nd'}` выигрывает у
   * `{gameSystem:'Dark Heresy'}`.
   */
  readonly aliases?: readonly PluginAlias[];
}

/**
 * Чистая функция производных значений листа (этап 2): по первичным полям
 * (уровень, характеристики, владения) пересчитывает зависимые (бонус
 * мастерства, значения спасбросков и навыков, DC заклинаний).
 *
 * Контракт проверяется TCK (`tests/unit/plugins-derive.test.ts`): функция не
 * мутирует вход, идемпотентна, не меняет `schemaVersion`, не создаёт и не
 * удаляет поля верхнего уровня и не зависит от порядка ключей.
 */
export type CharacterDerive<
  TCharacter extends CharacterRecord = CharacterRecord,
> = (doc: TCharacter) => TCharacter;

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
  readonly i18n: PluginLocalizedMessages;
  readonly capabilities: ModuleCapabilities;
  readonly components: GameModuleComponents<TCharacter>;
  readonly export: GameExportAdapter<TCharacter>;
  /**
   * Пересчитать производные значения. Чистая и идемпотентная: сервер зовёт её
   * на записи, клиент — для мгновенного отклика, поэтому формула обязана жить
   * в одном месте.
   */
  derive?: CharacterDerive<TCharacter>;
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
  matchesLegacyImport?(raw: Readonly<Record<string, unknown>>): boolean;
  legacyImportName?(
    raw: Readonly<Record<string, unknown>>,
    index: number,
  ): string;
  convertLegacyImport?(
    raw: Readonly<Record<string, unknown>>,
    context: LegacyImportContext,
  ): Record<string, unknown> | undefined;
  findEmbedded?(
    character: TCharacter,
    id: string,
  ): Record<string, unknown> | undefined;
  updateEmbedded?(
    character: TCharacter,
    id: string,
    data: Readonly<Record<string, unknown>>,
  ): { character: TCharacter; patch: Partial<TCharacter> } | undefined;
  readonly ui?: GameUiSlots<TCharacter>;

  /** Необязательные подписи полей для экрана истории (SDK 1.1). */
  readonly history?: GameHistoryConfig;
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
  /**
   * Мост к `GamePlugin.derive`, пока `GameModule` не слился с `GamePlugin`:
   * функция берётся из точки входа манифеста, а не из модуля.
   */
  readonly derive?: CharacterDerive<any>;
}

/**
 * Регистрация с «размытым» типом листа (как `AnyGameModule` в реестре):
 * сгенерированный реестр перечисляет модули разных редакций, а конкретный
 * тип восстанавливает вызывающий код.
 */
export type GeneratedPluginRegistration = PluginRegistration<any>;

/**
 * Название плагина на языке сайта. Если объявлена только одна локаль сайта,
 * берём её (SDK 1.3); неизвестный язык → английский, затем русский.
 */
export function pluginDisplayName(
  manifest: PluginManifest,
  locale: string,
): string {
  const name = manifest.name;
  return (locale === 'ru' ? name.ru : name.en) ?? name.en ?? name.ru ?? '';
}

/** Описание плагина на языке сайта; fallback — как у названия. */
export function pluginDescription(
  manifest: PluginManifest,
  locale: string,
): string {
  const text = manifest.description;
  return (locale === 'ru' ? text.ru : text.en) ?? text.en ?? text.ru ?? '';
}

/** Заполнен ли слот UI (используется хостом в этапе 3). */
export function hasUiSlot(
  manifest: PluginManifest,
  slot: PluginUiSlot,
): boolean {
  return manifest.ui?.slots?.includes(slot) ?? false;
}

export type {
  BulkEditorColumn,
  BulkEditorTab,
  BulkEditorTable,
  BulkEditorValue,
  CardSummary,
  CharacterMigration,
  CharacterRecord,
  CreateFormCompletion,
  CreateFormComponent,
  CreateFormProps,
  GameExportAdapter,
  GameExportConfig,
  GameHistoryConfig,
  GameModule,
  GameModuleComponents,
  GameUiSlots,
  LegacyImportContext,
  LocalizedMessages,
  ModuleCapabilities,
  ModuleStatus,
  NormalizeOptions,
  NormalizeResult,
  PluginLocalizedMessages,
  PluginFont,
  PluginNavItem,
  SiteLanguage,
  SheetComponent,
  SheetHandle,
};
