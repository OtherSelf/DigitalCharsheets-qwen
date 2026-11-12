import crypto from 'crypto';
import fs from 'fs';
import path from 'path';

import { NextResponse } from 'next/server';

import { listGameModules } from '@/games/registry';
import { normalizeCharacterRecord } from '@/lib/character-version';
import { getCharactersDir, getDataDir } from '@/lib/data-dir';
import { createImportedUser } from '@/lib/server-auth';

function importFilePath(): string {
  return path.join(getDataDir(), 'import-source.json');
}
const DEFAULT_PASSWORD = '1234'; // Default password for all imported users

// ─── CLEANING UTILITIES ────────────────────────────────────────────

function cleanObject(obj: any): any {
  if (obj === null || obj === undefined) return obj;
  if (typeof obj === 'string') return obj.trim();
  if (typeof obj === 'number' || typeof obj === 'boolean') return obj;
  if (Array.isArray(obj)) return obj.map((item) => cleanObject(item));
  if (typeof obj === 'object') {
    const cleaned: any = {};
    for (const [key, value] of Object.entries(obj)) {
      const cleanKey = key.trim();
      cleaned[cleanKey] = cleanObject(value);
    }
    return cleaned;
  }
  return obj;
}

function hashPassword(password: string): string {
  return crypto.createHash('sha256').update(password).digest('hex');
}

function generateId(): string {
  return Date.now().toString(36) + Math.random().toString(36).substr(2);
}

// ─── IMPORT HANDLER (GET request - just visit the URL) ─────────────

export async function GET() {
  try {
    // Check if import file exists
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

    // Read the import file
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

    // Step 1: Clean all data
    const cleanedData = rawData.map((char: any) => cleanObject(char));

    // Step 2: Group by Firebase user ID
    const userGroups: Record<string, any[]> = {};
    for (const char of cleanedData) {
      const docId = char['Document ID'] || '';
      const match = docId.match(/\/users\/([^\/]+)\/characterSheets\//);
      if (match) {
        const firebaseUserId = match[1];
        if (!userGroups[firebaseUserId]) userGroups[firebaseUserId] = [];
        userGroups[firebaseUserId].push(char);
      }
    }

    // Step 3: Process each user
    const results: any[] = [];
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

      // Process each character
      const importedChars: any[] = [];
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

        // Write individual character file
        const character = normalizeCharacterRecord(converted).character;
        const charFile = path.join(charsDir, `${character.id}.json`);
        fs.writeFileSync(charFile, JSON.stringify(character, null, 2), 'utf8');
        importedChars.push({
          name: character.name,
          system: character.gameSystem,
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

    // Step 4: Delete the import file after success
    fs.unlinkSync(IMPORT_FILE);

    return NextResponse.json({
      success: true,
      message: `Import complete! ${totalImported} characters imported across ${results.length} user accounts.`,
      defaultPassword: DEFAULT_PASSWORD,
      users: results,
      note: 'The import-source.json file has been deleted. You can now log in with the usernames listed above using the default password.',
    });
  } catch (error: any) {
    console.error('Import error:', error);
    return NextResponse.json(
      {
        success: false,
        error: `Import failed: ${error.message}`,
      },
      { status: 500 },
    );
  }
}
