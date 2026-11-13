import {
  emptyHistorySummary,
  HISTORY_MAX_CHANGES,
  HISTORY_MAX_VALUE_CHARS,
  type HistoryChange,
  type HistorySummary,
  type StoredValue,
} from './history-types';

/**
 * ─── LANDMARK: HISTORY DIFF ─────────────────────────────────────────────────
 * Чистый структурный diff листа для журнала изменений. Задача — не
 * восстановить состояние, а показать человеку, что поменялось: путь поля,
 * было, стало, добавлено, удалено.
 *
 * Почему не JSON Patch: его пути и массивы нечитаемы в UI, а подписи полей
 * пришлось бы восстанавливать по номерам индексов. Здесь массивы объектов
 * (инвентарь, заклинания, квесты) сравниваются по стабильному ключу
 * (`id`/`name`/…), поэтому запись выглядит как «Инвентарь · Меч: заметка
 * изменилась», а не «/inventory/17/notes».
 *
 * Функция не трогает входные объекты и не знает игр: все пути — данные.
 */

export interface CharacterDiff {
  changes: HistoryChange[];
  summary: HistorySummary;
  /** true — список изменений обрезан по `maxChanges`. */
  truncated: boolean;
}

export interface DiffOptions {
  maxChanges?: number;
  maxValueChars?: number;
}

/**
 * Поля, которые не являются содержанием листа: служебные идентификаторы,
 * версия схемы, legacy-зеркало игры и даты квестов. Без этого каждая правка
 * квеста давала бы шум «createdAt/updatedAt изменились».
 */
const IGNORED_KEYS = new Set([
  'id',
  'userId',
  'systemId',
  'schemaVersion',
  'gameSystem',
  'createdAt',
  'updatedAt',
]);

function isIgnoredKey(key: string): boolean {
  return key.startsWith('__') || IGNORED_KEYS.has(key);
}

function isPlainObject(value: unknown): value is Record<string, unknown> {
  if (value === null || typeof value !== 'object' || Array.isArray(value)) {
    return false;
  }
  const prototype = Object.getPrototypeOf(value);
  return prototype === Object.prototype || prototype === null;
}

function hasOwn(value: Record<string, unknown>, key: string): boolean {
  return Object.prototype.hasOwnProperty.call(value, key);
}

function deepEqual(a: unknown, b: unknown): boolean {
  if (Object.is(a, b)) return true;
  if (Array.isArray(a) && Array.isArray(b)) {
    if (a.length !== b.length) return false;
    return a.every((item, index) => deepEqual(item, b[index]));
  }
  if (isPlainObject(a) && isPlainObject(b)) {
    const aKeys = Object.keys(a);
    const bKeys = Object.keys(b);
    if (aKeys.length !== bKeys.length) return false;
    return aKeys.every((key) => hasOwn(b, key) && deepEqual(a[key], b[key]));
  }
  return false;
}

/**
 * Уложить значение в лимит журнала. Для строк режем саму строку, для
 * объектов — их JSON: UI показывает preview и честно говорит, что значение
 * обрезано. Полное значение не храним — иначе одна правка заметок на 200 КБ
 * раздувает файл.
 */
function storeValue(value: unknown, maxChars: number): StoredValue {
  if (value === undefined) return {};

  if (typeof value === 'string') {
    if (value.length <= maxChars) return { value };
    return {
      truncated: true,
      preview: value.slice(0, maxChars),
      length: value.length,
    };
  }

  let json: string;
  try {
    json = JSON.stringify(value) ?? '';
  } catch {
    json = String(value);
  }
  if (json.length <= maxChars) return { value };
  return {
    truncated: true,
    preview: json.slice(0, maxChars),
    length: json.length,
  };
}

function joinPath(prefix: string, key: string): string {
  return prefix ? `${prefix}.${key}` : key;
}

interface KeyedItem {
  key: string;
  label?: string;
  item: Record<string, unknown>;
}

const KEY_FIELDS = ['id', 'key', 'name', 'title', 'label', 'class'] as const;
const LABEL_FIELDS = ['name', 'title', 'description', 'label'] as const;

function labelOf(item: Record<string, unknown>): string | undefined {
  for (const field of LABEL_FIELDS) {
    const value = item[field];
    if (typeof value === 'string' && value.trim() !== '') {
      return value.length > 80 ? value.slice(0, 80) : value;
    }
  }
  return undefined;
}

/** Стабильный ключ элемента массива; `null`, если ключа нет или он не уникален. */
function keyedItems(array: readonly unknown[]): KeyedItem[] | null {
  const result: KeyedItem[] = [];
  const seen = new Set<string>();

  for (const item of array) {
    if (!isPlainObject(item)) return null;
    let key: string | undefined;
    for (const field of KEY_FIELDS) {
      const value = item[field];
      if (typeof value === 'string' && value.trim() !== '') {
        key = value;
        break;
      }
      if (typeof value === 'number' && Number.isFinite(value)) {
        key = String(value);
        break;
      }
    }
    if (key === undefined || seen.has(key)) return null;
    seen.add(key);
    result.push({ key, label: labelOf(item), item });
  }

  return result;
}

function isPrimitiveArray(array: readonly unknown[]): boolean {
  return array.every((value) => {
    if (value === null) return true;
    return (
      typeof value === 'string' ||
      typeof value === 'number' ||
      typeof value === 'boolean'
    );
  });
}

function primitiveToken(value: unknown): string {
  return `${typeof value}:${JSON.stringify(value)}`;
}

function addChange(changes: HistoryChange[], change: HistoryChange): void {
  changes.push(change);
}

function diffObject(
  prefix: string,
  before: Record<string, unknown>,
  after: Record<string, unknown>,
  changes: HistoryChange[],
  maxChars: number,
): void {
  const keys = Array.from(
    new Set([...Object.keys(before), ...Object.keys(after)]),
  ).sort();

  for (const key of keys) {
    if (isIgnoredKey(key)) continue;
    const path = joinPath(prefix, key);
    const inBefore = hasOwn(before, key) && before[key] !== undefined;
    const inAfter = hasOwn(after, key) && after[key] !== undefined;

    if (!inBefore && !inAfter) continue;
    if (!inBefore) {
      addChange(changes, {
        kind: 'added',
        path,
        after: storeValue(after[key], maxChars),
      });
      continue;
    }
    if (!inAfter) {
      addChange(changes, {
        kind: 'removed',
        path,
        before: storeValue(before[key], maxChars),
      });
      continue;
    }

    diffValue(path, before[key], after[key], changes, maxChars);
  }
}

function diffValue(
  path: string,
  before: unknown,
  after: unknown,
  changes: HistoryChange[],
  maxChars: number,
): void {
  if (deepEqual(before, after)) return;

  if (isPlainObject(before) && isPlainObject(after)) {
    diffObject(path, before, after, changes, maxChars);
    return;
  }

  if (Array.isArray(before) && Array.isArray(after)) {
    diffArray(path, before, after, changes, maxChars);
    return;
  }

  addChange(changes, {
    kind: 'changed',
    path,
    before: storeValue(before, maxChars),
    after: storeValue(after, maxChars),
  });
}

function diffKeyedItem(
  path: string,
  key: string,
  label: string | undefined,
  before: Record<string, unknown>,
  after: Record<string, unknown>,
  changes: HistoryChange[],
  maxChars: number,
): void {
  const fields = Array.from(
    new Set([...Object.keys(before), ...Object.keys(after)]),
  ).sort();

  for (const field of fields) {
    if (isIgnoredKey(field)) continue;
    const inBefore = hasOwn(before, field) && before[field] !== undefined;
    const inAfter = hasOwn(after, field) && after[field] !== undefined;
    const base = { path, key, label, field };

    if (!inBefore && !inAfter) continue;
    if (!inBefore) {
      addChange(changes, {
        kind: 'added',
        ...base,
        after: storeValue(after[field], maxChars),
      });
      continue;
    }
    if (!inAfter) {
      addChange(changes, {
        kind: 'removed',
        ...base,
        before: storeValue(before[field], maxChars),
      });
      continue;
    }

    if (!deepEqual(before[field], after[field])) {
      addChange(changes, {
        kind: 'changed',
        ...base,
        before: storeValue(before[field], maxChars),
        after: storeValue(after[field], maxChars),
      });
    }
  }
}

function diffKeyedArray(
  path: string,
  before: KeyedItem[],
  after: KeyedItem[],
  changes: HistoryChange[],
  maxChars: number,
): void {
  const beforeByKey = new Map(before.map((item) => [item.key, item]));
  const afterByKey = new Map(after.map((item) => [item.key, item]));

  for (const item of before) {
    if (afterByKey.has(item.key)) continue;
    addChange(changes, {
      kind: 'removed',
      path,
      key: item.key,
      label: item.label,
      before: storeValue(item.item, maxChars),
    });
  }

  for (const item of after) {
    if (beforeByKey.has(item.key)) continue;
    addChange(changes, {
      kind: 'added',
      path,
      key: item.key,
      label: item.label,
      after: storeValue(item.item, maxChars),
    });
  }

  for (const item of after) {
    const previous = beforeByKey.get(item.key);
    if (!previous) continue;
    diffKeyedItem(
      path,
      item.key,
      item.label,
      previous.item,
      item.item,
      changes,
      maxChars,
    );
  }
}

function diffPrimitiveArray(
  path: string,
  before: readonly unknown[],
  after: readonly unknown[],
  changes: HistoryChange[],
  maxChars: number,
): void {
  const beforeCounts = new Map<string, number>();
  const afterCounts = new Map<string, number>();
  const values = new Map<string, unknown>();

  for (const value of before) {
    const token = primitiveToken(value);
    beforeCounts.set(token, (beforeCounts.get(token) ?? 0) + 1);
    values.set(token, value);
  }
  for (const value of after) {
    const token = primitiveToken(value);
    afterCounts.set(token, (afterCounts.get(token) ?? 0) + 1);
    values.set(token, value);
  }

  const added: unknown[] = [];
  const removed: unknown[] = [];
  for (const [token, count] of afterCounts) {
    const delta = count - (beforeCounts.get(token) ?? 0);
    for (let i = 0; i < delta; i += 1) added.push(values.get(token));
  }
  for (const [token, count] of beforeCounts) {
    const delta = count - (afterCounts.get(token) ?? 0);
    for (let i = 0; i < delta; i += 1) removed.push(values.get(token));
  }

  if (added.length + removed.length > 50) {
    addChange(changes, {
      kind: 'bulk',
      path,
      beforeCount: before.length,
      afterCount: after.length,
      count: added.length + removed.length,
    });
    return;
  }

  if (added.length > 0) {
    addChange(changes, {
      kind: 'array-add',
      path,
      values: added.map((value) => storeValue(value, maxChars)),
    });
  }
  if (removed.length > 0) {
    addChange(changes, {
      kind: 'array-remove',
      path,
      values: removed.map((value) => storeValue(value, maxChars)),
    });
  }

  // Тот же набор, другой порядок: построчно не показываем.
  if (added.length === 0 && removed.length === 0 && !deepEqual(before, after)) {
    addChange(changes, {
      kind: 'bulk',
      path,
      beforeCount: before.length,
      afterCount: after.length,
      count: before.length,
    });
  }
}

function diffArray(
  path: string,
  before: readonly unknown[],
  after: readonly unknown[],
  changes: HistoryChange[],
  maxChars: number,
): void {
  if (before.length === 0 && after.length === 0) return;

  const beforeKeyed = keyedItems(before);
  const afterKeyed = keyedItems(after);

  if (before.length === 0 && afterKeyed) {
    for (const item of afterKeyed) {
      addChange(changes, {
        kind: 'added',
        path,
        key: item.key,
        label: item.label,
        after: storeValue(item.item, maxChars),
      });
    }
    return;
  }

  if (after.length === 0 && beforeKeyed) {
    for (const item of beforeKeyed) {
      addChange(changes, {
        kind: 'removed',
        path,
        key: item.key,
        label: item.label,
        before: storeValue(item.item, maxChars),
      });
    }
    return;
  }

  if (beforeKeyed && afterKeyed) {
    diffKeyedArray(path, beforeKeyed, afterKeyed, changes, maxChars);
    return;
  }

  const beforePrimitive = isPrimitiveArray(before);
  const afterPrimitive = isPrimitiveArray(after);

  if (beforePrimitive && afterPrimitive) {
    diffPrimitiveArray(path, before, after, changes, maxChars);
    return;
  }

  addChange(changes, {
    kind: 'changed',
    path,
    before: storeValue(before, maxChars),
    after: storeValue(after, maxChars),
  });
}

function summarize(changes: readonly HistoryChange[]): HistorySummary {
  const summary = emptyHistorySummary();
  for (const change of changes) {
    if (change.kind === 'changed') summary.changed += 1;
    else if (change.kind === 'added' || change.kind === 'array-add') {
      summary.added += 1;
    } else if (change.kind === 'removed' || change.kind === 'array-remove') {
      summary.removed += 1;
    } else {
      summary.bulk += 1;
    }
  }
  return summary;
}

function compareText(a: string | undefined, b: string | undefined): number {
  const left = a ?? '';
  const right = b ?? '';
  if (left === right) return 0;
  return left < right ? -1 : 1;
}

function compareChanges(a: HistoryChange, b: HistoryChange): number {
  // Сводное «слишком много изменений» — всегда в конце.
  if (a.kind === 'bulk' && b.kind !== 'bulk') return 1;
  if (a.kind !== 'bulk' && b.kind === 'bulk') return -1;

  return (
    compareText(a.path, b.path) ||
    compareText(a.key, b.key) ||
    compareText(a.field, b.field) ||
    compareText(a.kind, b.kind)
  );
}

/**
 * Сравнить два листа. `null` — содержательных изменений нет (включая правку
 * только служебных полей): журнал в этом случае не пишется.
 */
export function diffCharacterRecords(
  before: Readonly<Record<string, unknown>>,
  after: Readonly<Record<string, unknown>>,
  options: DiffOptions = {},
): CharacterDiff | null {
  const maxChanges = Math.max(1, options.maxChanges ?? HISTORY_MAX_CHANGES);
  const maxChars = Math.max(
    1,
    options.maxValueChars ?? HISTORY_MAX_VALUE_CHARS,
  );

  const changes: HistoryChange[] = [];
  diffObject('', before, after, changes, maxChars);
  if (changes.length === 0) return null;

  const summary = summarize(changes);
  changes.sort(compareChanges);

  if (changes.length > maxChanges) {
    const kept = changes.slice(0, Math.max(0, maxChanges - 1));
    kept.push({
      kind: 'bulk',
      path: '',
      count: changes.length,
    });
    summary.bulk += 1;
    return { changes: kept, summary, truncated: true };
  }

  return { changes, summary, truncated: false };
}
