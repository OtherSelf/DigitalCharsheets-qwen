/**
 * mergeImportedData: перезаписывает только включённые секции, мержит
 * вложенные объекты и восстанавливает поля DH v2 при импорте.
 */

import fs from 'node:fs';

import { describe, expect, it } from 'vitest';
import * as XLSX from 'xlsx';

import { DEFAULT_EXPORT_CONFIG, mergeImportedData } from '@/lib/export-utils';

import { hasPlugin, makeCharacter } from '@tests/support';

// xlsx 0.20 в Node подхватывает fs только при CJS-загрузке; под vitest (ESM)
// детект не срабатывает, и writeFile/readFile уходят в браузерную ветку.
// Явно сообщаем библиотеке про node:fs — это нужно только тестам.
XLSX.set_fs(fs);

describe('mergeImportedData', () => {
  it('перезаписывает поля по включённым секциям', () => {
    const target = makeCharacter('dnd5e', {
      name: 'Old Name',
      level: 1,
    }) as any;
    const imported = {
      metadata: {
        appName: 'DigitalCharsheets-qwen',
        version: '1.0',
        exportDate: '',
        config: DEFAULT_EXPORT_CONFIG,
      },
      character: {
        name: 'New Name',
        level: 5,
        stats: { ...target.stats, strength: 20 },
      },
    };

    const merged = mergeImportedData(
      target,
      imported as any,
      DEFAULT_EXPORT_CONFIG,
    );

    expect(merged.name).toBe('New Name');
    expect((merged as any).level).toBe(5);
    expect((merged as any).stats.strength).toBe(20);
  });

  it('не трогает выключенные секции', () => {
    const target = makeCharacter('dnd5e', {
      name: 'Keep Me',
      level: 1,
      backstory: 'original',
    }) as any;
    const imported = {
      metadata: {
        appName: 'DigitalCharsheets-qwen',
        version: '1.0',
        exportDate: '',
        config: DEFAULT_EXPORT_CONFIG,
      },
      character: { name: 'Imported', level: 9, backstory: 'imported story' },
    };
    const config = {
      ...DEFAULT_EXPORT_CONFIG,
      includeProgression: false,
      includeNarrative: false,
    };

    const merged = mergeImportedData(target, imported as any, config);

    expect(merged.name).toBe('Imported');
    expect((merged as any).level).toBe(1);
    expect((merged as any).backstory).toBe('original');
  });

  // Сценарий 2-й редакции: без неё в сборке проверять нечего.
  it.runIf(hasPlugin('dh2'))(
    'восстанавливает при импорте поля DH v2: fatigue2nd, критические, ресурсы',
    () => {
      const target = makeCharacter('dh1', {
        systemId: 'dh2',
        edition: '2nd',
      }) as any;
      const imported = {
        metadata: {
          appName: 'DigitalCharsheets-qwen',
          version: '3.0',
          exportDate: '',
          kind: 'character',
          config: DEFAULT_EXPORT_CONFIG,
        },
        character: {
          systemId: 'dh2',
          gameSystem: 'Dark Heresy',
          schemaVersion: 2,
          fatigue1st: { current: 4 },
          fatigue2nd: { current: 2 },
          criticalConditions: [{ id: 'c9', name: 'Concussion' }],
          customResources: [
            { id: 'r9', description: 'Grenades', current: 1, max: 3 },
          ],
        },
      };

      const merged = mergeImportedData(
        target,
        imported as any,
        DEFAULT_EXPORT_CONFIG,
      ) as any;

      expect(merged.systemId).toBe('dh2');
      expect(merged.edition).toBeUndefined();
      expect(merged.fatigue2nd.current).toBe(2);
      expect(merged.fatigue1st).toBeUndefined();
      expect(merged.criticalConditions[0].name).toBe('Concussion');
      expect(merged.customResources[0].description).toBe('Grenades');
    },
  );

  it('не подмешивает fatigue2nd в dh1', () => {
    const target = makeCharacter('dh1') as any;
    const imported = {
      metadata: { appName: 'DigitalCharsheets-qwen', version: '3.0' },
      character: {
        systemId: 'dh1',
        gameSystem: 'Dark Heresy',
        schemaVersion: 2,
        fatigue2nd: { current: 9 },
      },
    };

    const merged = mergeImportedData(
      target,
      imported as any,
      DEFAULT_EXPORT_CONFIG,
    ) as any;

    expect(merged.systemId).toBe('dh1');
    expect(merged.fatigue2nd).toBeUndefined();
  });

  it('мержит вложенные объекты (хиты) вместо замены целиком', () => {
    const target = makeCharacter('dnd5e', {
      hitPoints: { current: 10, max: 20 },
    }) as any;
    const imported = {
      metadata: {
        appName: 'DigitalCharsheets-qwen',
        version: '1.0',
        exportDate: '',
        config: DEFAULT_EXPORT_CONFIG,
      },
      character: { hitPoints: { current: 5 } },
    };

    const merged = mergeImportedData(
      target,
      imported as any,
      DEFAULT_EXPORT_CONFIG,
    );

    expect((merged as any).hitPoints).toEqual({ current: 5, max: 20 });
  });
});
