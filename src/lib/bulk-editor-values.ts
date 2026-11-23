import type {
  BulkEditorColumn,
  BulkEditorTable,
  BulkEditorValue,
} from '@/games/types';

/**
 * Привести значение колонки Bulk Editor к допустимому виду.
 *
 * Числа ограничены `column.min/max` и целые: браузерные `min`/`max` не
 * защищают от ручного ввода, а `parseInt('') || 0` раньше молча писал 0.
 * Текст не трогаем — его ограничения задаёт схема редакции на сервере.
 */
function normalizeBulkValue(
  column: BulkEditorColumn<any>,
  raw: unknown,
): BulkEditorValue {
  if (column.type === 'text') return String(raw ?? '');

  const parsed =
    typeof raw === 'number' ? raw : Number.parseInt(String(raw ?? ''), 10);
  let value = Number.isFinite(parsed) ? Math.trunc(parsed) : 0;

  if (column.min !== undefined) value = Math.max(column.min, value);
  if (column.max !== undefined) value = Math.min(column.max, value);
  return value;
}

/** Нормализовать все значения строки перед `table.apply`. */
export function normalizeBulkValues(
  table: BulkEditorTable<any>,
  values: Readonly<Record<string, BulkEditorValue>>,
): Record<string, BulkEditorValue> {
  const normalized: Record<string, BulkEditorValue> = {};
  for (const column of table.columns) {
    normalized[column.key] = normalizeBulkValue(column, values[column.key]);
  }
  return normalized;
}
