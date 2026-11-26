/**
 * Формат dcs-export v2: имена файлов, конверт с metadata, бэкап списка и
 * round-trip build → parse.
 */

import fs from 'node:fs';

import { describe, expect, it } from 'vitest';
import * as XLSX from 'xlsx';

import { generatedPlugins } from '@/games/registry.generated';
import {
  buildBackupExport,
  buildCharacterExport,
  DEFAULT_EXPORT_CONFIG,
  EXPORT_APP_NAME,
  EXPORT_FORMAT,
  EXPORT_FORMAT_VERSION,
  exportFileName,
  parseExportPayload,
} from '@/lib/export-utils';

import { makeCharacter } from '@tests/support';

// xlsx 0.20 в Node подхватывает fs только при CJS-загрузке; под vitest (ESM)
// детект не срабатывает, и writeFile/readFile уходят в браузерную ветку.
// Явно сообщаем библиотеке про node:fs — это нужно только тестам.
XLSX.set_fs(fs);

describe('export format', () => {
  const date = new Date('2026-11-08T12:34:56.000Z');

  it('имена файлов: dcs_character_<имя>_<дата> и dcs_characters_all_<логин>_<дата>', () => {
    expect(exportFileName('character', { name: 'Ragnar Testborn', date })).toBe(
      'dcs_character_Ragnar_Testborn_2026-11-08.json',
    );
    expect(exportFileName('backup', { login: 'petya', date })).toBe(
      'dcs_characters_all_petya_2026-11-08.json',
    );
    expect(
      exportFileName('character', {
        name: 'Ragnar Testborn',
        date,
        extension: 'xlsx',
      }),
    ).toBe('dcs_character_Ragnar_Testborn_2026-11-08.xlsx');
  });

  it('чистит недопустимые для ФС символы, кириллицу сохраняет', () => {
    expect(exportFileName('character', { name: 'A/B: C*?<>|', date })).toBe(
      'dcs_character_AB_C_2026-11-08.json',
    );
    expect(exportFileName('character', { name: 'Иван Грозный', date })).toBe(
      'dcs_character_Иван_Грозный_2026-11-08.json',
    );
  });

  it('buildCharacterExport: конверт с metadata и без служебных полей', () => {
    const payload = buildCharacterExport(
      makeCharacter('dnd5e', { name: 'Ragnar Testborn' }) as any,
      DEFAULT_EXPORT_CONFIG,
      date,
    );

    expect(payload.metadata).toMatchObject({
      appName: EXPORT_APP_NAME,
      format: EXPORT_FORMAT,
      version: EXPORT_FORMAT_VERSION,
      kind: 'character',
      exportDate: date.toISOString(),
      characterCount: 1,
    });
    expect(payload.metadata.config).toEqual(DEFAULT_EXPORT_CONFIG);
    expect((payload.character as any).userId).toBeUndefined();
    expect(payload.character.name).toBe('Ragnar Testborn');
  });

  it('buildBackupExport: список целиком, account и characterCount', () => {
    const payload = buildBackupExport(
      [
        makeCharacter('dnd5e', { id: 'a' }),
        makeCharacter('dh1', { id: 'b' }),
      ] as any,
      'petya',
      date,
    );

    expect(payload.metadata).toMatchObject({
      kind: 'backup',
      characterCount: 2,
      account: 'petya',
      exportDate: date.toISOString(),
    });
    expect(payload.characters).toHaveLength(2);
    expect((payload.characters[0] as any).userId).toBeUndefined();
  });

  it('build отказывается экспортировать лист без имени', () => {
    expect(() =>
      buildCharacterExport(
        makeCharacter('dnd5e', { name: '' }) as any,
        DEFAULT_EXPORT_CONFIG,
      ),
    ).toThrow(/Экспорт отменён/);
  });

  it('экспортирует лист удалённого плагина как есть', () => {
    // Плагин не установлен: JSON-экспорт должен работать, а не падать.
    const payload = buildCharacterExport(
      { systemId: 'gone', gameSystem: 'Unknown', name: 'X', notes: 'n' } as any,
      DEFAULT_EXPORT_CONFIG,
    );
    expect((payload.character as any).name).toBe('X');
    expect((payload.character as any).systemId).toBe('gone');

    // Импорт такого файла по-прежнему требует установленный плагин.
    const parsed = parseExportPayload(
      JSON.parse(JSON.stringify(payload)),
      date,
    );
    expect(parsed.ok).toBe(false);
  });

  it('бэкап со старым именем приложения импортируется', () => {
    // Имя приложения менялось, и бэкапы прошлых версий не должны из-за этого
    // перестать открываться: appName не входит в версию формата.
    // Редакция не важна: проверяется только конверт, поэтому берём первый
    // зарегистрированный плагин вместо литерала игры.
    const payload = buildBackupExport(
      [makeCharacter(generatedPlugins[0].manifest.id, { id: 'a' })],
      'petya',
      date,
    );
    const legacy = JSON.parse(JSON.stringify(payload));
    legacy.metadata.appName = 'DigitalCharsheets-qwen';

    const parsed = parseExportPayload(legacy, date);
    expect(parsed.ok).toBe(true);
  });

  it('файл чужого приложения отклоняется', () => {
    const payload = buildBackupExport(
      [makeCharacter(generatedPlugins[0].manifest.id, { id: 'a' })],
      'petya',
      date,
    );
    const foreign = JSON.parse(JSON.stringify(payload));
    foreign.metadata.appName = 'SomeOtherApp';

    const parsed = parseExportPayload(foreign, date);
    expect(parsed.ok).toBe(false);
    if (parsed.ok) return;
    expect(parsed.reason).toBe('foreign_app');
  });

  it('round-trip: build → parse возвращает тот же набор', () => {
    const payload = buildBackupExport(
      [makeCharacter('dnd5e', { id: 'a' })] as any,
      'petya',
      date,
    );
    const parsed = parseExportPayload(
      JSON.parse(JSON.stringify(payload)),
      date,
    );

    expect(parsed.ok).toBe(true);
    if (!parsed.ok) return;
    expect(parsed.kind).toBe('backup');
    expect(parsed.characters).toHaveLength(1);
    expect(parsed.metadata.account).toBe('petya');
    expect(parsed.warnings).toEqual([]);
  });
});
