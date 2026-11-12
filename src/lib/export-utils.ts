// src/lib/export-utils.ts

'use client';

import * as XLSX from 'xlsx';

import {
  getCharacterModule,
  resolveCharacterSystemId,
} from '@/games/character-system';
import { getGameDefinition } from '@/games/games';
import type {
  ExcelCell,
  ExportTranslate,
  GameExportConfig,
} from '@/games/types';

import { isNonPortableField, toPortableCharacter } from './character-portable';
import { normalizeCharacterRecord } from './character-version';
import { translations } from './i18n';
import { Character } from './types';

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

function validateCharacterPayload(
  character: any,
  index: number,
  options: { allowUnknownSystem?: boolean } = {},
): string[] {
  const label = `Персонаж #${index + 1}`;
  if (!character || typeof character !== 'object' || Array.isArray(character)) {
    return [`${label}: ожидался объект.`];
  }
  const errors: string[] = [];
  if (!options.allowUnknownSystem && !resolveCharacterSystemId(character)) {
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

function assertExportable(
  characters: any[],
  options: { allowUnknownSystem?: boolean } = {},
): void {
  const errors = characters.flatMap((character, index) =>
    validateCharacterPayload(character, index, options),
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
  // Плагин может быть удалён из сборки: JSON-экспорт его листа не пропадает.
  assertExportable([portable], { allowUnknownSystem: true });
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
  assertExportable(portable, { allowUnknownSystem: true });
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
    const normalized = normalizeCharacterRecord(
      rawCharacters[index] as Record<string, unknown>,
      { applyDefaults: true },
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
    // Плагин не установлен (удалён из сборки): отдаём переносимые поля
    // как есть, чтобы JSON-экспорт работал (D9).
    return {
      ...(normalized as unknown as Record<string, unknown>),
    } as Partial<Character>;
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

/**
 * ─── LANDMARK: IMPORT MERGE ────────────────────────────────────────────────
 * Ядро только нормализует обе стороны и проверяет, что редакции совпадают;
 * какие поля сливать — решает плагин (`module.merge`, этап 2). Так в ядре
 * больше нет `isDnd/isDh1/isDh2`.
 */
export const mergeImportedData = (
  targetCharacter: Character,
  importedData: ExportData,
  importConfig: ExportConfig,
): Character => {
  const target = normalizeCharacterRecord(
    targetCharacter as unknown as Record<string, unknown>,
    { applyDefaults: true },
  ).character;
  const source = normalizeCharacterRecord(
    (importedData.character ?? {}) as unknown as Record<string, unknown>,
    { applyDefaults: true },
  ).character;
  const targetSystemId = resolveCharacterSystemId(target);
  const sourceSystemId = resolveCharacterSystemId(source);

  if (sourceSystemId && targetSystemId && sourceSystemId !== targetSystemId) {
    throw new Error(
      'Нельзя слить лист другой редакции в существующий персонаж: создайте нового.',
    );
  }

  const gameModule = getCharacterModule(target);
  if (typeof gameModule?.merge !== 'function') {
    throw new Error(
      `Плагин "${targetSystemId ?? 'неизвестно'}" не умеет сливать импортированные данные.`,
    );
  }

  return gameModule.merge(
    target,
    source as unknown as Record<string, unknown>,
    importConfig,
  ) as Character;
};

// LANDMARK: EXCEL_LEDGER
/** Английский словарь по умолчанию: тесты и вызовы без контекста языка. */
const defaultExcelTranslate: ExportTranslate = (key) =>
  translations.en[key] ?? key;

/**
 * ─── LANDMARK: EXCEL SHEET ASSEMBLY ───────────────────────────────────────
 * Технический блок + секции из адаптера модуля. Структура человекочитаемой
 * части живёт в `src/games/<id>/excel.ts`, поэтому новая игра не требует
 * правок этого файла.
 */
function buildCharacterSheetRows(
  character: Character,
  translate: ExportTranslate,
  now = new Date(),
): ExcelCell[][] {
  const gameModule = getCharacterModule(character);
  if (!gameModule) {
    throw new Error(
      `Неизвестная редакция персонажа: ${character.systemId ?? character.gameSystem}`,
    );
  }
  const gameDefinition = getGameDefinition(gameModule.gameId);
  const data: ExcelCell[][] = [
    [translate('io.excel.exportTitle').toUpperCase()],
    [translate('io.excel.app'), EXPORT_APP_NAME],
    [translate('io.excel.format'), EXPORT_FORMAT],
    [translate('io.excel.formatVersion'), EXPORT_FORMAT_VERSION],
    [translate('io.excel.kind'), 'character'],
    [translate('io.excel.exportDate'), now.toISOString()],
    [translate('io.excel.characterId'), character.id],
    [translate('io.excel.character'), character.name],
    [
      translate('io.excel.gameSystem'),
      gameDefinition
        ? `${translate(gameDefinition.nameKey)} · ${translate(gameModule.nameKey)}`
        : character.gameSystem,
    ],
    [],
  ];

  const sections = gameModule.export.buildExcelSections(
    character,
    DEFAULT_EXPORT_CONFIG,
    translate,
  );
  for (const section of sections) {
    data.push([section.title.toUpperCase()]);
    data.push([]);
    for (const row of section.rows) data.push([...row]);
    data.push([]);
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
  translate: ExportTranslate = defaultExcelTranslate,
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
      buildCharacterSheetRows(normalized, translate, now),
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
