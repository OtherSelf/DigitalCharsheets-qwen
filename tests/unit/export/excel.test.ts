/**
 * exportCharacterToExcel: настоящий .xlsx с техническим блоком, данными
 * листа, полями DH v2 и подписями на языке сайта.
 */

import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';

import { afterAll, describe, expect, it } from 'vitest';
import * as XLSX from 'xlsx';

import { EXPORT_APP_NAME, exportCharacterToExcel } from '@/lib/export-utils';
import { translations } from '@/lib/i18n';

import { hasPlugin, makeCharacter } from '@tests/support';

// xlsx 0.20 в Node подхватывает fs только при CJS-загрузке; под vitest (ESM)
// детект не срабатывает, и writeFile/readFile уходят в браузерную ветку.
// Явно сообщаем библиотеке про node:fs — это нужно только тестам.
XLSX.set_fs(fs);

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

  it('пишет dcs_character_<имя>_<дата>.xlsx с листом по имени персонажа', async () => {
    process.chdir(tmp);
    try {
      const result = await exportCharacterToExcel(
        makeCharacter('dnd5e', {
          id: 'dnd-1',
          name: 'Ragnar Testborn',
        }) as any,
        date,
      );

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

  it('внутри — стандартный технический блок и данные листа', async () => {
    process.chdir(tmp);
    try {
      const result = await exportCharacterToExcel(
        makeCharacter('dnd5e', {
          id: 'dnd-1',
          name: 'Ragnar Testborn',
        }) as any,
        date,
      );
      expect(result.success).toBe(true);
      const rows = readRows(result.filename!);

      expect(String(rows[0][0])).toContain('DIGITAL CHARACTER SHEETS');
      expect(row(rows, 'App')).toEqual(['App', EXPORT_APP_NAME]);
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
        'Dungeons & Dragons · 5th Edition',
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

  // Сценарий 2-й редакции: без неё в сборке проверять нечего.
  it.runIf(hasPlugin('dh2'))(
    'выгружает поля Dark Heresy v2: fatigue2nd, критические, ресурсы',
    async () => {
      process.chdir(tmp);
      try {
        const character = makeCharacter('dh1', {
          systemId: 'dh2',
          edition: '2nd',
          schemaVersion: 2,
          fatigue1st: { current: 2, notes: 'beaten' },
          fatigue2nd: { current: 1, notes: '' },
          criticalConditions: [{ id: 'c1', name: 'Broken arm', notes: '' }],
          customResources: [
            { id: 'r1', description: 'Ammo', current: 3, max: 10 },
          ],
        });
        const result = await exportCharacterToExcel(character as any, date);
        expect(result.success).toBe(true);

        const rows = readRows(result.filename!);
        // edition больше нет; fatigue1st ушла в notes миграции.
        expect(row(rows, 'Edition')).toBeUndefined();
        expect(row(rows, 'Fatigue (1st)')).toBeUndefined();
        expect(row(rows, 'Fatigue')?.[1]).toBe(1);
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
    },
  );

  it('подписи Excel переводятся на язык сайта', async () => {
    process.chdir(tmp);
    try {
      const result = await exportCharacterToExcel(
        makeCharacter('dnd5e', {
          id: 'dnd-1',
          name: 'Ragnar Testborn',
        }) as any,
        date,
        (key) => translations.ru[key] ?? key,
      );
      expect(result.success).toBe(true);
      const rows = readRows(result.filename!);
      const labels = rows.map((r) => String(r[0] ?? '').trim());
      expect(labels).toContain('ХАРАКТЕРИСТИКИ');
      expect(labels).toContain('Класс брони');
      expect(labels).toContain('Уровень');
      expect(labels).toContain('ИСТОРИЯ И ЗАМЕТКИ');
      expect(labels).not.toContain('Ability Scores');
    } finally {
      process.chdir(originalCwd);
    }
  });

  it('битый лист — ошибка, файл не создаётся', async () => {
    process.chdir(tmp);
    try {
      const before = fs
        .readdirSync(tmp)
        .filter((f) => f.endsWith('.xlsx')).length;
      const result = await exportCharacterToExcel(
        makeCharacter('dnd5e', { name: '' }) as any,
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
