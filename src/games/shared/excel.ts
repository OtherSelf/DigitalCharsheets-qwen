import type { ExportTranslate } from '../types';

/**
 * ─── LANDMARK: EXCEL SECTION WRITER ────────────────────────────────────────
 * Общий конструктор секций Excel для адаптеров модулей. Модуль описывает
 * только свои секции и строки (через i18n-ключи), ядро пишет технический блок
 * и собирает лист. Так новая игра не требует правок `export-utils.ts`.
 */
export type ExcelCell = string | number | boolean | null | undefined;

export interface ExcelSection {
  title: string;
  rows: ExcelCell[][];
}

export interface ExcelSectionWriter {
  sections: ExcelSection[];
  section(titleKey: string): void;
  sub(labelKey: string): void;
  row(labelKey: string, value: unknown): void;
  raw(...cells: ExcelCell[]): void;
  empty(): void;
  /** Заголовок таблицы: первая ячейка с отступом, остальные как есть. */
  tableHeader(labelKeys: readonly string[]): void;
  /** Строка таблицы: первая ячейка с отступом, остальные как есть. */
  tableRow(cells: readonly ExcelCell[]): void;
  /** Список в одну ячейку: «• элемент» на строку. */
  list(items: readonly unknown[], nameKey?: string): string;
}

function formatCell(value: unknown): ExcelCell {
  if (value === undefined || value === null) return undefined;
  if (typeof value === 'string') return value.trim();
  if (typeof value === 'number' || typeof value === 'boolean') return value;
  if (Array.isArray(value)) return value.map(String).join(', ');
  return String(value);
}

export function createExcelSections(t: ExportTranslate): ExcelSectionWriter {
  const sections: ExcelSection[] = [];
  let current: ExcelSection | null = null;

  const ensure = (): ExcelSection => {
    if (!current) {
      current = { title: '', rows: [] };
      sections.push(current);
    }
    return current;
  };

  return {
    sections,
    section: (titleKey) => {
      current = { title: t(titleKey), rows: [] };
      sections.push(current);
    },
    sub: (labelKey) => {
      ensure().rows.push([`  ${t(labelKey)}`]);
    },
    row: (labelKey, value) => {
      const formatted =
        typeof value === 'boolean'
          ? t(value ? 'io.excel.yes' : 'io.excel.no')
          : formatCell(value);
      if (formatted === undefined || formatted === '') return;
      ensure().rows.push([`    ${t(labelKey)}`, formatted]);
    },
    raw: (...cells) => {
      ensure().rows.push(cells);
    },
    empty: () => {
      ensure().rows.push([]);
    },
    tableHeader: (labelKeys) => {
      ensure().rows.push(
        labelKeys.map((key, index) => (index === 0 ? `    ${t(key)}` : t(key))),
      );
    },
    tableRow: (cells) => {
      const formatted = cells.map(formatCell);
      if (formatted.length === 0) return;
      ensure().rows.push([
        `    ${String(formatted[0] ?? '')}`,
        ...formatted.slice(1),
      ]);
    },
    list: (items, nameKey = 'name') => {
      if (!items || items.length === 0) return t('io.excel.none');
      return items
        .map((item) => {
          if (typeof item === 'string') return `• ${item}`;
          if (item && typeof item === 'object') {
            const record = item as Record<string, unknown>;
            const name =
              record[nameKey] ??
              record.label ??
              record.title ??
              record.name ??
              JSON.stringify(item);
            return `• ${String(name)}`;
          }
          return `• ${String(item)}`;
        })
        .join('\n');
    },
  };
}
