import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';

import { afterAll, describe, expect, it, vi } from 'vitest';
import * as XLSX from 'xlsx';

import {
  buildBackupExport,
  buildCharacterExport,
  DEFAULT_EXPORT_CONFIG,
  EXPORT_APP_NAME,
  EXPORT_FORMAT,
  EXPORT_FORMAT_VERSION,
  exportCharacterToExcel,
  exportFileName,
  filterCharacterForExport,
  importCharacterFromJSON,
  mergeImportedData,
  parseExportPayload,
  sanitizeData,
} from '@/lib/export-utils';

import { makeDhCharacter, makeDndCharacter } from './helpers';

// xlsx 0.20 в Node подхватывает fs только при CJS-загрузке; под vitest (ESM)
// детект не срабатывает, и writeFile/readFile уходят в браузерную ветку.
// Явно сообщаем библиотеке про node:fs — это нужно только тестам.
XLSX.set_fs(fs);

/**
 * Экспорт и импорт листов (src/lib/export-utils.ts).
 *
 * Покрыто: sanitizeData, фильтрация секций для D&D и DH, импорт нативного бэкапа
 * и «голого» JSON, слияние при импорте, сборка настоящего .xlsx.
 */

const allOff = Object.fromEntries(
  Object.keys(DEFAULT_EXPORT_CONFIG).map((key) => [key, false]),
) as unknown as typeof DEFAULT_EXPORT_CONFIG;

const fileOf = (content: unknown, name = 'backup.json') =>
  new File(
    [typeof content === 'string' ? content : JSON.stringify(content)],
    name,
    {
      type: 'application/json',
    },
  );

describe('sanitizeData', () => {
  it('обрезает пробелы в строках и ключах, не трогает числа/булевы/null', () => {
    const input = {
      ' name ': '  Ragnar  ',
      level: 3,
      alive: true,
      notes: null,
      nested: { ' x ': ' y ' },
    };
    expect(sanitizeData(input)).toEqual({
      name: 'Ragnar',
      level: 3,
      alive: true,
      notes: null,
      nested: { x: 'y' },
    });
  });

  it('выкидывает служебные поля (userId, провенанс миграции, Firestore) на любой глубине', () => {
    const input = {
      userId: 'user-x',
      'Document ID': 'users/x/characterSheets/y',
      migratedFrom: 'firestore',
      migratedAt: '2026-11-08T19:42:47Z',
      migratedFromUid: '0bopfOtu5uV3zeC1I3rzLygaU5f1',
      originalFirebaseId: 'fb-1',
      _key: 'old',
      __page: 'p',
      __seq: 3,
      character: {
        userId: 'user-y',
        name: 'A',
        items: [{ userId: 'user-z', name: 'B' }],
      },
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
    const filtered = filterCharacterForExport(
      makeDndCharacter() as any,
      allOff,
    );
    expect(filtered).toEqual({
      id: 'dnd-1',
      gameSystem: 'Dungeons & Dragons',
      systemId: 'dnd5e',
      schemaVersion: 2,
    });
  });

  it('базовая информация, статы и боевые поля D&D попадают в экспорт', () => {
    const filtered = filterCharacterForExport(
      makeDndCharacter() as any,
      DEFAULT_EXPORT_CONFIG,
    );

    expect(filtered.name).toBe('Ragnar Testborn');
    expect(filtered.characterClass).toBe('Fighter');
    expect((filtered as any).race).toBe('Human');
    expect(filtered.stats).toBeDefined();
    expect((filtered as any).hitPoints).toEqual({ current: 24, max: 28 });
    expect((filtered as any).armorClass).toBe(17);
    // Бонус мастерства — часть профиля, не теряется при переносе.
    expect((filtered as any).proficiencyBonus).toBe(2);
    // Служебные поля не экспортируются
    expect((filtered as any).userId).toBeUndefined();
  });

  it('для Dark Heresy берёт поля своей системы', () => {
    const filtered = filterCharacterForExport(
      makeDhCharacter() as any,
      DEFAULT_EXPORT_CONFIG,
    );

    expect(filtered.name).toBe('Acolyte Vex');
    expect((filtered as any).careerPath).toBe('Adept');
    expect((filtered as any).homeWorld).toBe('Hive World');
    expect((filtered as any).wounds).toEqual({
      current: 10,
      max: 10,
      notes: '',
    });
    expect((filtered as any).race).toBeUndefined();
  });

  it('не теряет поля DH v2: fatigue2nd, criticalConditions, customResources', () => {
    const dh = makeDhCharacter({
      edition: '2nd',
      fatigue1st: { current: 2, notes: 'beaten' },
      fatigue2nd: { current: 1, notes: '' },
      criticalConditions: [{ id: 'c1', name: 'Broken arm', notes: 'right' }],
      customResources: [{ id: 'r1', description: 'Ammo', current: 3, max: 10 }],
    });
    const filtered = filterCharacterForExport(
      dh as any,
      DEFAULT_EXPORT_CONFIG,
    ) as any;

    expect(filtered.systemId).toBe('dh2');
    expect(filtered.edition).toBeUndefined();
    expect(filtered.fatigue1st).toBeUndefined();
    expect(filtered.fatigue2nd).toEqual({ current: 1, notes: '' });
    // Значимая fatigue1st не потеряна — ушла в notes миграции.
    expect(String(filtered.notes)).toContain('[migration v2]');
    expect(filtered.criticalConditions).toHaveLength(1);
    expect(filtered.criticalConditions[0].name).toBe('Broken arm');
    expect(filtered.customResources).toHaveLength(1);
    expect(filtered.customResources[0].description).toBe('Ammo');
  });

  it('выключенные секции не попадают в результат', () => {
    const config = {
      ...DEFAULT_EXPORT_CONFIG,
      includeEquipment: false,
      includeNarrative: false,
    };
    const filtered = filterCharacterForExport(
      makeDndCharacter({ backstory: 'secret' }) as any,
      config,
    );

    expect((filtered as any).equipment).toBeUndefined();
    expect((filtered as any).backstory).toBeUndefined();
    expect(filtered.name).toBeDefined();
  });
});

const meta = (
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
      makeDndCharacter() as any,
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
      [makeDndCharacter({ id: 'a' }), makeDhCharacter({ id: 'b' })] as any,
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

  it('build отказывается экспортировать лист без имени/системы', () => {
    expect(() =>
      buildCharacterExport(
        makeDndCharacter({ name: '' }) as any,
        DEFAULT_EXPORT_CONFIG,
      ),
    ).toThrow(/Экспорт отменён/);
    expect(() =>
      buildCharacterExport(
        { gameSystem: 'Unknown', name: 'X' } as any,
        DEFAULT_EXPORT_CONFIG,
      ),
    ).toThrow(/игровая система/);
  });

  it('round-trip: build → parse возвращает тот же набор', () => {
    const payload = buildBackupExport(
      [makeDndCharacter({ id: 'a' })] as any,
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
    const target = makeDndCharacter({
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

  it('восстанавливает при импорте поля DH v2: fatigue2nd, критические, ресурсы', () => {
    const target = makeDhCharacter({ edition: '2nd' }) as any;
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
  });

  it('не подмешивает fatigue2nd в dh1', () => {
    const target = makeDhCharacter() as any;
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
    const target = makeDndCharacter({
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

describe('exportCharacterToExcel (xlsx)', () => {
  const tmp = fs.mkdtempSync(path.join(os.tmpdir(), 'dcs-xlsx-'));
  const originalCwd = process.cwd();
  const date = new Date('2026-11-08T12:00:00.000Z');

  afterAll(() => {
    process.chdir(originalCwd);
    fs.rmSync(tmp, { recursive: true, force: true });
  });

  const readRows = (filename: string): any[][] => {
    const workbook = XLSX.readFile(path.join(tmp, filename));
    const sheet = workbook.Sheets[workbook.SheetNames[0]];
    return XLSX.utils.sheet_to_json(sheet, { header: 1 }) as any[][];
  };

  const row = (rows: any[][], label: string) =>
    rows.find((r) => String(r[0] ?? '').trim() === label);

  it('пишет dcs_character_<имя>_<дата>.xlsx с листом по имени персонажа', () => {
    process.chdir(tmp);
    try {
      const result = exportCharacterToExcel(makeDndCharacter() as any, date);

      expect(result.success).toBe(true);
      expect(result.filename).toBe(
        'dcs_character_Ragnar_Testborn_2026-11-08.xlsx',
      );
      const file = path.join(tmp, result.filename!);
      expect(fs.existsSync(file)).toBe(true);
      expect(fs.statSync(file).size).toBeGreaterThan(1000);

      const workbook = XLSX.readFile(file);
      expect(workbook.SheetNames).toEqual(['Ragnar Testborn']);
    } finally {
      process.chdir(originalCwd);
    }
  });

  it('внутри — стандартный технический блок и данные листа', () => {
    process.chdir(tmp);
    try {
      const result = exportCharacterToExcel(makeDndCharacter() as any, date);
      expect(result.success).toBe(true);
      const rows = readRows(result.filename!);

      expect(String(rows[0][0])).toContain('DIGITAL CHARACTER SHEETS');
      expect(row(rows, 'App')).toEqual(['App', 'DigitalCharsheets-qwen']);
      expect(row(rows, 'Format')).toEqual(['Format', 'dcs-export']);
      expect(row(rows, 'Format version')).toEqual(['Format version', '3.0']);
      expect(row(rows, 'Kind')).toEqual(['Kind', 'character']);
      expect(row(rows, 'Export date')).toEqual([
        'Export date',
        date.toISOString(),
      ]);
      expect(row(rows, 'Character')).toEqual(['Character', 'Ragnar Testborn']);
      expect(row(rows, 'Game system')).toEqual([
        'Game system',
        'Dungeons & Dragons',
      ]);
      expect(row(rows, 'Character ID')).toEqual(['Character ID', 'dnd-1']);

      // Человекочитаемые секции остались на месте.
      const labels = rows.map((r) => String(r[0] ?? '').trim());
      expect(labels).toContain('Armor Class');
      expect(labels).toContain('Strength');
    } finally {
      process.chdir(originalCwd);
    }
  });

  it('выгружает поля Dark Heresy v2: fatigue2nd, критические, ресурсы', () => {
    process.chdir(tmp);
    try {
      const character = makeDhCharacter({
        edition: '2nd',
        fatigue1st: { current: 2, notes: 'beaten' },
        fatigue2nd: { current: 1, notes: '' },
        criticalConditions: [{ id: 'c1', name: 'Broken arm', notes: '' }],
        customResources: [
          { id: 'r1', description: 'Ammo', current: 3, max: 10 },
        ],
      });
      const result = exportCharacterToExcel(character as any, date);
      expect(result.success).toBe(true);

      const rows = readRows(result.filename!);
      // edition больше нет; fatigue1st ушла в notes миграции.
      expect(row(rows, 'Edition')).toBeUndefined();
      expect(row(rows, 'Fatigue (1st)')).toBeUndefined();
      expect(row(rows, 'Fatigue (2nd)')?.[1]).toBe(1);
      // Несколько строк с подписью Notes: миграционная — та, где текст.
      const migrationNote = rows.find(
        (r) =>
          String(r[0] ?? '').trim() === 'Notes' &&
          String(r[1] ?? '').includes('[migration v2]'),
      );
      expect(migrationNote).toBeDefined();
      expect(String(row(rows, 'Critical Conditions')?.[1] ?? '')).toContain(
        'Broken arm',
      );
      expect(String(row(rows, 'Custom Resources')?.[1] ?? '')).toContain(
        'Ammo: 3/10',
      );
    } finally {
      process.chdir(originalCwd);
    }
  });

  it('битый лист — ошибка, файл не создаётся', () => {
    process.chdir(tmp);
    try {
      const before = fs
        .readdirSync(tmp)
        .filter((f) => f.endsWith('.xlsx')).length;
      const result = exportCharacterToExcel(
        makeDndCharacter({ name: '' }) as any,
        date,
      );

      expect(result.success).toBe(false);
      expect(result.error).toMatch(/Экспорт отменён/);
      const after = fs
        .readdirSync(tmp)
        .filter((f) => f.endsWith('.xlsx')).length;
      expect(after).toBe(before);
    } finally {
      process.chdir(originalCwd);
    }
  });
});
