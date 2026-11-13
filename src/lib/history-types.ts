/**
 * ─── LANDMARK: HISTORY FORMAT ───────────────────────────────────────────────
 * Формат журнала изменений листа. Файл живёт рядом с листом
 * (`users/<uid>/history/<id>.jsonl`), поэтому схема листа и `schemaVersion`
 * не меняются, а старые листы не требуют миграции.
 *
 * Одна строка JSONL — одна ревизия. Значения `before`/`after` обёрнуты в
 * `StoredValue`, чтобы длинные заметки и большие массивы не раздували журнал:
 * вместо полного значения хранится preview с отметкой об обрезке.
 *
 * Версия формата лежит в каждой строке (`v`): парсер сможет пропустить
 * неизвестную запись, не ломая чтение всего файла.
 */

/** Версия строки журнала, которую пишет и понимает текущий код. */
export const HISTORY_FORMAT_VERSION = 1 as const;

/** Сколько изменений максимум хранится в одной ревизии. */
export const HISTORY_MAX_CHANGES = 200;

/** Сколько символов значения хранится до обрезки. */
export const HISTORY_MAX_VALUE_CHARS = 4000;

/** Разрыв, после которого начинается новая сессия в таймлайне. */
export const HISTORY_SESSION_GAP_MS = 30 * 60 * 1000;

/** Лимит файла истории на один лист (2 МиБ по умолчанию). */
export const HISTORY_DEFAULT_MAX_BYTES = 2 * 1024 * 1024;

/** Нижняя граница для `DCS_HISTORY_MAX_BYTES` — меньше хранить бессмысленно. */
export const HISTORY_MAX_BYTES_FLOOR = 64 * 1024;

/** Верхняя граница для `DCS_HISTORY_MAX_BYTES` — защита от случайного гигабайта. */
export const HISTORY_MAX_BYTES_CEILING = 64 * 1024 * 1024;

/** Откуда появилась ревизия. */
export type HistorySource = 'save' | 'create' | 'migration';

/**
 * Вид изменения. `array-add`/`array-remove` — для массивов примитивов,
 * `bulk` — когда изменений слишком много или структура не сравнима построчно.
 */
export type HistoryChangeKind =
  'changed' | 'added' | 'removed' | 'array-add' | 'array-remove' | 'bulk';

/**
 * Значение поля в журнале. Для небольших значений — `value` как есть; для
 * длинных — `preview` + `truncated` + исходная `length`.
 */
export interface StoredValue {
  /** JSON-значение, если оно уместилось в лимит. */
  value?: unknown;
  /** true — `value`/`preview` обрезаны. */
  truncated?: boolean;
  /** Текстовый превью большого значения. */
  preview?: string;
  /** Полная длина исходного значения (символы для строк, JSON-символы для остального). */
  length?: number;
}

/**
 * Одно изменение внутри ревизии. `path` — путь поля в листе (`stats.strength`);
 * для элемента массива `path` — путь массива, `key` — стабильный ключ элемента,
 * `label` — человекочитаемая подпись, `field` — поле внутри элемента.
 */
export interface HistoryChange {
  kind: HistoryChangeKind;
  path: string;
  key?: string;
  label?: string;
  field?: string;
  before?: StoredValue;
  after?: StoredValue;
  /** Значения для `array-add`/`array-remove`. */
  values?: StoredValue[];
  /** Счётчики для `bulk`. */
  beforeCount?: number;
  afterCount?: number;
  count?: number;
}

/** Счётчики ревизии для бейджей и быстрого рендера. */
export interface HistorySummary {
  changed: number;
  added: number;
  removed: number;
  bulk: number;
}

/** Одна запись журнала. */
export interface HistoryRevision {
  v: typeof HISTORY_FORMAT_VERSION;
  id: string;
  at: string;
  source: HistorySource;
  changes: HistoryChange[];
  summary: HistorySummary;
}

/**
 * Служебная строка после компакции: старые ревизии удалены по лимиту.
 * Лежит первой строкой файла.
 */
export interface HistoryTruncationMarker {
  v: typeof HISTORY_FORMAT_VERSION;
  kind: 'truncated';
  at: string;
  dropped: number;
}

/** Что можно встретить в JSONL. */
export type HistoryRecord = HistoryRevision | HistoryTruncationMarker;

/** Метка создания/миграции внутри сессии — без before/after. */
export interface HistoryMarker {
  source: HistorySource;
  at: string;
}

/** Сессия игры: ревизии, между которыми не было паузы больше 30 минут. */
export interface HistorySession {
  id: string;
  startedAt: string;
  endedAt: string;
  revisionCount: number;
  changes: HistoryChange[];
  markers: HistoryMarker[];
  truncated: boolean;
}

/** Состояние хранилища истории листа. */
export interface HistoryStorageInfo {
  bytes: number;
  truncated: boolean;
  oldestAt: string | null;
}

/** Страница истории, которую отдаёт API. */
export interface HistoryPage {
  sessions: HistorySession[];
  nextCursor: string | null;
  totalSessions: number;
  totalRevisions: number;
  storage: HistoryStorageInfo;
}

/** Пустые счётчики — чтобы не собирать объект по месту. */
export function emptyHistorySummary(): HistorySummary {
  return { changed: 0, added: 0, removed: 0, bulk: 0 };
}

/** Проверка служебной строки компакции. */
export function isHistoryTruncationMarker(
  record: HistoryRecord,
): record is HistoryTruncationMarker {
  return 'kind' in record && record.kind === 'truncated';
}
