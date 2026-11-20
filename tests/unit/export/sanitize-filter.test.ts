/**
 * sanitizeData и фильтрация секций: служебные поля вычищаются на любой
 * глубине, поля D&D и Dark Heresy попадают в экспорт по своим флагам.
 */

import fs from 'node:fs';

import { describe, expect, it } from 'vitest';
import * as XLSX from 'xlsx';

import {
  DEFAULT_EXPORT_CONFIG,
  filterCharacterForExport,
  sanitizeData,
} from '@/lib/export-utils';

import { hasPlugin, makeDhCharacter, makeDndCharacter } from '@tests/support';
import { allOff } from '@tests/support/export-fixtures';

// xlsx 0.20 в Node подхватывает fs только при CJS-загрузке; под vitest (ESM)
// детект не срабатывает, и writeFile/readFile уходят в браузерную ветку.
// Явно сообщаем библиотеке про node:fs — это нужно только тестам.
XLSX.set_fs(fs);

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

  // Сценарий 2-й редакции: без неё в сборке проверять нечего.
  it.runIf(hasPlugin('dh2'))(
    'не теряет поля DH v2: fatigue2nd, criticalConditions, customResources',
    () => {
      const dh = makeDhCharacter({
        systemId: 'dh2',
        edition: '2nd',
        fatigue1st: { current: 2, notes: 'beaten' },
        fatigue2nd: { current: 1, notes: '' },
        criticalConditions: [{ id: 'c1', name: 'Broken arm', notes: 'right' }],
        customResources: [
          { id: 'r1', description: 'Ammo', current: 3, max: 10 },
        ],
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
    },
  );

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
