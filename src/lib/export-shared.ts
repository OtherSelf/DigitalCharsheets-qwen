import type { Character } from './types';

/**
 * ─── LANDMARK: EXPORT ENVELOPE ─────────────────────────────────────────────
 * Конверт резервной копии: только данные, без браузерных API. Живёт отдельно
 * от `export-utils.ts`, потому что тот помечен `'use client'` (там скачивание
 * через `Blob` и `<a>`), а конверт нужен и серверу — например, выгрузке до
 * принятия политики (`/api/auth/pre-consent`). Next не даёт вызывать
 * клиентскую функцию из route handler: именно на этом падал экспорт.
 *
 * Нормализация листа и проверка «экспортируемо ли» остаются в `export-utils`
 * (они тянут контракт игровых модулей) — здесь только сборка конверта из уже
 * переносимых листов.
 */
export const EXPORT_APP_NAME = 'Digital Character Sheets';
export const EXPORT_FORMAT = 'dcs-export';
export const EXPORT_FORMAT_VERSION = '3.0';

/**
 * Имена, которые писали прошлые версии приложения. Импорт обязан их
 * принимать: иначе свежий билд отказался бы открывать бэкапы, сделанные до
 * переименования, — а имя приложения не является частью версии формата.
 */
export const LEGACY_EXPORT_APP_NAMES = ['DigitalCharsheets-qwen'];

export type ExportKind = 'character' | 'backup';

export interface ExportMetadata {
  appName: typeof EXPORT_APP_NAME;
  format: typeof EXPORT_FORMAT;
  version: string;
  kind: ExportKind;
  exportDate: string;
  characterCount: number;
  account?: string;
}

export interface BackupExport {
  metadata: ExportMetadata;
  characters: Array<Partial<Character>>;
}

/** Собрать конверт резервной копии из уже переносимых листов. */
export function buildBackupEnvelope(
  portableCharacters: Array<Partial<Character>>,
  account: string | undefined,
  now = new Date(),
): BackupExport {
  return {
    metadata: {
      appName: EXPORT_APP_NAME,
      format: EXPORT_FORMAT,
      version: EXPORT_FORMAT_VERSION,
      kind: 'backup',
      exportDate: now.toISOString(),
      characterCount: portableCharacters.length,
      ...(account ? { account } : {}),
    },
    characters: portableCharacters,
  };
}
