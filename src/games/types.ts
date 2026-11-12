import type { ComponentType, ReactNode, Ref } from 'react';

import type { ZodType } from 'zod';

/**
 * ─── LANDMARK: GAME_MODULE_CONTRACT ────────────────────────────────────────
 * Контракт модуля игры/редакции: единственный способ, которым ядро
 * (создание персонажа, лист, дашборд, экспорт, админка) узнаёт о конкретной
 * системе. Всё специфичное для игры живёт в `src/games/<systemId>/`:
 * схема листа, дефолты, форма создания, лист, словари, адаптер экспорта и
 * цепочка миграций.
 *
 * Ядро не должно содержать `if (gameSystem === ...)`; список модулей —
 * `src/games/registry.ts`.
 *
 * Файл намеренно чистый (без fs/DOM/Next): его импортируют и серверные
 * маршруты (проверка видимости, миграции), и клиентские компоненты.
 */

/**
 * Встроенные машинные идентификаторы редакций. Расширение (новая игра,
 * DH3, другая редакция D&D) не требует правок ядра: достаточно модуля и
 * записи в реестре, а `SystemId` остаётся совместим со строкой.
 */
export const BUILTIN_SYSTEM_IDS = ['dnd5e', 'dh1', 'dh2'] as const;
export type BuiltinSystemId = (typeof BUILTIN_SYSTEM_IDS)[number];
export type SystemId = BuiltinSystemId | (string & Record<never, never>);

/** Игры-«семейства»: одна игра может содержать несколько редакций. */
export const BUILTIN_GAME_IDS = ['dnd', 'darkHeresy'] as const;
export type BuiltinGameId = (typeof BUILTIN_GAME_IDS)[number];
export type GameId = BuiltinGameId | (string & Record<never, never>);

/**
 * Статус видимости редакции. Дефолт задаётся модулем, runtime-переопределение
 * живёт в `<data-dir>/settings/game-catalog.json`.
 *
 *   • `published` — видна всем;
 *   • `test`      — видна tester и admin (выкладка «в разработке»);
 *   • `hidden`    — видна только admin.
 *
 * Скрытие влияет на создание и меню, но не блокирует открытие уже
 * существующих листов владельцем.
 */
export type ModuleStatus = 'published' | 'test' | 'hidden';

export const MODULE_STATUSES: readonly ModuleStatus[] = [
  'published',
  'test',
  'hidden',
];

/**
 * Описание игры (не редакции). Редакции группируются по `gameId` из
 * модулей; человекочитаемые названия берутся из i18n по ключам, а не
 * хранятся в листе.
 */
export interface GameDefinition {
  readonly id: GameId;
  readonly order: number;
  readonly nameKey: string;
  readonly descriptionKey: string;
}

/** Словари модуля; общий слой собирается в `src/lib/i18n`. */
export interface LocalizedMessages {
  readonly en: Readonly<Record<string, string>>;
  readonly ru: Readonly<Record<string, string>>;
}

/**
 * Минимальная структурная база листа для контракта. Конкретные типы
 * (`DnD5eCharacter`, `DH1Character`, `DH2Character`) расширяют её и
 * добавляют `systemId`.
 */
export interface CharacterRecord {
  id: string;
  name: string;
  systemId?: SystemId;
  /** Версия формата файла листа; у legacy-файлов отсутствует. */
  schemaVersion?: number;
}

/**
 * Capability-конфиг для общих компонентов (в первую очередь DH): позволяет
 * dh1/dh2 использовать один параметризованный лист, не дублируя код и не
 * возвращая runtime-переключатель редакций.
 */
export type ModuleCapabilities = Readonly<
  Record<string, string | number | boolean>
>;

/**
 * Какие секции включать в экспорт листа. Живёт в контракте, чтобы адаптеры
 * модулей не импортировали клиентский `export-utils` (и не было цикла).
 */
export interface GameExportConfig {
  includeBasicInfo: boolean;
  includeStats: boolean;
  includeCombat: boolean;
  includeEquipment: boolean;
  includeInventory: boolean;
  includeSpells: boolean;
  includeNarrative: boolean;
  includeProgression: boolean;
  includeCompanions: boolean;
  includeQuestLog: boolean;
  includeCustomHouseRules: boolean;
}

/** Перевод подписи Excel (ключ → строка) для текущего языка сайта. */
export type ExportTranslate = (key: string) => string;

/** Ячейка Excel: строка/число/булево/пусто. */
export type ExcelCell = string | number | boolean | null | undefined;

/** Секция Excel-листа, которую модуль отдаёт ядру экспорта (уже переведённая). */
export interface ExcelSection {
  readonly title: string;
  readonly rows: readonly (readonly ExcelCell[])[];
}

/**
 * Режим нормализации листа.
 *
 *   • `applyDefaults: false` (по умолчанию) — старт/запись: только перенос
 *     legacy-полей и приведение типов, без добавления структур;
 *   • `applyDefaults: true` — импорт/создание: отсутствующие структуры
 *     заполняются дефолтами редакции.
 */
export interface NormalizeOptions {
  readonly applyDefaults?: boolean;
}

/**
 * Результат нормализации импортированного/legacy-листа.
 * `warnings` — что не удалось перенести; их показывают пользователю.
 */
export interface NormalizeResult<TCharacter extends CharacterRecord> {
  readonly character: TCharacter;
  readonly warnings?: readonly string[];
}

/**
 * ─── LANDMARK: GAME_EXPORT_ADAPTER ─────────────────────────────────────────
 * Адаптер экспорта модуля. Ядро (`src/lib/export-utils.ts`) знает только
 * конверт `dcs-export`, переносимые поля и сборку файла; набор полей JSON и
 * секции Excel описывает модуль. Благодаря этому новая игра не требует
 * правок экспорта.
 *
 * 📌 Подписи Excel — i18n-ключи: язык выбирает ядро в момент выгрузки.
 */
export interface GameExportAdapter<TCharacter extends CharacterRecord> {
  /** Поля листа, которые попадают в переносимый JSON (без служебных). */
  toPortableJson(
    character: TCharacter,
    config: GameExportConfig,
  ): Record<string, unknown>;
  /** Секции Excel в порядке вывода; подписи — уже переведённые строки. */
  buildExcelSections(
    character: TCharacter,
    config: GameExportConfig,
    translate: ExportTranslate,
  ): readonly ExcelSection[];
}

/** Один шаг цепочки версий схемы листа; должен быть идемпотентным. */
export interface CharacterMigration {
  readonly from: number;
  readonly to: number;
  migrate(raw: Readonly<Record<string, unknown>>): Record<string, unknown>;
}

/**
 * Минимальный ref-контракт листа: сохранить всё, что сейчас в режиме
 * правки. Ядро не знает, какие секции есть у редакции, — оно лишь дергает
 * `saveAll()` перед переходом/выходом.
 */
export interface SheetHandle {
  saveAll(): void;
}

/** Форма создания персонажа модуля (пропсов пока не требует). */
export type CreateFormComponent = ComponentType<Record<string, never>>;

/** Общие пропсы листа, которые передаёт ядро. */
export interface GameSheetProps<TCharacter extends CharacterRecord> {
  character: TCharacter;
  isCompactView: boolean;
  activeCompactSection: string;
  ref?: Ref<SheetHandle>;
}

export type SheetComponent<TCharacter extends CharacterRecord> = ComponentType<
  GameSheetProps<TCharacter>
>;

/** Пункт навигации мобильного сайдбара, который отдаёт плагин (D11). */
export interface PluginNavItem {
  /** Идентификатор секции; совпадает с `id` секции листа. */
  readonly id: string;
  /** i18n-ключ подписи (полный, с namespace). */
  readonly labelKey: string;
  readonly icon?: ReactNode;
}

/** Вариант бейджа карточки персонажа — часть оформления игры. */
export type CardBadgeVariant =
  'default' | 'secondary' | 'outline' | 'destructive';

/**
 * Сводка персонажа для карточки на дашборде: подпись и вариант бейджа.
 * Раньше ядро знало «Wizard 5» / «Scholar Adept» и цвета бейджей; теперь
 * это отдаёт плагин (этап 3).
 */
export interface CardSummary {
  readonly text: string;
  readonly badgeVariant?: CardBadgeVariant;
}

/** Значение ячейки массового редактора. */
export type BulkEditorValue = number | string;

/** Колонка таблицы массового редактора (`/stats-editor`). */
export interface BulkEditorColumn<TCharacter extends CharacterRecord> {
  readonly key: string;
  /** Полный i18n-ключ подписи колонки. */
  readonly labelKey: string;
  readonly type?: 'number' | 'text';
  readonly min?: number;
  readonly max?: number;
  /** Текущее значение листа (для инициализации ячейки). */
  readonly value: (character: TCharacter) => BulkEditorValue;
}

/**
 * Вкладка массового редактора. Вкладка `stats` общая для всех плагинов
 * (карточки идут отдельными блоками), вкладки жизненных показателей —
 * свои у каждой игры/редакции.
 */
export interface BulkEditorTab {
  readonly id: string;
  readonly labelKey: string;
  readonly order: number;
  /** Показывать количество персонажей в подписи вкладки. */
  readonly showCount?: boolean;
  /** Ключ подписи кнопки Save All («Сохранить все …»). */
  readonly saveAllLabelKey: string;
  /** Ключ сообщения после Save All («Все … сохранены»). */
  readonly saveAllDoneKey: string;
  /** Ключ пустого состояния вкладки (если строк нет). */
  readonly emptyKey?: string;
}

/**
 * Таблица массового редактора, которую отдаёт плагин (слот `BulkEditor`).
 * Хост рисует разметку и хранит состояние, плагин — колонки, значения по
 * умолчанию и сборку патча для сохранения. Так в `/stats-editor` не остаётся
 * `if (gameSystem === …)`.
 */
export interface BulkEditorTable<TCharacter extends CharacterRecord> {
  readonly id: string;
  readonly tab: BulkEditorTab;
  /** Порядок карточек внутри вкладки (не совпадает с порядком вкладок). */
  readonly order: number;
  readonly titleKey: string;
  readonly descriptionKey: string;
  /** Добавить к заголовку имя редакции (`games.dh1.name`) через `·`. */
  readonly editionNameKey?: string;
  readonly minWidth: number;
  /** CSS grid-template-columns; по умолчанию гибкие колонки под count. */
  readonly gridTemplate?: string;
  readonly gap?: 1 | 2;
  /** Ключ сообщения «сохранены статы/показатели для …». */
  readonly saveOneKey: string;
  readonly columns: readonly BulkEditorColumn<TCharacter>[];
  /** Патч листа по значениям строки. */
  apply: (
    character: TCharacter,
    values: Readonly<Record<string, BulkEditorValue>>,
  ) => Partial<TCharacter>;
}

/** Пропсы слотов, которым нужен диалог домашних правил. */
export interface GameHouseRulesDialogProps {
  readonly characterId: string;
  readonly open: boolean;
  readonly onOpenChange: (open: boolean) => void;
}

/**
 * ─── LANDMARK: GAME_UI_SLOTS ───────────────────────────────────────────────
 * Необязательные UI-слоты плагина (этап 3, D11). Хост рисует слот, если он
 * задан, и нейтральный вариант, если нет, — поэтому в ядре нет
 * `if (gameSystem === …)`.
 *
 *   • `HeaderActions`      — правая/левая часть шапки листа (вдохновение,
 *                            кнопка домашних правил);
 *   • `HeaderSubtitle`     — однострочная подпись под именем в шапке;
 *   • `CompactNav`         — пункты мобильного сайдбара;
 *   • `BulkEditor`         — таблицы массового редактора (этап 3b): плагин
 *                            описывает колонки и патч, хост рисует разметку;
 *   • `CardSummary`        — подпись и бейдж карточки на дашборде;
 *   • `HouseRulesDialog`   — содержимое диалога домашних правил: хост даёт
 *                            кнопку/пункт меню, плагин — тело диалога.
 *
 * Плюс статическая `favicon` — иконка вкладки игры (раньше ядро угадывало её
 * по словам в `gameSystem`).
 */
export interface GameUiSlots<
  TCharacter extends CharacterRecord = CharacterRecord,
> {
  readonly HeaderActions?: ComponentType<{
    character: TCharacter;
    isCompactView: boolean;
  }>;
  readonly HeaderSubtitle?: (
    character: TCharacter,
    t: (key: string) => string,
  ) => string;
  readonly CompactNav?: (character: TCharacter) => readonly PluginNavItem[];
  /** Таблицы массового редактора `/stats-editor` (слот `BulkEditor`). */
  readonly bulkEditor?: readonly BulkEditorTable<TCharacter>[];
  readonly CardSummary?: (
    character: TCharacter,
    t: (key: string) => string,
  ) => CardSummary;
  readonly HouseRulesDialog?: ComponentType<GameHouseRulesDialogProps>;
  /** Путь к иконке вкладки для игры (public/…). */
  readonly favicon?: string;
}

/**
 * Ленивые точки входа в UI модуля. Функции возвращают `import()`-промис,
 * поэтому реестр можно импортировать на сервере, не втягивая клиентские
 * бандлы форм и листов.
 */
export interface GameModuleComponents<TCharacter extends CharacterRecord> {
  loadCreateForm: () => Promise<{ default: CreateFormComponent }>;
  loadSheet: () => Promise<{ default: SheetComponent<TCharacter> }>;
}

/**
 * Модуль игры/редакции. `TCharacter` — форма листа конкретной редакции.
 */
export interface GameModule<
  TCharacter extends CharacterRecord = CharacterRecord,
> {
  /** Машинный ID редакции; дискриминант листа (`systemId`). */
  readonly id: SystemId;
  /** Игра-семейство (`dnd`, `darkHeresy`, …). */
  readonly gameId: GameId;
  /** Порядок в списках (игра, затем редакция). */
  readonly order: number;
  /** Статус по умолчанию; runtime-переопределение — в game-catalog.json. */
  readonly defaultStatus: ModuleStatus;

  /** i18n-ключи названия и описания редакции. */
  readonly nameKey: string;
  readonly descriptionKey: string;

  /** Версия схемы листа, которую пишет модуль. */
  readonly schemaVersion: number;
  /** Строгая zod-схема листа (сверяется с типом через tsc). */
  readonly schema: ZodType<TCharacter>;

  /** Словари модуля (en/ru), сливаются с общим слоем при инициализации. */
  readonly i18n: LocalizedMessages;

  /** Capability-конфиг общих компонентов (DH1/DH2 и т.п.). */
  readonly capabilities: ModuleCapabilities;

  /**
   * Фабрика персонажа с дефолтными значениями. `id` присваивает сервер при
   * создании, поэтому фабрика возвращает черновик без него.
   */
  createDefaults(
    input?: Readonly<Record<string, unknown>>,
  ): Omit<TCharacter, 'id'>;

  /** Демо-персонаж для `/demo` (без `id`). */
  createDemo(): Omit<TCharacter, 'id'>;

  /** Ленивые компоненты формы и листа. */
  readonly components: GameModuleComponents<TCharacter>;

  /** Адаптер экспорта (JSON-поля + секции Excel). */
  readonly export: GameExportAdapter<TCharacter>;

  /** Цепочка миграций схемы листа (в порядке применения). */
  readonly migrations: readonly CharacterMigration[];

  /** Необязательные UI-слоты плагина (этап 3, D11). */
  readonly ui?: GameUiSlots<TCharacter>;

  /**
   * Привести legacy/импортированный лист к типу редакции: дефолты
   * отсутствующих структур, канонизация значений, перенос полей между
   * редакциями. Идемпотентна — вызывается и при старте, и при импорте (этап 2).
   */
  normalize?(
    raw: Readonly<Record<string, unknown>>,
    options?: NormalizeOptions,
  ): NormalizeResult<TCharacter>;

  /**
   * Слить импортированные данные в существующий лист. Раньше это делала
   * `mergeImportedData` ветками `isDnd/isDh1/isDh2`; теперь — модуль (этап 2).
   */
  merge?(
    target: TCharacter,
    source: Readonly<Record<string, unknown>>,
    config: GameExportConfig,
  ): TCharacter;
}
