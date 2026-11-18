/**
 * Фикстуры экспорта: конфиг «все секции выключены», File из JSON и конверт
 * метаданных с фиксированной датой (PNG-подобная детерминированность: дата
 * не зависит от дня прогона).
 */

import {
  DEFAULT_EXPORT_CONFIG,
  EXPORT_APP_NAME,
  EXPORT_FORMAT,
  EXPORT_FORMAT_VERSION,
} from '@/lib/export-utils';

export const allOff = Object.fromEntries(
  Object.keys(DEFAULT_EXPORT_CONFIG).map((key) => [key, false]),
) as unknown as typeof DEFAULT_EXPORT_CONFIG;

export const fileOf = (content: unknown, name = 'backup.json') =>
  new File(
    [typeof content === 'string' ? content : JSON.stringify(content)],
    name,
    {
      type: 'application/json',
    },
  );

export const meta = (
  kind: 'character' | 'backup',
  extra: Record<string, unknown> = {},
) => ({
  appName: EXPORT_APP_NAME,
  format: EXPORT_FORMAT,
  version: EXPORT_FORMAT_VERSION,
  kind,
  exportDate: '2026-11-08T12:00:00.000Z',
  characterCount: kind === 'backup' ? 2 : 1,
  ...extra,
});
