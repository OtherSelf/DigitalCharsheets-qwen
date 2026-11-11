// src/lib/export-utils.ts

'use client';

import * as XLSX from 'xlsx';

import {
  getCharacterModule,
  resolveCharacterSystemId,
} from '@/games/character-system';
import type { GameExportConfig } from '@/games/types';

import { isNonPortableField, toPortableCharacter } from './character-portable';
import { normalizeCharacterRecord } from './character-version';
import { DIVINATION_BY_ID } from './dark-heresy-data';
import type { LegacyDarkHeresyExport } from './legacy-dh-export';
import { Character, DnD5eCharacter } from './types';

/** Конфиг секций экспорта; тип живёт в контракте модулей. */
export type ExportConfig = GameExportConfig;

export const DEFAULT_EXPORT_CONFIG: ExportConfig = {
  includeBasicInfo: true,
  includeStats: true,
  includeCombat: true,
  includeEquipment: true,
  includeInventory: true,
  includeSpells: true,
  includeNarrative: true,
  includeProgression: true,
  includeCompanions: true,
  includeQuestLog: true,
  includeCustomHouseRules: true,
};

/**
 * ─── LANDMARK: EXPORT FORMAT ────────────────────────────────────────────────
 * Единый конверт для одиночного листа и полного бэкапа:
 *
 *   {
 *     "metadata": {
 *       "appName": "DigitalCharsheets-qwen",
 *       "format": "dcs-export",
 *       "version": "3.0",              // версия ФОРМАТА, не приложения
 *       "kind": "character" | "backup",
 *       "exportDate": "2026-11-08T…Z",
 *       "characterCount": 1,
 *       "account": "petya",            // только для backup
 *       "config": { … }                // только для character (секции)
 *     },
 *     "character": { … }               // kind=character
 *     "characters": [ … ]              // kind=backup
 *   }
 *
 * Экспорт всегда пишет 3.0: в персонаже `systemId` (`dnd5e`/`dh1`/`dh2`) и
 * `schemaVersion: 2`. Импорт принимает 3.0 нативно, а 2.0/2.1 — с миграцией
 * листа по правилам v2 (📌 D9). Старые файлы (просто массив листов, голый
 * лист, конверт v1 без format/kind) импорт намеренно не принимает — при
 * попытке будет понятная ошибка «переэкспортируйте файл».
 */
export const EXPORT_APP_NAME = 'DigitalCharsheets-qwen';
export const EXPORT_FORMAT = 'dcs-export';
export const EXPORT_FORMAT_VERSION = '3.0';
const EXPORT_FORMAT_MAJOR = 3;
/** Версии, которые импорт умеет мигрировать (в старом конверте). */
const LEGACY_EXPORT_MAJORS = [2];

export type ExportKind = 'character' | 'backup';

export interface ExportMetadata {
  appName: typeof EXPORT_APP_NAME;
  format: typeof EXPORT_FORMAT;
  version: string;
  kind: ExportKind;
  exportDate: string;
  characterCount: number;
  config?: ExportConfig;
  account?: string;
}

export interface ExportData {
  metadata: ExportMetadata;
  character: Partial<Character>;
}

export interface BackupExport {
  metadata: ExportMetadata;
  characters: Partial<Character>[];
}

export type StandardExport = ExportData | BackupExport;

export const sanitizeData = (data: any): any => {
  if (Array.isArray(data)) {
    return data.map(sanitizeData);
  }
  if (data !== null && typeof data === 'object') {
    const sanitizedObj: any = {};
    for (const [key, value] of Object.entries(data)) {
      const cleanKey = key.trim();
      // userId, провенанс миграции, старые Firestore-поля и служебные
      // маркеры записи не переносятся (см. character-portable.ts).
      if (isNonPortableField(cleanKey)) continue;
      sanitizedObj[cleanKey] = sanitizeData(value);
    }
    return sanitizedObj;
  }
  if (typeof data === 'string') {
    return data.trim();
  }
  return data;
};

const normalizeCharacter = (char: any): any => {
  if (char.gameSystem === 'Dark Heresy') {
    return {
      ...char,
      stats: char.stats || {
        weaponSkill: 0,
        ballisticSkill: 0,
        strength: 0,
        toughness: 0,
        agility: 0,
        intelligence: 0,
        perception: 0,
        willpower: 0,
        fellowship: 0,
        influence: 0,
      },
      statUpgrades: char.statUpgrades || {
        weaponSkill: [false, false, false, false],
        ballisticSkill: [false, false, false, false],
        strength: [false, false, false, false],
        toughness: [false, false, false, false],
        agility: [false, false, false, false],
        intelligence: [false, false, false, false],
        perception: [false, false, false, false],
        willpower: [false, false, false, false],
        fellowship: [false, false, false, false],
        influence: [false, false, false, false],
      },
      movement: char.movement || {
        walkHalf: 0,
        walkFull: 0,
        charge: 0,
        run: 0,
      },
      wounds: char.wounds || { current: 0, max: 0, notes: '' },
      fatePoints: char.fatePoints || { current: 0, max: 0, notes: '' },
      insanityPoints: char.insanityPoints || { total: 0, notes: '' },
      corruptionPoints: char.corruptionPoints || { total: 0, notes: '' },
      wealth: char.wealth || { throneGelt: 0, monthlyIncome: 0, notes: '' },
      equipment: char.equipment || {
        armor: {
          Head: null,
          Body: null,
          'Left arm': null,
          'Right arm': null,
          'Left leg': null,
          'Right leg': null,
        },
        weapons: { melee: [], ranged: [] },
      },
      skills: char.skills || [],
      talents: char.talents || [],
    };
  }

  if (char.gameSystem === 'Dungeons & Dragons') {
    return {
      ...char,
      stats: char.stats || {
        strength: 10,
        dexterity: 10,
        constitution: 10,
        intelligence: 10,
        wisdom: 10,
        charisma: 10,
      },
      savingThrows: char.savingThrows || [],
      skills: char.skills || [],
      hitPoints: char.hitPoints || { current: 0, max: 0 },
      deathSaves: char.deathSaves || { successes: 0, failures: 0 },
      currency: char.currency || { cp: 0, sp: 0, gp: 0, pp: 0, ep: 0 },
      equipment: char.equipment || [],
      inventory: char.inventory || [],
      spells: char.spells || [],
      spellSlots: char.spellSlots || {},
    };
  }

  return char;
};

const SUPPORTED_EXPORT_SYSTEMS = ['Dungeons & Dragons', 'Dark Heresy'] as const;
const SUPPORTED_SYSTEM_IDS = ['dnd5e', 'dh1', 'dh2'] as const;

function validateCharacterPayload(character: any, index: number): string[] {
  const label = `Персонаж #${index + 1}`;
  if (!character || typeof character !== 'object' || Array.isArray(character)) {
    return [`${label}: ожидался объект.`];
  }
  const errors: string[] = [];
  const knownSystem =
    SUPPORTED_SYSTEM_IDS.includes(character.systemId) ||
    SUPPORTED_EXPORT_SYSTEMS.includes(character.gameSystem);
  if (!knownSystem) {
    errors.push(
      `${label}: неизвестная игровая система ${JSON.stringify(
        character.systemId ?? character.gameSystem,
      )}.`,
    );
  }
  if (typeof character.name !== 'string' || !character.name.trim()) {
    errors.push(`${label}: пустое имя (name).`);
  }
  if (character.id !== undefined && typeof character.id !== 'string') {
    errors.push(`${label}: id должен быть строкой.`);
  }
  return errors;
}

function normalizeExportConfig(raw: unknown): ExportConfig {
  const config = { ...DEFAULT_EXPORT_CONFIG };
  if (!raw || typeof raw !== 'object' || Array.isArray(raw)) return config;
  for (const key of Object.keys(
    DEFAULT_EXPORT_CONFIG,
  ) as (keyof ExportConfig)[]) {
    if (typeof (raw as any)[key] === 'boolean') config[key] = (raw as any)[key];
  }
  return config;
}

function assertExportable(characters: any[]): void {
  const errors = characters.flatMap((character, index) =>
    validateCharacterPayload(character, index),
  );
  if (errors.length > 0) {
    throw new Error(`Экспорт отменён: ${errors.join(' ')}`);
  }
}

/** Часть имени файла без символов, недопустимых в ФС; пробелы → `_`. */
export function sanitizeFilenamePart(
  value: string,
  fallback = 'character',
): string {
  const cleaned = String(value ?? '')
    .normalize('NFC')
    .replace(/[\\/:*?"<>|\u0000-\u001f]/g, '')
    .trim()
    .replace(/\s+/g, '_')
    .replace(/_+/g, '_')
    .replace(/^[._]+|[._]+$/g, '');
  const safe = (cleaned || fallback).slice(0, 80).replace(/[._]+$/g, '');
  return safe || fallback;
}

/**
 * Имена файлов:
 *   dcs_character_<имя>_<YYYY-MM-DD>.json
 *   dcs_characters_all_<логин>_<YYYY-MM-DD>.json
 */
export function exportFileName(
  kind: ExportKind,
  options: {
    name?: string;
    login?: string;
    date?: Date;
    extension?: 'json' | 'xlsx';
  } = {},
): string {
  const date = (options.date ?? new Date()).toISOString().slice(0, 10);
  const extension = options.extension ?? 'json';
  if (kind === 'character') {
    return `dcs_character_${sanitizeFilenamePart(options.name || '', 'character')}_${date}.${extension}`;
  }
  return `dcs_characters_all_${sanitizeFilenamePart(options.login || '', 'account')}_${date}.${extension}`;
}

export function buildCharacterExport(
  character: Character,
  config: ExportConfig,
  now = new Date(),
): ExportData {
  const normalized = normalizeCharacterRecord(
    character as unknown as Record<string, unknown>,
  ).character;
  const portable = toPortableCharacter(
    normalized as unknown as Record<string, unknown>,
  ) as unknown as Character;
  assertExportable([portable]);
  return {
    metadata: {
      appName: EXPORT_APP_NAME,
      format: EXPORT_FORMAT,
      version: EXPORT_FORMAT_VERSION,
      kind: 'character',
      exportDate: now.toISOString(),
      characterCount: 1,
      config,
    },
    character: filterCharacterForExport(portable, config),
  };
}

export function buildBackupExport(
  characters: Character[],
  account?: string,
  now = new Date(),
): BackupExport {
  const portable = characters.map(
    (character) =>
      toPortableCharacter(
        normalizeCharacterRecord(
          character as unknown as Record<string, unknown>,
        ).character as unknown as Record<string, unknown>,
      ) as unknown as Character,
  );
  assertExportable(portable);
  return {
    metadata: {
      appName: EXPORT_APP_NAME,
      format: EXPORT_FORMAT,
      version: EXPORT_FORMAT_VERSION,
      kind: 'backup',
      exportDate: now.toISOString(),
      characterCount: portable.length,
      ...(account ? { account } : {}),
    },
    characters: portable as unknown as Partial<Character>[],
  };
}

export type ParseExportResult =
  | {
      ok: true;
      kind: ExportKind;
      metadata: ExportMetadata;
      characters: Partial<Character>[];
      warnings: string[];
    }
  | { ok: false; error: string };

/**
 * Разобрать и проверить файл экспорта. Принимает только новый формат:
 * metadata (format/appName/version/kind) + character | characters.
 * Всё остальное — ошибка с подсказкой, без «угадывания» старого формата.
 */
export function parseExportPayload(
  raw: unknown,
  now = new Date(),
): ParseExportResult {
  const data = sanitizeData(raw);
  if (!data || typeof data !== 'object' || Array.isArray(data)) {
    return {
      ok: false,
      error:
        'Неизвестный формат: ожидался объект экспорта DigitalCharsheets (metadata + character/characters).',
    };
  }

  const obj = data as Record<string, any>;
  const metadata = obj.metadata;
  if (!metadata || typeof metadata !== 'object' || Array.isArray(metadata)) {
    return {
      ok: false,
      error:
        'Неизвестный формат: нет metadata. Переэкспортируйте файл текущей версией приложения.',
    };
  }
  if (metadata.format !== EXPORT_FORMAT) {
    return {
      ok: false,
      error: `Неизвестный формат${metadata.format ? ` «${metadata.format}»` : ''}: поддерживается только ${EXPORT_FORMAT} v${EXPORT_FORMAT_MAJOR}.`,
    };
  }
  if (metadata.appName !== EXPORT_APP_NAME) {
    return {
      ok: false,
      error: `Файл создан другим приложением (${metadata.appName || 'неизвестно'}), импорт отменён.`,
    };
  }

  const version = String(metadata.version ?? '');
  const major = Number.parseInt(version.split('.')[0], 10);
  if (!version || !Number.isFinite(major)) {
    return { ok: false, error: 'В metadata не указана версия формата.' };
  }
  const supported =
    major === EXPORT_FORMAT_MAJOR || LEGACY_EXPORT_MAJORS.includes(major);
  if (!supported) {
    return {
      ok: false,
      error: `Неподдерживаемая версия формата ${version}: поддерживаются 2.0/2.1 (с миграцией) и ${EXPORT_FORMAT_MAJOR}.x.`,
    };
  }

  const kind = metadata.kind;
  if (kind !== 'character' && kind !== 'backup') {
    return {
      ok: false,
      error: 'В metadata не указан тип экспорта (kind: character | backup).',
    };
  }

  let rawCharacters: any[];
  if (kind === 'character') {
    if (
      !obj.character ||
      typeof obj.character !== 'object' ||
      Array.isArray(obj.character)
    ) {
      return {
        ok: false,
        error: 'Экспорт помечен как character, но поля character нет.',
      };
    }
    rawCharacters = [obj.character];
  } else {
    if (!Array.isArray(obj.characters)) {
      return {
        ok: false,
        error: 'Экспорт помечен как backup, но поля characters нет.',
      };
    }
    rawCharacters = obj.characters;
  }
  if (rawCharacters.length === 0) {
    return { ok: false, error: 'Файл не содержит персонажей.' };
  }

  const warnings: string[] = [];
  if (
    kind === 'backup' &&
    typeof metadata.characterCount === 'number' &&
    metadata.characterCount !== rawCharacters.length
  ) {
    warnings.push(
      `В metadata указано ${metadata.characterCount} персонажей, в файле ${rawCharacters.length}.`,
    );
  }

  const characters: Partial<Character>[] = [];
  for (let index = 0; index < rawCharacters.length; index += 1) {
    const baseline = normalizeCharacter(rawCharacters[index]);
    const normalized = normalizeCharacterRecord(
      baseline as Record<string, unknown>,
    ).character;
    const errors = validateCharacterPayload(normalized, index);
    if (errors.length > 0) {
      return { ok: false, error: errors.join(' ') };
    }
    characters.push(normalized as Partial<Character>);
  }

  return {
    ok: true,
    kind,
    metadata: {
      appName: EXPORT_APP_NAME,
      format: EXPORT_FORMAT,
      version,
      kind,
      exportDate:
        typeof metadata.exportDate === 'string'
          ? metadata.exportDate
          : now.toISOString(),
      characterCount: rawCharacters.length,
      ...(kind === 'character'
        ? { config: normalizeExportConfig(metadata.config) }
        : {}),
      ...(typeof metadata.account === 'string' && metadata.account
        ? { account: metadata.account }
        : {}),
    },
    characters,
    warnings,
  };
}

export type ImportResult = {
  success: boolean;
  kind?: ExportKind;
  data?: ExportData;
  batchData?: Partial<Character>[];
  warnings?: string[];
  error?: string;
};

/**
 * ─── LANDMARK: EXPORT FIELD SELECTION ─────────────────────────────────────
 * Состав JSON-полей задаёт адаптер модуля; ядро добавляет только идентичность
 * конверта (`id`, `systemId`, `schemaVersion`, legacy `gameSystem`).
 */
export const filterCharacterForExport = (
  character: Character,
  config: ExportConfig,
): Partial<Character> => {
  const normalized = normalizeCharacterRecord(
    character as unknown as Record<string, unknown>,
  ).character;
  const gameModule = getCharacterModule(normalized);
  if (!gameModule) {
    throw new Error(
      `Неизвестная редакция персонажа: ${normalized.systemId ?? normalized.gameSystem}`,
    );
  }

  const fields = gameModule.export.toPortableJson(normalized, config);
  return {
    id: normalized.id,
    gameSystem: normalized.gameSystem,
    systemId: normalized.systemId ?? gameModule.id,
    ...(normalized.schemaVersion !== undefined
      ? { schemaVersion: normalized.schemaVersion }
      : {}),
    ...fields,
  } as unknown as Partial<Character>;
};

function downloadJsonFile(data: unknown, filename: string): void {
  const jsonString = JSON.stringify(data, null, 2);
  const blob = new Blob([jsonString], { type: 'application/json' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = filename;
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
  URL.revokeObjectURL(url);
}

/**
 * Одиночный лист → `dcs_character_<имя>_<дата>.json`.
 * Перед выгрузкой данные проверяются: битый лист не превращается в «тихо
 * сломанный» файл, а возвращает ошибку (UI показывает её).
 */
export const exportCharacterToJSON = (
  character: Character,
  config: ExportConfig,
): { success: boolean; error?: string; filename?: string } => {
  try {
    const payload = buildCharacterExport(character, config);
    const filename = exportFileName('character', { name: character.name });
    downloadJsonFile(payload, filename);
    return { success: true, filename };
  } catch (error) {
    console.error('Character export failed:', error);
    return {
      success: false,
      error: error instanceof Error ? error.message : 'Export failed.',
    };
  }
};

export const importCharacterFromJSON = (file: File): Promise<ImportResult> => {
  return new Promise((resolve) => {
    const reader = new FileReader();
    reader.onload = (e) => {
      try {
        const parsedJson = JSON.parse(String(e.target?.result ?? ''));
        const parsed = parseExportPayload(parsedJson);

        if (!parsed.ok) {
          resolve({ success: false, error: parsed.error });
          return;
        }

        if (parsed.kind === 'backup') {
          resolve({
            success: true,
            kind: 'backup',
            batchData: parsed.characters,
            warnings: parsed.warnings,
          });
          return;
        }

        resolve({
          success: true,
          kind: 'character',
          data: {
            metadata: parsed.metadata,
            character: parsed.characters[0],
          },
          batchData: parsed.characters,
          warnings: parsed.warnings,
        });
      } catch (err) {
        console.error('Import parse error:', err);
        resolve({
          success: false,
          error: 'Failed to parse JSON file. Ensure it is a valid backup.',
        });
      }
    };
    reader.onerror = () =>
      resolve({ success: false, error: 'Failed to read file.' });
    reader.readAsText(file);
  });
};

export const mergeImportedData = (
  targetCharacter: Character,
  importedData: ExportData,
  importConfig: ExportConfig,
): Character => {
  const target = normalizeCharacterRecord(
    targetCharacter as unknown as Record<string, unknown>,
  ).character;
  const source = normalizeCharacterRecord(
    (importedData.character ?? {}) as unknown as Record<string, unknown>,
  ).character as any;
  const merged = { ...(target as any) } as any;
  const targetSystemId = resolveCharacterSystemId(target);
  const sourceSystemId = resolveCharacterSystemId(source);

  if (sourceSystemId && targetSystemId && sourceSystemId !== targetSystemId) {
    throw new Error(
      'Нельзя слить лист другой редакции в существующий персонаж: создайте нового.',
    );
  }

  const isDnd = targetSystemId === 'dnd5e';
  const isDh1 = targetSystemId === 'dh1';
  const isDh2 = targetSystemId === 'dh2';

  if (importConfig.includeBasicInfo) {
    if (source.name !== undefined) merged.name = source.name;
    if (source.characterClass !== undefined) {
      merged.characterClass = source.characterClass;
    }
    if (isDnd) {
      for (const key of [
        'race',
        'background',
        'alignment',
        'age',
        'height',
        'weight',
        'eyes',
        'skin',
        'hair',
        'proficiencyBonus',
      ]) {
        if (source[key] !== undefined) merged[key] = source[key];
      }
    } else {
      for (const key of [
        'homeWorld',
        'worldVariant',
        'careerPath',
        'rank',
        'divination',
        'divinationEffect',
        'quirk',
        'height',
        'weight',
        'age',
        'skinColor',
        'hairColor',
        'eyeColor',
      ]) {
        if (source[key] !== undefined) merged[key] = source[key];
      }
    }
  }

  if (importConfig.includeStats) {
    if (source.stats) {
      const stats = { ...source.stats };
      // Чужие редакции не протекают: dh1 без influence, dh2 — с ним.
      if (isDh1) delete stats.influence;
      if (isDh2) stats.influence = stats.influence ?? 30;
      merged.stats = { ...merged.stats, ...stats };
    }
    if (source.statNotes) merged.statNotes = source.statNotes;
    if ((isDh1 || isDh2) && source.statUpgrades) {
      merged.statUpgrades = source.statUpgrades;
    }
  }

  if (importConfig.includeCombat) {
    if (isDnd) {
      for (const key of [
        'armorClass',
        'speed',
        'hpTracking',
        'hitPointsNotes',
        'temporaryHitPoints',
        'hitDice',
        'exhaustion',
        'savingThrows',
        'skills',
        'attacks',
        'combatResources',
      ]) {
        if (source[key] !== undefined) merged[key] = source[key];
      }
      if (source.hitPoints) {
        merged.hitPoints = { ...merged.hitPoints, ...source.hitPoints };
      }
      if (source.hitDiceUsed) {
        merged.hitDiceUsed = { ...merged.hitDiceUsed, ...source.hitDiceUsed };
      }
      if (source.deathSaves) {
        merged.deathSaves = { ...merged.deathSaves, ...source.deathSaves };
      }
    } else {
      for (const key of [
        'wounds',
        'fatePoints',
        'insanityPoints',
        'corruptionPoints',
        'movement',
        'criticalConditions',
        'customResources',
        'skills',
        'talents',
      ]) {
        const value = source[key];
        if (value === undefined) continue;
        merged[key] =
          value && typeof value === 'object' && !Array.isArray(value)
            ? { ...(merged[key] || {}), ...value }
            : value;
      }
      // Усталость — только существующее у редакции поле.
      if (isDh1 && source.fatigue1st && merged.fatigue1st !== undefined) {
        merged.fatigue1st = { ...merged.fatigue1st, ...source.fatigue1st };
      }
      if (isDh2 && source.fatigue2nd && merged.fatigue2nd !== undefined) {
        merged.fatigue2nd = { ...merged.fatigue2nd, ...source.fatigue2nd };
      }
    }
  }

  if (importConfig.includeEquipment && source.equipment) {
    merged.equipment = source.equipment;
  }

  if (importConfig.includeInventory) {
    if (source.inventory) merged.inventory = source.inventory;
    if (isDnd) {
      if (source.currency) {
        merged.currency = { ...merged.currency, ...source.currency };
      }
      if (source.attunementItems !== undefined) {
        merged.attunementItems = source.attunementItems;
      }
    } else if (source.wealth) {
      merged.wealth = { ...merged.wealth, ...source.wealth };
    }
  }

  if (importConfig.includeSpells && isDnd) {
    for (const key of [
      'spells',
      'spellSlots',
      'spellcastingAbility',
      'spellAttackBonus',
      'spellSaveDifficulty',
      'spellcastingEntries',
    ]) {
      if (source[key] !== undefined) merged[key] = source[key];
    }
  }

  if (importConfig.includeNarrative) {
    for (const key of [
      'backstory',
      'notes',
      'otherProficienciesAndLanguages',
      'personalityTraits',
      'ideals',
      'bonds',
      'flaws',
      'featuresAndTraits',
    ]) {
      if (source[key] !== undefined) merged[key] = source[key];
    }
  }

  if (importConfig.includeProgression) {
    if (isDnd) {
      for (const key of [
        'level',
        'experiencePoints',
        'isMulticlass',
        'multiclasses',
        'divineBoons',
        'allowDivineBoonsBeforeLevel20',
        'inspiration',
        'allowInspirationHomeRule',
      ]) {
        if (source[key] !== undefined) merged[key] = source[key];
      }
    } else {
      for (const key of [
        'experience',
        'totalExpSpent',
        'alternatePath',
        'advancedPath',
      ]) {
        if (source[key] !== undefined) merged[key] = source[key];
      }
    }
  }

  if (importConfig.includeCompanions && isDnd && source.companions) {
    merged.companions = source.companions;
  }

  if (importConfig.includeQuestLog && source.questLog) {
    merged.questLog = source.questLog;
  }

  if (importConfig.includeCustomHouseRules && source.customHouseRules) {
    merged.customHouseRules = source.customHouseRules;
  }

  return merged as Character;
};

// LANDMARK: COMPREHENSIVE_USER_FRIENDLY_EXCEL_EXPORT
function buildCharacterSheetRows(
  character: Character,
  now = new Date(),
): any[][] {
  const data: any[][] = [];
  const isDnD = character.gameSystem === 'Dungeons & Dragons';
  const dnd = character as DnD5eCharacter;
  const dh = character as LegacyDarkHeresyExport;

  // Helper functions
  const addHeader = (text: string) => {
    data.push([text.toUpperCase()]);
    data.push([]);
  };

  const addSubHeader = (text: string) => {
    data.push([`  ${text}`]);
  };

  const addRow = (label: string, value: any) => {
    if (value === undefined || value === null || value === '') return;
    data.push([`    ${label}`, value]);
  };

  const addEmptyRow = () => data.push([]);

  const formatList = (items: any[], nameKey = 'name'): string => {
    if (!items || items.length === 0) return 'None';
    return items
      .map((item) => {
        if (typeof item === 'string') return `• ${item}`;
        if (item && typeof item === 'object') {
          const name =
            item[nameKey] || item.label || item.title || JSON.stringify(item);
          return `• ${name}`;
        }
        return `• ${String(item)}`;
      })
      .join('\n');
  };

  // ═══════════════════════════════════════════════════════════
  // HEADER / METADATA (тот же стандарт, что у JSON-экспорта)
  // ═══════════════════════════════════════════════════════════
  data.push(['DIGITAL CHARACTER SHEETS — CHARACTER EXPORT']);
  data.push(['App', EXPORT_APP_NAME]);
  data.push(['Format', EXPORT_FORMAT]);
  data.push(['Format version', EXPORT_FORMAT_VERSION]);
  data.push(['Kind', 'character']);
  data.push(['Export date', now.toISOString()]);
  data.push(['Character ID', character.id]);
  data.push(['Character', character.name]);
  data.push(['Game system', character.gameSystem]);
  addEmptyRow();

  // ═══════════════════════════════════════════════════════════
  // BASIC INFORMATION
  // ═══════════════════════════════════════════════════════════
  addHeader('Basic Information');
  addRow('Name', character.name);
  addRow('Class / Career', character.characterClass);

  if (isDnD) {
    addRow('Race', dnd.race);
    addRow('Level', dnd.level);
    addRow('Background', dnd.background);
    addRow('Alignment', dnd.alignment);
    addRow('Age', dnd.age);
    addRow('Height', dnd.height);
    addRow('Weight', dnd.weight);
    addRow('Eyes', dnd.eyes);
    addRow('Hair', dnd.hair);
    addRow('Skin', dnd.skin);
    addRow('Experience Points', dnd.experiencePoints);
    addRow('Proficiency Bonus', (dnd as any).proficiencyBonus);
    addRow('Inspiration', (dnd as any).inspiration);
  } else {
    addRow('Edition', dh.edition);
    addRow('Rank', dh.rank);
    addRow('Home World', dh.homeWorld);
    addRow('World Variant', dh.worldVariant);
    addRow('Career Path', dh.careerPath);
    addRow(
      'Divination',
      DIVINATION_BY_ID[dh.divination]?.divination ?? dh.divination,
    );
    addRow(
      'Divination Effect',
      DIVINATION_BY_ID[dh.divination]?.effect ?? dh.divinationEffect,
    );
    addRow('Quirk', dh.quirk);
    addRow('Age', dh.age);
    addRow('Height', dh.height);
    addRow('Weight', dh.weight);
    addRow('Skin Color', dh.skinColor);
    addRow('Hair Color', dh.hairColor);
    addRow('Eye Color', dh.eyeColor);
    addRow('Experience', dh.experience);
    addRow('Total XP Spent', dh.totalExpSpent);
    addRow('Alternate Path', dh.alternatePath);
    addRow('Advanced Path', dh.advancedPath);
  }
  addEmptyRow();

  // ═══════════════════════════════════════════════════════════
  // STATS / CHARACTERISTICS
  // ═══════════════════════════════════════════════════════════
  addHeader(isDnD ? 'Ability Scores' : 'Characteristics');

  if (isDnD) {
    const stats = dnd.stats || {
      strength: 10,
      dexterity: 10,
      constitution: 10,
      intelligence: 10,
      wisdom: 10,
      charisma: 10,
    };
    data.push(['    Stat', 'Score', 'Modifier']);
    const statNames = [
      'strength',
      'dexterity',
      'constitution',
      'intelligence',
      'wisdom',
      'charisma',
    ];
    statNames.forEach((stat) => {
      const val = (stats as any)[stat] || 10;
      const mod = Math.floor((val - 10) / 2);
      const modStr = mod >= 0 ? `+${mod}` : `${mod}`;
      data.push([
        '    ' + stat.charAt(0).toUpperCase() + stat.slice(1),
        val,
        modStr,
      ]);
    });
  } else {
    const stats = dh.stats || {
      weaponSkill: 0,
      ballisticSkill: 0,
      strength: 0,
      toughness: 0,
      agility: 0,
      intelligence: 0,
      perception: 0,
      willpower: 0,
      fellowship: 0,
      influence: 0,
    };
    const statKeys = [
      'weaponSkill',
      'ballisticSkill',
      'strength',
      'toughness',
      'agility',
      'intelligence',
      'perception',
      'willpower',
      'fellowship',
      'influence',
    ];
    const statLabels = [
      'Weapon Skill',
      'Ballistic Skill',
      'Strength',
      'Toughness',
      'Agility',
      'Intelligence',
      'Perception',
      'Willpower',
      'Fellowship',
      'Influence',
    ];

    data.push(['    Characteristic', 'Value', 'Advances']);
    statKeys.forEach((key, idx) => {
      const val = (stats as any)[key] || 0;
      const upgrades = (dh.statUpgrades as any)?.[key];
      const advCount = Array.isArray(upgrades)
        ? upgrades.filter(Boolean).length
        : 0;
      data.push(['    ' + statLabels[idx], val, advCount]);
    });
  }
  addEmptyRow();

  // ═══════════════════════════════════════════════════════════
  // COMBAT & STATUS
  // ═══════════════════════════════════════════════════════════
  addHeader('Combat & Status');

  if (isDnD) {
    addRow('Armor Class', dnd.armorClass);
    addRow('Speed', dnd.speed ? `${dnd.speed} ft.` : undefined);
    addRow(
      'Hit Points',
      dnd.hitPoints
        ? `${dnd.hitPoints.current} / ${dnd.hitPoints.max}`
        : undefined,
    );
    addRow('Temporary Hit Points', dnd.temporaryHitPoints);
    addRow('Hit Dice', dnd.hitDice);
    addRow('Hit Dice Used', dnd.hitDiceUsed);
    addRow(
      'Death Saves',
      dnd.deathSaves
        ? `Successes: ${dnd.deathSaves.successes}, Failures: ${dnd.deathSaves.failures}`
        : undefined,
    );
    addRow('Exhaustion', dnd.exhaustion);
    addRow('HP Notes', dnd.hitPointsNotes);
  } else {
    addRow(
      'Wounds',
      dh.wounds ? `${dh.wounds.current} / ${dh.wounds.max}` : undefined,
    );
    addRow('Wounds Notes', dh.wounds?.notes);
    addRow(
      'Fate Points',
      dh.fatePoints
        ? `${dh.fatePoints.current} / ${dh.fatePoints.max}`
        : undefined,
    );
    addRow('Fate Points Notes', dh.fatePoints?.notes);
    addRow('Insanity Points', dh.insanityPoints?.total);
    addRow('Insanity Notes', dh.insanityPoints?.notes);
    addRow('Corruption Points', dh.corruptionPoints?.total);
    addRow('Corruption Notes', dh.corruptionPoints?.notes);
    addRow('Fatigue (1st)', dh.fatigue1st?.current);
    addRow('Fatigue (1st) Notes', dh.fatigue1st?.notes);
    addRow('Fatigue (2nd)', dh.fatigue2nd?.current);
    addRow('Fatigue (2nd) Notes', dh.fatigue2nd?.notes);
    addRow(
      'Critical Conditions',
      formatList(dh.criticalConditions || [], 'name'),
    );
    addRow(
      'Custom Resources',
      (dh.customResources || [])
        .map(
          (r) =>
            `${r.description}: ${r.current}/${r.max}${r.notes ? ` (${r.notes})` : ''}`,
        )
        .join('\n') || undefined,
    );
    addRow('Movement - Walk (Half)', dh.movement?.walkHalf);
    addRow('Movement - Walk (Full)', dh.movement?.walkFull);
    addRow('Movement - Charge', dh.movement?.charge);
    addRow('Movement - Run', dh.movement?.run);
  }
  addEmptyRow();

  // ═══════════════════════════════════════════════════════════
  // SAVING THROWS (DnD) / SKILLS & TALENTS
  // ═══════════════════════════════════════════════════════════
  if (isDnD) {
    addHeader('Saving Throws');
    const saves = (dnd as any).savingThrows || [];
    if (saves.length > 0) {
      data.push(['    Ability', 'Proficient', 'Bonus']);
      saves.forEach((save: any) => {
        if (typeof save === 'string') {
          data.push(['    ' + save]);
        } else if (save && typeof save === 'object') {
          const name = save.name || save.ability || '';
          const prof = save.proficient ? 'Yes' : '';
          const bonus =
            save.bonus !== undefined
              ? save.bonus >= 0
                ? `+${save.bonus}`
                : `${save.bonus}`
              : '';
          data.push(['    ' + name, prof, bonus]);
        }
      });
    } else {
      data.push(['    None']);
    }
    addEmptyRow();
  }

  addHeader('Skills');
  if (isDnD) {
    const skills = (dnd as any).skills || [];
    if (skills.length > 0) {
      data.push([
        '    Skill Name',
        'Ability',
        'Bonus',
        'Proficient',
        'Expertise',
        'Notes',
      ]);
      skills.forEach((skill: any) => {
        if (typeof skill === 'string') {
          data.push(['    ' + skill]);
        } else if (skill && typeof skill === 'object') {
          data.push([
            '    ' + (skill.name || ''),
            skill.ability || '',
            skill.bonus !== undefined
              ? skill.bonus >= 0
                ? `+${skill.bonus}`
                : `${skill.bonus}`
              : '',
            skill.proficient ? 'Yes' : '',
            skill.expertise ? 'Yes' : '',
            skill.notes || '',
          ]);
        }
      });
    } else {
      data.push(['    None']);
    }
  } else {
    const skills = dh.skills || [];
    if (skills.length > 0) {
      data.push(['    Skill Name', 'Characteristic', 'Proficiency', 'Notes']);
      skills.forEach((skill: any) => {
        if (typeof skill === 'string') {
          data.push(['    ' + skill, '', '', '']);
        } else if (skill && typeof skill === 'object') {
          let proficiency = 'Untrained';
          if (skill.training?.plus20) {
            proficiency = '+20';
          } else if (skill.training?.plus10) {
            proficiency = '+10';
          } else if (skill.training?.skilled) {
            proficiency = 'Skilled (+0)';
          }

          data.push([
            '    ' + (skill.name || ''),
            skill.characteristic || '',
            proficiency,
            skill.notes || '',
          ]);
        }
      });
    } else {
      data.push(['    None']);
    }
  }
  addEmptyRow();

  if (!isDnD) {
    addHeader('Talents');
    const talents = dh.talents || [];
    if (talents.length > 0) {
      // FIX: Separated Description and Notes into their own columns
      data.push(['    Talent Name', 'Description', 'Notes']);
      talents.forEach((t: any) => {
        if (typeof t === 'string') {
          data.push(['    ' + t, '', '']);
        } else if (t && typeof t === 'object') {
          data.push([
            '    ' + (t.name || ''),
            t.description || '',
            t.notes || '',
          ]);
        }
      });
    } else {
      data.push(['    None']);
    }
    addEmptyRow();
  }

  // ═══════════════════════════════════════════════════════════
  // ATTACKS & COMBAT RESOURCES (DnD)
  // ═══════════════════════════════════════════════════════════
  if (isDnD) {
    addHeader('Attacks & Combat');
    const attacks = (dnd as any).attacks || [];
    if (attacks.length > 0) {
      data.push([
        '    Name',
        'Attack Bonus',
        'Damage',
        'Damage Type',
        'Properties',
        'Notes',
      ]);
      attacks.forEach((a: any) => {
        if (typeof a === 'string') {
          data.push(['    ' + a]);
        } else if (a && typeof a === 'object') {
          data.push([
            '    ' + (a.name || ''),
            a.attackBonus || a.bonus || '',
            a.damage || '',
            a.damageType || a.type || '',
            a.properties || '',
            a.notes || '',
          ]);
        }
      });
    } else {
      data.push(['    None']);
    }

    const resources = (dnd as any).combatResources || [];
    if (resources.length > 0) {
      addSubHeader('Combat Resources');
      data.push(['    Resource', 'Current', 'Max', 'Notes']);
      resources.forEach((r: any) => {
        if (typeof r === 'string') {
          data.push(['    ' + r]);
        } else if (r && typeof r === 'object') {
          data.push([
            '    ' + (r.name || ''),
            r.current || '',
            r.max || '',
            r.notes || '',
          ]);
        }
      });
    }
    addEmptyRow();
  }

  // ═══════════════════════════════════════════════════════════
  // EQUIPMENT & INVENTORY
  // ═══════════════════════════════════════════════════════════
  addHeader('Equipment & Inventory');

  if (isDnD) {
    const c = dnd.currency || { cp: 0, sp: 0, gp: 0, ep: 0, pp: 0 };
    addSubHeader('Currency');
    data.push(['    CP', c.cp, 'SP', c.sp, 'GP', c.gp]);
    data.push(['    EP', c.ep, 'PP', c.pp]);

    addSubHeader('Equipment');
    const equipment = (dnd as any).equipment || [];
    if (equipment.length > 0) {
      data.push(['    Item', 'Quantity', 'Weight', 'Notes']);
      equipment.forEach((e: any) => {
        if (typeof e === 'string') {
          data.push(['    ' + e]);
        } else if (e && typeof e === 'object') {
          data.push([
            '    ' + (e.name || ''),
            e.quantity || e.count || 1,
            e.weight || '',
            e.notes || '',
          ]);
        }
      });
    } else {
      data.push(['    None']);
    }

    addSubHeader('Inventory');
    const inventory = (dnd as any).inventory || [];
    if (inventory.length > 0) {
      data.push(['    Item', 'Quantity', 'Weight', 'Notes']);
      inventory.forEach((i: any) => {
        if (typeof i === 'string') {
          data.push(['    ' + i]);
        } else if (i && typeof i === 'object') {
          data.push([
            '    ' + (i.name || ''),
            i.quantity || i.count || 1,
            i.weight || '',
            i.notes || '',
          ]);
        }
      });
    } else {
      data.push(['    None']);
    }

    const attunement = (dnd as any).attunementItems || [];
    if (attunement.length > 0) {
      addSubHeader('Attunement Items');
      data.push(['    ' + formatList(attunement)]);
    }
  } else {
    addSubHeader('Wealth');
    data.push(['    Throne Gelt', dh.wealth?.throneGelt || 0]);
    data.push(['    Monthly Income', dh.wealth?.monthlyIncome || 0]);
    data.push(['    Notes', dh.wealth?.notes || '']);

    addSubHeader('Armor');
    const armor = (dh.equipment as any)?.armor || {};
    const armorEntries = Object.entries(armor).filter(
      ([_, v]) => v !== null && v !== undefined && v !== '',
    );
    if (armorEntries.length > 0) {
      data.push(['    Location', 'Armor Details']);
      armorEntries.forEach(([loc, item]) => {
        if (typeof item === 'string') {
          data.push(['    ' + loc, item]);
        } else if (item && typeof item === 'object') {
          const details: string[] = [];
          Object.entries(item).forEach(([key, value]) => {
            if (value !== null && value !== undefined && value !== '') {
              if (typeof value === 'object') {
                details.push(`${key}: ${JSON.stringify(value)}`);
              } else {
                details.push(`${key}: ${value}`);
              }
            }
          });
          data.push(['    ' + loc, details.join(' | ')]);
        }
      });
    } else {
      data.push(['    None']);
    }

    addSubHeader('Weapons');
    const weapons = (dh.equipment as any)?.weapons || { melee: [], ranged: [] };
    const allWeapons = [...(weapons.melee || []), ...(weapons.ranged || [])];
    if (allWeapons.length > 0) {
      data.push([
        '    Name',
        'Type',
        'Range',
        'Damage',
        'Penetration',
        'Traits',
      ]);
      allWeapons.forEach((w: any) => {
        if (typeof w === 'string') {
          data.push(['    ' + w, '', '', '', '', '']);
        } else if (w && typeof w === 'object') {
          data.push([
            '    ' + (w.name || ''),
            w.type || w.class || '',
            w.range || '',
            w.damage || '',
            w.penetration || w.pen || '',
            w.traits || w.qualities || w.special || '',
          ]);
        }
      });
    } else {
      data.push(['    None']);
    }

    addSubHeader('Inventory');
    const inventory = dh.inventory || [];
    if (inventory.length > 0) {
      data.push(['    Item', 'Quantity', 'Weight', 'Notes']);
      inventory.forEach((i: any) => {
        if (typeof i === 'string') {
          data.push(['    ' + i]);
        } else if (i && typeof i === 'object') {
          data.push([
            '    ' + (i.name || ''),
            i.quantity || i.count || 1,
            i.weight || '',
            i.notes || '',
          ]);
        }
      });
    } else {
      data.push(['    None']);
    }
  }
  addEmptyRow();

  // ═══════════════════════════════════════════════════════════
  // SPELLS (DnD only)
  // ═══════════════════════════════════════════════════════════
  if (isDnD) {
    addHeader('Spellcasting');
    addRow('Spellcasting Ability', (dnd as any).spellcastingAbility);
    addRow('Spell Save DC', (dnd as any).spellSaveDifficulty);
    addRow('Spell Attack Bonus', (dnd as any).spellAttackBonus);

    const slots = (dnd as any).spellSlots || {};
    if (
      typeof slots === 'object' &&
      !Array.isArray(slots) &&
      Object.keys(slots).length > 0
    ) {
      addSubHeader('Spell Slots');
      data.push(['    Level', 'Total', 'Used']);
      Object.entries(slots).forEach(([level, count]) => {
        const used = ((dnd as any).spellSlotsUsed || {})[level] || 0;
        data.push(['    ' + level, count, used]);
      });
    }

    const spells = (dnd as any).spells || [];
    if (spells.length > 0) {
      addSubHeader('Known / Prepared Spells');
      data.push([
        '    Spell Name',
        'Level',
        'School',
        'Casting Time',
        'Components',
        'Range',
        'Duration',
        'Prepared',
        'Notes',
      ]);
      spells.forEach((s: any) => {
        if (typeof s === 'string') {
          data.push(['    ' + s]);
        } else if (s && typeof s === 'object') {
          data.push([
            '    ' + (s.name || ''),
            s.level !== undefined ? s.level : '',
            s.school || '',
            s.castingTime || s.casting_time || '',
            s.components || '',
            s.range || '',
            s.duration || '',
            s.prepared ? 'Yes' : '',
            s.notes || '',
          ]);
        }
      });
    }

    const entries = (dnd as any).spellcastingEntries || [];
    if (entries.length > 0) {
      addSubHeader('Spellcasting Entries');
      data.push(['    ' + formatList(entries)]);
    }
    addEmptyRow();
  }

  // ═══════════════════════════════════════════════════════════
  // FEATURES & TRAITS (DnD)
  // ═══════════════════════════════════════════════════════════
  if (isDnD) {
    addHeader('Features & Traits');
    const features = (dnd as any).featuresAndTraits || [];
    if (features.length > 0) {
      data.push(['    Name', 'Source', 'Description']);
      features.forEach((f: any) => {
        if (typeof f === 'string') {
          data.push(['    ' + f]);
        } else if (f && typeof f === 'object') {
          data.push([
            '    ' + (f.name || ''),
            f.source || '',
            f.description || '',
          ]);
        }
      });
    } else {
      data.push(['    None']);
    }
    addEmptyRow();
  }

  // ═══════════════════════════════════════════════════════════
  // NARRATIVE
  // ═══════════════════════════════════════════════════════════
  addHeader('Narrative & Notes');
  addRow('Backstory', character.backstory);
  addRow('Notes', character.notes);

  if (isDnD) {
    addRow('Personality Traits', (dnd as any).personalityTraits);
    addRow('Ideals', (dnd as any).ideals);
    addRow('Bonds', (dnd as any).bonds);
    addRow('Flaws', (dnd as any).flaws);
    addRow(
      'Proficiencies & Languages',
      (dnd as any).otherProficienciesAndLanguages,
    );
  }
  addEmptyRow();

  // ═══════════════════════════════════════════════════════════
  // COMPANIONS (DnD)
  // ═══════════════════════════════════════════════════════════
  if (isDnD) {
    const companions = (dnd as any).companions || [];
    if (companions.length > 0) {
      addHeader('Companions');
      data.push(['    Name', 'Type', 'AC', 'HP', 'Notes']);
      companions.forEach((c: any) => {
        if (typeof c === 'string') {
          data.push(['    ' + c]);
        } else if (c && typeof c === 'object') {
          data.push([
            '    ' + (c.name || ''),
            c.type || '',
            c.ac || '',
            c.hp || '',
            c.notes || '',
          ]);
        }
      });
      addEmptyRow();
    }
  }

  // ═══════════════════════════════════════════════════════════
  // QUEST LOG
  // ═══════════════════════════════════════════════════════════
  const quests = character.questLog || [];
  if (quests.length > 0) {
    addHeader('Quest Log');
    data.push(['    Quest Name', 'Status', 'Description', 'Rewards', 'Notes']);
    quests.forEach((q: any) => {
      if (typeof q === 'string') {
        data.push(['    ' + q]);
      } else if (q && typeof q === 'object') {
        data.push([
          '    ' + (q.name || q.title || ''),
          q.status || '',
          q.description || '',
          q.rewards || '',
          q.notes || '',
        ]);
      }
    });
    addEmptyRow();
  }

  // ═══════════════════════════════════════════════════════════
  // CUSTOM HOUSE RULES
  // ═══════════════════════════════════════════════════════════
  const houseRules = character.customHouseRules || [];
  if (houseRules.length > 0) {
    addHeader('Custom House Rules');
    data.push(['    Rule Name', 'Description']);
    if (Array.isArray(houseRules)) {
      houseRules.forEach((r: any) => {
        if (typeof r === 'string') {
          data.push(['    ' + r]);
        } else if (r && typeof r === 'object') {
          data.push(['    ' + (r.name || r.title || ''), r.description || '']);
        }
      });
    } else if (typeof houseRules === 'string') {
      data.push(['    ' + houseRules]);
    }
    addEmptyRow();
  }

  return data;
}

/** Имя листа Excel: без `[]:*?/\\`, не длиннее 31 символа. */
function excelSheetName(character: Character): string {
  const cleaned = String(character.name || '')
    .replace(/[\[\]:*?\/\\]/g, '')
    .replace(/\s+/g, ' ')
    .trim();
  return (cleaned || 'Character').slice(0, 31);
}

const EXCEL_COLUMNS = [
  { wch: 35 }, // Column A: Labels
  { wch: 40 }, // Column B: Values / Description
  { wch: 40 }, // Column C: Notes / Additional
  { wch: 15 }, // Column D: Additional
  { wch: 15 }, // Column E: Additional
  { wch: 15 }, // Column F: Additional
  { wch: 20 }, // Column G: Additional
  { wch: 20 }, // Column H: Additional
  { wch: 30 }, // Column I: Notes/Description
];

/**
 * xlsx-выгрузка одного листа: `dcs_character_<имя>_<YYYY-MM-DD>.xlsx`.
 * Внутри — стандартный технический блок (appName/format/version/kind/дата),
 * затем человекочитаемый лист по секциям. Данные проверяются так же, как при
 * JSON-экспорте: битый лист не превращается в файл.
 */
export const exportCharacterToExcel = (
  character: Character,
  now = new Date(),
): { success: boolean; filename?: string; error?: string } => {
  try {
    const normalized = normalizeCharacterRecord(
      character as unknown as Record<string, unknown>,
    ).character;
    const errors = validateCharacterPayload(normalized, 0);
    if (errors.length > 0) {
      return { success: false, error: `Экспорт отменён: ${errors.join(' ')}` };
    }

    const worksheet = XLSX.utils.aoa_to_sheet(
      buildCharacterSheetRows(normalized, now),
    );
    worksheet['!cols'] = EXCEL_COLUMNS;

    const workbook = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(
      workbook,
      worksheet,
      excelSheetName(character),
    );

    const filename = exportFileName('character', {
      name: character.name,
      date: now,
      extension: 'xlsx',
    });
    XLSX.writeFile(workbook, filename);
    return { success: true, filename };
  } catch (error) {
    console.error('Excel export failed:', error);
    return {
      success: false,
      error: error instanceof Error ? error.message : 'Export failed.',
    };
  }
};
