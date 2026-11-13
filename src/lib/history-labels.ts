import type { GameHistoryConfig } from '@/games/types';

import type { HistoryChange, StoredValue } from './history-types';

/**
 * ─── LANDMARK: HISTORY LABELS ───────────────────────────────────────────────
 * Подписи для экрана истории. Ядро не знает игр: плагин отдаёт карту
 * «путь → i18n-ключ», а неизвестные поля показываются человекочитаемым путём
 * (`hitPoints.current` → «hitPoints · current»). Это честнее, чем выдумывать
 * перевод или печатать сырой JSON.
 */

export interface HistoryLabelModule {
  readonly history?: GameHistoryConfig;
}

/** `hitPoints.current` / `inventory_item` → «hitPoints · current». */
export function humanizeHistoryPath(path: string): string {
  if (!path) return '';
  return path
    .split('.')
    .map((segment) =>
      segment
        .replace(/([a-z0-9])([A-Z])/g, '$1 $2')
        .replace(/[_-]+/g, ' ')
        .trim()
        .toLowerCase(),
    )
    .filter(Boolean)
    .join(' · ');
}

function humanizeField(field: string): string {
  return humanizeHistoryPath(field);
}

/**
 * Подпись одного изменения. Для элемента массива собирает
 * «Коллекция · Элемент · поле»; если плагин дал точную подпись поля, она
 * используется вместо человекочитаемого сегмента.
 */
export function resolveHistoryLabel(
  change: HistoryChange,
  config: GameHistoryConfig | undefined,
  t: (key: string) => string,
): string {
  if (change.kind === 'bulk' && !change.path) {
    return t('history.tooManyChanges');
  }

  const fieldPath = change.field
    ? `${change.path}.${change.field}`
    : change.path;

  if (change.key !== undefined) {
    const collectionKey = config?.collections?.[change.path];
    const base = collectionKey
      ? t(collectionKey)
      : humanizeHistoryPath(change.path);
    const item = change.label ?? change.key;
    const fieldKey = change.field
      ? (config?.labels?.[fieldPath] ?? null)
      : null;
    const field = change.field
      ? fieldKey
        ? t(fieldKey)
        : humanizeField(change.field)
      : '';
    return [base, item, field].filter(Boolean).join(' · ');
  }

  const exact = config?.labels?.[fieldPath] ?? config?.labels?.[change.path];
  if (exact) return t(exact);

  const collectionKey = config?.collections?.[change.path];
  if (collectionKey) return t(collectionKey);

  return humanizeHistoryPath(fieldPath);
}

/** Текстовое представление значения для строки «было/стало». */
export function formatHistoryValue(value: StoredValue | undefined): string {
  if (!value) return '';
  if (value.truncated === true) {
    return value.preview ?? '';
  }
  if (value.value === null) return 'null';
  if (typeof value.value === 'string') return value.value;
  try {
    return JSON.stringify(value.value) ?? '';
  } catch {
    return String(value.value);
  }
}

/** Дата/время для таймлайна; язык выбирает вызывающий. */
export function formatHistoryDate(
  iso: string,
  language: 'en' | 'ru',
  options: Intl.DateTimeFormatOptions = {
    dateStyle: 'medium',
    timeStyle: 'short',
  },
): string {
  const date = new Date(iso);
  if (!Number.isFinite(date.getTime())) return iso;
  return new Intl.DateTimeFormat(
    language === 'ru' ? 'ru-RU' : 'en-GB',
    options,
  ).format(date);
}
