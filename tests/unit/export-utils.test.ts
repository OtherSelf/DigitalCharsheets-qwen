import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { afterAll, describe, expect, it, vi } from 'vitest';

import {
  DEFAULT_EXPORT_CONFIG,
  exportCharacterToExcel,
  filterCharacterForExport,
  importCharacterFromJSON,
  mergeImportedData,
  sanitizeData,
} from '@/lib/export-utils';
import { makeDhCharacter, makeDndCharacter } from '../helpers';

const allOff = Object.fromEntries(
  Object.keys(DEFAULT_EXPORT_CONFIG).map((key) => [key, false]),
) as unknown as typeof DEFAULT_EXPORT_CONFIG;

const fileOf = (content: unknown, name = 'backup.json') =>
  new File([typeof content === 'string' ? content : JSON.stringify(content)], name, {
    type: 'application/json',
  });

describe('sanitizeData', () => {
  it('обрезает пробелы в строках и ключах, не трогает числа/булевы/null', () => {
    const input = { ' name ': '  Ragnar  ', level: 3, alive: true, notes: null, nested: { ' x ': ' y ' } };
    expect(sanitizeData(input)).toEqual({
      name: 'Ragnar',
      level: 3,
      alive: true,
      notes: null,
      nested: { x: 'y' },
    });
  });

  it('выкидывает служебные поля userId и "Document ID" на любой глубине', () => {
    const input = {
      userId: 'user-x',
      'Document ID': 'users/x/characterSheets/y',
      character: { userId: 'user-y', name: 'A', items: [{ userId: 'user-z', name: 'B' }] },
    };

    expect(sanitizeData(input)).toEqual({
      character: { name: 'A', items: [{ name: 'B' }] },
    });
  });

  it('работает с массивами и примитивами', () => {
    expect(sanitizeData([' a ', ' b '])).toEqual(['a', 'b']);
    expect(sanitizeData('  text ')).toBe('text');
    expect(sanitizeData(42)).toBe(42);
  });
});

describe('filterCharacterForExport', () => {
  it('при всех выключенных флагах оставляет только id и gameSystem', () => {
    const filtered = filterCharacterForExport(makeDndCharacter() as any, allOff);
    expect(filtered).toEqual({ id: 'dnd-1', gameSystem: 'Dungeons & Dragons' });
  });

  it('базовая информация, статы и боевые поля D&D попадают в экспорт', () => {
    const filtered = filterCharacterForExport(makeDndCharacter() as any, DEFAULT_EXPORT_CONFIG);

    expect(filtered.name).toBe('Ragnar Testborn');
    expect(filtered.characterClass).toBe('Fighter');
    expect((filtered as any).race).toBe('Human');
    expect(filtered.stats).toBeDefined();
    expect((filtered as any).hitPoints).toEqual({ current: 24, max: 28 });
    expect((filtered as any).armorClass).toBe(17);
    // Служебные поля не экспортируются
    expect((filtered as any).userId).toBeUndefined();
  });

  it('для Dark Heresy берёт поля своей системы', () => {
    const filtered = filterCharacterForExport(makeDhCharacter() as any, DEFAULT_EXPORT_CONFIG);

    expect(filtered.name).toBe('Acolyte Vex');
    expect((filtered as any).careerPath).toBe('Adept');
    expect((filtered as any).homeWorld).toBe('Hive World');
    expect((filtered as any).wounds).toEqual({ current: 10, max: 10, notes: '' });
    expect((filtered as any).race).toBeUndefined();
  });

  it('выключенные секции не попадают в результат', () => {
    const config = { ...DEFAULT_EXPORT_CONFIG, includeEquipment: false, includeNarrative: false };
    const filtered = filterCharacterForExport(makeDndCharacter({ backstory: 'secret' }) as any, config);

    expect((filtered as any).equipment).toBeUndefined();
    expect((filtered as any).backstory).toBeUndefined();
    expect(filtered.name).toBeDefined();
  });
});

describe('importCharacterFromJSON', () => {
  it('принимает нативный экспорт приложения (metadata.appName)', async () => {
    const exported = {
      metadata: {
        appName: 'DigitalCharsheets-qwen',
        version: '1.0',
        exportDate: new Date().toISOString(),
        config: DEFAULT_EXPORT_CONFIG,
      },
      character: { id: 'c1', gameSystem: 'Dungeons & Dragons', name: 'Ragnar', userId: 'user-x' },
    };

    const result = await importCharacterFromJSON(fileOf(exported));

    expect(result.success).toBe(true);
    expect(result.data?.character).toMatchObject({ id: 'c1', name: 'Ragnar' });
    // sanitizeData вырезал userId
    expect((result.data?.character as any).userId).toBeUndefined();
  });

  it('принимает одиночного «голого» персонажа и нормализует дефолты', async () => {
    const bare = { gameSystem: 'Dungeons & Dragons', name: 'Solo' };
    const result = await importCharacterFromJSON(fileOf(bare));

    expect(result.success).toBe(true);
    expect(result.batchData).toHaveLength(1);
    expect(result.batchData?.[0].name).toBe('Solo');
    // normalizeCharacter подставил статы и хиты
    expect((result.batchData?.[0] as any).stats).toEqual({
      strength: 10,
      dexterity: 10,
      constitution: 10,
      intelligence: 10,
      wisdom: 10,
      charisma: 10,
    });
    expect((result.batchData?.[0] as any).hitPoints).toEqual({ current: 0, max: 0 });
  });

  it('принимает массив персонажей как пакетный бэкап', async () => {
    const result = await importCharacterFromJSON(
      fileOf([makeDndCharacter({ id: 'a' }), makeDhCharacter({ id: 'b' })]),
    );

    expect(result.success).toBe(true);
    expect(result.batchData).toHaveLength(2);
    expect(result.batchData?.map((c) => c.id)).toEqual(['a', 'b']);
  });

  it('отклоняет JSON без gameSystem', async () => {
    const result = await importCharacterFromJSON(fileOf({ hello: 'world' }));
    expect(result.success).toBe(false);
    expect(result.error).toContain('gameSystem');
  });

  it('отклоняет пустой массив', async () => {
    const result = await importCharacterFromJSON(fileOf([]));
    expect(result.success).toBe(false);
    expect(result.error).toContain('empty');
  });

  it('отклоняет битый JSON, не падая', async () => {
    const errorSpy = vi.spyOn(console, 'error').mockImplementation(() => {});
    const result = await importCharacterFromJSON(fileOf('{ not json at all'));
    errorSpy.mockRestore();

    expect(result.success).toBe(false);
    expect(result.error).toContain('parse');
  });
});

describe('mergeImportedData', () => {
  it('перезаписывает поля по включённым секциям', () => {
    const target = makeDndCharacter({ name: 'Old Name', level: 1 }) as any;
    const imported = {
      metadata: {
        appName: 'DigitalCharsheets-qwen',
        version: '1.0',
        exportDate: '',
        config: DEFAULT_EXPORT_CONFIG,
      },
      character: { name: 'New Name', level: 5, stats: { ...target.stats, strength: 20 } },
    };

    const merged = mergeImportedData(target, imported as any, DEFAULT_EXPORT_CONFIG);

    expect(merged.name).toBe('New Name');
    expect((merged as any).level).toBe(5);
    expect((merged as any).stats.strength).toBe(20);
  });

  it('не трогает выключенные секции', () => {
    const target = makeDndCharacter({ name: 'Keep Me', level: 1, backstory: 'original' }) as any;
    const imported = {
      metadata: {
        appName: 'DigitalCharsheets-qwen',
        version: '1.0',
        exportDate: '',
        config: DEFAULT_EXPORT_CONFIG,
      },
      character: { name: 'Imported', level: 9, backstory: 'imported story' },
    };
    const config = { ...DEFAULT_EXPORT_CONFIG, includeProgression: false, includeNarrative: false };

    const merged = mergeImportedData(target, imported as any, config);

    expect(merged.name).toBe('Imported');
    expect((merged as any).level).toBe(1);
    expect((merged as any).backstory).toBe('original');
  });

  it('мержит вложенные объекты (хиты) вместо замены целиком', () => {
    const target = makeDndCharacter({ hitPoints: { current: 10, max: 20 } }) as any;
    const imported = {
      metadata: {
        appName: 'DigitalCharsheets-qwen',
        version: '1.0',
        exportDate: '',
        config: DEFAULT_EXPORT_CONFIG,
      },
      character: { hitPoints: { current: 5 } },
    };

    const merged = mergeImportedData(target, imported as any, DEFAULT_EXPORT_CONFIG);

    expect((merged as any).hitPoints).toEqual({ current: 5, max: 20 });
  });
});

describe('exportCharacterToExcel', () => {
  const tmp = fs.mkdtempSync(path.join(os.tmpdir(), 'dcs-xlsx-'));
  const originalCwd = process.cwd();

  afterAll(() => {
    process.chdir(originalCwd);
    fs.rmSync(tmp, { recursive: true, force: true });
  });

  it('пишет .xlsx без падений и с непустым содержимым', () => {
    process.chdir(tmp);
    try {
      exportCharacterToExcel(makeDndCharacter() as any);

      const files = fs.readdirSync(tmp).filter((f) => f.endsWith('.xlsx'));
      expect(files).toHaveLength(1);
      expect(files[0]).toBe('Ragnar_Testborn_Complete_Character_Sheet.xlsx');
      expect(fs.statSync(path.join(tmp, files[0])).size).toBeGreaterThan(1000);
    } finally {
      process.chdir(originalCwd);
    }
  });
});
