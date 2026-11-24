import type { GameHistoryConfig } from '@/games/types';
import type { Language } from '@/lib/language';

import type { HistoryChange, StoredValue } from './history-types';

/**
 * ─── LANDMARK: HISTORY LABELS ───────────────────────────────────────────────
 * Подписи для экрана истории. Ядро не знает игр: плагин отдаёт карту
 * «путь → i18n-ключ», а неизвестные поля показываются человекочитаемым путём
 * (`hitPoints.current` → «hitPoints · current»). Это честнее, чем выдумывать
 * перевод или печатать сырой JSON.
 */

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
 * Последний сегмент пути подписывается отдельно, а родитель — по самой
 * длинной известной подписи/коллекции. Так `equipment.armor.Head.ap`
 * превращается в «Броня · AP», а не в английский путь целиком.
 */
function resolveBySegments(
  fieldPath: string,
  config: GameHistoryConfig | undefined,
  t: (key: string) => string,
): string {
  const segments = fieldPath.split('.').filter(Boolean);
  const last = segments.pop() ?? '';
  const parent = segments.join('.');
  let parentText = '';
  if (parent) {
    for (let index = segments.length; index > 0; index -= 1) {
      const key = segments.slice(0, index).join('.');
      const label = config?.labels?.[key] ?? config?.collections?.[key];
      if (label) {
        parentText = t(label);
        break;
      }
    }
    if (!parentText) parentText = humanizeHistoryPath(parent);
  }
  const lastLabel = config?.labels?.[last];
  const lastText = lastLabel ? t(lastLabel) : humanizeField(last);
  return [parentText, lastText].filter(Boolean).join(' · ');
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
    const collectionKey =
      config?.collections?.[change.path] ?? config?.labels?.[change.path];
    const base = collectionKey
      ? t(collectionKey)
      : resolveBySegments(change.path, config, t);
    const item = change.label ?? change.key;
    const fieldKey = change.field
      ? (config?.labels?.[fieldPath] ?? config?.labels?.[change.field] ?? null)
      : null;
    const field = change.field
      ? fieldKey
        ? t(fieldKey)
        : humanizeField(change.field)
      : '';
    return [base, item, field].filter(Boolean).join(' · ');
  }

  const exact =
    config?.labels?.[fieldPath] ??
    config?.labels?.[change.path] ??
    (change.field ? config?.labels?.[change.field] : undefined);
  if (exact) return t(exact);

  const collectionKey = config?.collections?.[change.path];
  if (collectionKey) return t(collectionKey);

  return resolveBySegments(fieldPath, config, t);
}

/**
 * Общие ключи ядра, которые конфиг истории вправе использовать. Всё, чего
 * здесь нет, плагин обязан держать в собственном словаре: ядро не хранит
 * игровые подписи. Список — часть SDK-контракта (docs/character-history.md).
 */
export const HISTORY_SHARED_KEYS: ReadonlySet<string> = new Set([
  // Общие поля листа и общие разделы.
  'common.name',
  'common.notes',
  'common.description',
  'common.inventory',
  'common.skills',
  'common.quantity',
  'common.questJournal',
  'common.backstory',
  'common.statsTab',
  'common.current',
  'common.max',
  'common.total',
  'common.class',
  'common.movement',
  'common.age',
  'common.height',
  'common.weight',
  'common.inspiration',
  'common.hpCurrent',
  'common.hpMax',
  'common.statStrAbbr',
  'common.statDexAbbr',
  'common.statConAbbr',
  'common.statIntAbbr',
  'common.statWisAbbr',
  'common.statChaAbbr',
  // Общий журнал заданий (рендерит ядро).
  'common.questActive',
  'common.questDone',
  'common.mainQuest',
  'common.sideQuest',
  'common.personalQuest',
  'common.questObjectives',
  'common.questRewards',
  'common.questNpcs',
  'common.questLocations',
]);

/**
 * Текстовое представление значения для строки «было/стало». Сначала плагин
 * через `formatValue` переводит доменные коды (мир, склонности, пол), затем
 * общие правила: булевы — «да/нет», массивы — элементы через запятую,
 * объекты — подпись элемента или текст задачи, `null` — прочерк. Сырой JSON
 * остаётся последним средством, а не обычным видом истории.
 */
export function formatHistoryValue(
  value: StoredValue | undefined,
  context: {
    config?: GameHistoryConfig;
    path?: string;
    t?: (key: string) => string;
  } = {},
): string {
  if (!value) return '';
  if (value.truncated === true) {
    return value.preview ?? '';
  }

  const raw = value.value;
  const { config, path, t } = context;

  if (raw === null || raw === undefined) return '—';

  if (config?.formatValue && path) {
    const formatted = config.formatValue(path, raw, t ?? ((key) => key));
    if (formatted !== undefined) return formatted;
  }

  const tokens = config?.tokens;

  if (typeof raw === 'boolean') {
    const token = raw ? tokens?.yes : tokens?.no;
    return token && t ? t(token) : String(raw);
  }

  if (typeof raw === 'string') {
    const last = path?.split('.').pop();
    if (tokens && t) {
      if (last === 'status') {
        const key =
          tokens.questStatus?.[raw as 'active' | 'completed'] ??
          tokens.itemStatus?.[raw as 'default' | 'lost'];
        if (key) return t(key);
      }
      if (last === 'priority') {
        const key = tokens.questPriority?.[raw as 'main' | 'side' | 'personal'];
        if (key) return t(key);
      }
    }
    if (config?.valueLabels && path && t) {
      const lastSegment = path.split('.').pop() ?? path;
      const labels =
        config.valueLabels[path] ?? config.valueLabels[lastSegment];
      const key = labels?.[raw];
      if (key) return t(key);
    }
    return raw;
  }

  if (Array.isArray(raw)) {
    if (raw.length === 0) return '—';
    return raw
      .map((item) =>
        formatHistoryValue({ value: item } as StoredValue, context),
      )
      .join(', ');
  }

  if (typeof raw === 'object') {
    const record = raw as Record<string, unknown>;
    // Задача квеста: «✓ текст» / «· текст».
    if (typeof record.text === 'string' && 'completed' in record) {
      return `${record.completed ? '✓' : '·'} ${record.text}`;
    }
    const fields = config?.itemLabelFields ?? [
      'name',
      'title',
      'description',
      'label',
    ];
    for (const field of fields) {
      const label = record[field];
      if (typeof label === 'string' && label.trim() !== '') return label;
    }
    try {
      return JSON.stringify(raw) ?? '';
    } catch {
      return String(raw);
    }
  }

  return String(raw);
}

/** Дата/время для таймлайна; язык выбирает вызывающий. */
export function formatHistoryDate(
  iso: string,
  language: Language,
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
