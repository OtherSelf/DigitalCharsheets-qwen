import crypto from 'crypto';
import fs from 'fs';
import path from 'path';

import { NextResponse } from 'next/server';

import { listGameModules } from '@/games/registry';
import { normalizeCharacterRecord } from '@/lib/character-version';
import { getCharactersDir, getDataDir } from '@/lib/data-dir';
import { writeJsonAtomic } from '@/lib/fs-atomic';
import { createImportedUser } from '@/lib/server-auth';

function importFilePath(): string {
  return path.join(getDataDir(), 'import-source.json');
}
const DEFAULT_PASSWORD = '1234'; // Default password for all imported users

// ─── ЧИСТКА ДАННЫХ ─────────────────────────────────────────────────

// Выгрузка Firestore приходит с пробелами в ключах и значениях; чистим
// рекурсивно, не зная структуры заранее.
function cleanObject(value: unknown): unknown {
  if (value === null || value === undefined) return value;
  if (typeof value === 'string') return value.trim();
  if (typeof value === 'number' || typeof value === 'boolean') return value;
  if (Array.isArray(value)) return value.map((item) => cleanObject(item));
  if (typeof value === 'object') {
    const cleaned: Record<string, unknown> = {};
    for (const [key, rawValue] of Object.entries(
      value as Record<string, unknown>,
    )) {
      cleaned[key.trim()] = cleanObject(rawValue);
    }
    return cleaned;
  }
  return value;
}

function hashPassword(password: string): string {
  return crypto.createHash('sha256').update(password).digest('hex');
}

function generateId(): string {
  return Date.now().toString(36) + Math.random().toString(36).substr(2);
}

// ─── ОБРАБОТЧИК ИМПОРТА (GET — открыть URL в браузере) ─────────────

export async function GET() {
  try {
    // Без входного файла импортировать нечего.
    const IMPORT_FILE = importFilePath();
    if (!fs.existsSync(IMPORT_FILE)) {
      return NextResponse.json(
        {
          success: false,
          error: `Import file not found. Please save your Firestore export as "data/import-source.json" and try again.`,
        },
        { status: 404 },
      );
    }

    // Читаем выгрузку целиком: она одноразовая и лежит в data-dir.
    const fileContent = fs.readFileSync(IMPORT_FILE, 'utf8');
    const rawData = JSON.parse(fileContent);

    if (!Array.isArray(rawData) || rawData.length === 0) {
      return NextResponse.json(
        {
          success: false,
          error: 'Import file is empty or not a valid array.',
        },
        { status: 400 },
      );
    }

    // Шаг 1. Чистим пробелы в ключах и значениях.
    const cleanedData = rawData.map(
      (char) => cleanObject(char) as Record<string, unknown>,
    );

    // Шаг 2. Группируем по Firebase-пользователю из Document ID.
    const userGroups: Record<string, Record<string, unknown>[]> = {};
    for (const char of cleanedData) {
      const docId =
        typeof char['Document ID'] === 'string' ? char['Document ID'] : '';
      const match = docId.match(/\/users\/([^\/]+)\/characterSheets\//);
      if (match) {
        const firebaseUserId = match[1];
        if (!userGroups[firebaseUserId]) userGroups[firebaseUserId] = [];
        userGroups[firebaseUserId].push(char);
      }
    }

    // Шаг 3. По пользователю: аккаунт, затем его листы.
    const results: {
      localUserId: string;
      username: string;
      password: string;
      charactersImported: number;
      characters: { name: string; system: string }[];
    }[] = [];
    let totalImported = 0;
    const passwordHash = hashPassword(DEFAULT_PASSWORD);

    for (const [firebaseUserId, chars] of Object.entries(userGroups)) {
      // Без домена: в этом приложении логин — просто ключ.
      const userLogin = `imported-${firebaseUserId.substr(0, 6)}`;
      const displayName = `Player ${firebaseUserId.substr(0, 4)}`;

      // Неизменяемый uid выдаётся при создании аккаунта (UUID), а не
      // вычисляется из firebase-идентификатора: логин остаётся атрибутом.
      // createImportedUser пишет user.json и запись индекса под локом.
      const importedUser = createImportedUser({
        username: userLogin,
        displayName,
        passwordHash,
        originalFirebaseId: firebaseUserId,
      });
      const localUserId = importedUser.uid;

      const charsDir = getCharactersDir(localUserId);
      if (!fs.existsSync(charsDir)) {
        fs.mkdirSync(charsDir, { recursive: true });
      }

      // Конвертацию каждого листа делает плагин, который узнал свою систему.
      const importedChars: { name: string; system: string }[] = [];
      chars.forEach((raw, index) => {
        // Какая игра и как конвертировать legacy-запись — знает плагин
        // (`matchesLegacyImport`/`legacyImportName`/`convertLegacyImport`).
        const gameModule = listGameModules().find((module) =>
          module.matchesLegacyImport?.(raw),
        );
        if (!gameModule?.convertLegacyImport) return; // неизвестная система

        const name =
          gameModule.legacyImportName?.(raw, index) ??
          `Character #${index + 1}`;
        const converted = gameModule.convertLegacyImport(raw, {
          userId: localUserId,
          name,
          createId: generateId,
        });
        if (!converted) return;

        // Обрыв посреди импорта не должен оставить обрезанный JSON: файл
        // подменяется атомарно, как и везде в файловом хранилище.
        const character = normalizeCharacterRecord(converted).character;
        const charFile = path.join(charsDir, `${character.id}.json`);
        writeJsonAtomic(charFile, character);
        importedChars.push({
          name: character.name,
          system: character.gameSystem ?? 'unknown',
        });
        totalImported++;
      });

      results.push({
        localUserId,
        username: userLogin,
        password: DEFAULT_PASSWORD,
        charactersImported: importedChars.length,
        characters: importedChars,
      });
    }

    // Шаг 4. Файл одноразовый: повторный импорт создал бы дубли.
    fs.unlinkSync(IMPORT_FILE);

    return NextResponse.json({
      success: true,
      message: `Import complete! ${totalImported} characters imported across ${results.length} user accounts.`,
      defaultPassword: DEFAULT_PASSWORD,
      users: results,
      note: 'The import-source.json file has been deleted. You can now log in with the usernames listed above using the default password.',
    });
  } catch (error) {
    console.error('Import error:', error);
    return NextResponse.json(
      {
        success: false,
        error: `Import failed: ${error instanceof Error ? error.message : 'unknown'}`,
      },
      { status: 500 },
    );
  }
}
