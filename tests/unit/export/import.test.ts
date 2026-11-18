/**
 * importCharacterFromJSON: принимает только текущий конверт и бэкап, чистит
 * служебные поля, отклоняет старые и чужие форматы, не падает на битом JSON.
 */

import fs from 'node:fs';

import { describe, expect, it, vi } from 'vitest';
import * as XLSX from 'xlsx';

import {
  DEFAULT_EXPORT_CONFIG,
  EXPORT_APP_NAME,
  importCharacterFromJSON,
} from '@/lib/export-utils';

import { makeDhCharacter, makeDndCharacter } from '@tests/support';
import { fileOf, meta } from '@tests/support/export-fixtures';

// xlsx 0.20 в Node подхватывает fs только при CJS-загрузке; под vitest (ESM)
// детект не срабатывает, и writeFile/readFile уходят в браузерную ветку.
// Явно сообщаем библиотеке про node:fs — это нужно только тестам.
XLSX.set_fs(fs);

describe('importCharacterFromJSON (только формат dcs-export v2)', () => {
  it('принимает одиночный конверт и вычищает служебные поля', async () => {
    const result = await importCharacterFromJSON(
      fileOf({
        metadata: meta('character', { config: DEFAULT_EXPORT_CONFIG }),
        character: {
          ...makeDndCharacter(),
          userId: 'user-x',
          migratedFromUid: 'fb-1',
        },
      }),
    );

    expect(result.success).toBe(true);
    expect(result.kind).toBe('character');
    expect(result.data?.character.name).toBe('Ragnar Testborn');
    expect((result.data?.character as any).userId).toBeUndefined();
    expect((result.data?.character as any).migratedFromUid).toBeUndefined();
  });

  it('принимает бэкап нескольких персонажей', async () => {
    const result = await importCharacterFromJSON(
      fileOf({
        metadata: meta('backup', { account: 'petya' }),
        characters: [
          makeDndCharacter({ id: 'a' }),
          makeDhCharacter({ id: 'b' }),
        ],
      }),
    );

    expect(result.success).toBe(true);
    expect(result.kind).toBe('backup');
    expect(result.data).toBeUndefined();
    expect(result.batchData).toHaveLength(2);
    expect(result.batchData?.map((c) => c.id)).toEqual(['a', 'b']);
  });

  it('предупреждает, если characterCount не совпадает с файлом', async () => {
    const result = await importCharacterFromJSON(
      fileOf({
        metadata: meta('backup', { characterCount: 99 }),
        characters: [makeDndCharacter({ id: 'a' })],
      }),
    );

    expect(result.success).toBe(true);
    expect(result.warnings?.join(' ')).toContain('99');
  });

  it('отклоняет старый конверт без format (совместимость не поддерживаем)', async () => {
    const result = await importCharacterFromJSON(
      fileOf({
        metadata: {
          appName: EXPORT_APP_NAME,
          version: '1.0',
          exportDate: 'x',
          config: {},
        },
        character: makeDndCharacter(),
      }),
    );

    expect(result.success).toBe(false);
    expect(result.error).toMatch(/формат/i);
  });

  it('отклоняет старый бэкап-массив и голый лист', async () => {
    const array = await importCharacterFromJSON(fileOf([makeDndCharacter()]));
    expect(array.success).toBe(false);
    expect(array.error).toMatch(/формат/i);

    const bare = await importCharacterFromJSON(fileOf(makeDndCharacter()));
    expect(bare.success).toBe(false);
    expect(bare.error).toMatch(/формат/i);
  });

  it('отклоняет чужое приложение и чужую версию формата', async () => {
    const foreign = await importCharacterFromJSON(
      fileOf({
        metadata: { ...meta('character'), appName: 'OtherApp' },
        character: makeDndCharacter(),
      }),
    );
    expect(foreign.success).toBe(false);
    expect(foreign.error).toMatch(/другим приложением/i);

    const newer = await importCharacterFromJSON(
      fileOf({
        metadata: { ...meta('character'), version: '4.0' },
        character: makeDndCharacter(),
      }),
    );
    expect(newer.success).toBe(false);
    expect(newer.error).toMatch(/версия формата/i);
  });

  it('отклоняет пустой бэкап и лист без имени', async () => {
    const empty = await importCharacterFromJSON(
      fileOf({
        metadata: meta('backup', { characterCount: 0 }),
        characters: [],
      }),
    );
    expect(empty.success).toBe(false);
    expect(empty.error).toMatch(/не содержит/i);

    const nameless = await importCharacterFromJSON(
      fileOf({
        metadata: meta('character'),
        character: { gameSystem: 'Dungeons & Dragons', name: '  ' },
      }),
    );
    expect(nameless.success).toBe(false);
    expect(nameless.error).toMatch(/имя/i);
  });

  it('отклоняет битый JSON, не падая', async () => {
    const errorSpy = vi.spyOn(console, 'error').mockImplementation(() => {});
    const result = await importCharacterFromJSON(fileOf('{ not json at all'));
    errorSpy.mockRestore();

    expect(result.success).toBe(false);
    expect(result.error).toContain('parse');
  });
});
