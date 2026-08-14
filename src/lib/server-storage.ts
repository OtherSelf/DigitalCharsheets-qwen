import fs from 'fs';
import path from 'path';
import { Character } from './types';

const DATA_DIR = path.join(process.cwd(), 'data');

// Ensure a user's data directory exists
function ensureUserDir(userId: string): string {
  const userDir = path.join(DATA_DIR, userId);
  if (!fs.existsSync(userDir)) {
    fs.mkdirSync(userDir, { recursive: true });
  }
  return userDir;
}

// Ensure a user's characters directory exists
function ensureCharactersDir(userId: string): string {
  const userDir = ensureUserDir(userId);
  const charsDir = path.join(userDir, 'characters');
  if (!fs.existsSync(charsDir)) {
    fs.mkdirSync(charsDir, { recursive: true });
  }
  return charsDir;
}

// READ: Get all characters for a user (reads individual files)
export function getCharactersFromServer(userId: string): Character[] {
  const charsDir = ensureCharactersDir(userId);
  const characters: Character[] = [];

  try {
    const files = fs.readdirSync(charsDir).filter(f => f.endsWith('.json'));
    for (const file of files) {
      try {
        const content = fs.readFileSync(path.join(charsDir, file), 'utf8');
        const char = JSON.parse(content) as Character;
        characters.push(char);
      } catch (e) {
        console.error(`Error reading character file ${file}:`, e);
      }
    }
  } catch (e) {
    console.error(`Error reading characters directory for ${userId}:`, e);
  }

  return characters;
}

// WRITE: Save a single character to its own file
export function saveCharacterToServer(userId: string, character: Character): void {
  const charsDir = ensureCharactersDir(userId);
  const filePath = path.join(charsDir, `${character.id}.json`);
  fs.writeFileSync(filePath, JSON.stringify(character, null, 2), 'utf8');
}

// WRITE: Save multiple characters (used during import)
export function saveCharactersToServer(userId: string, characters: Character[]): void {
  for (const char of characters) {
    saveCharacterToServer(userId, char);
  }
}

// UPDATE: Update a specific character file
export function updateCharacterOnServer(userId: string, characterId: string, data: Partial<Character>): Character | null {
  const charsDir = ensureCharactersDir(userId);
  const filePath = path.join(charsDir, `${characterId}.json`);

  if (!fs.existsSync(filePath)) return null;

  try {
    const content = fs.readFileSync(filePath, 'utf8');
    const character = JSON.parse(content) as Character;
    const updated = { ...character, ...data };
    fs.writeFileSync(filePath, JSON.stringify(updated, null, 2), 'utf8');
    return updated;
  } catch (e) {
    console.error(`Error updating character ${characterId}:`, e);
    return null;
  }
}

// DELETE: Remove a character file
export function deleteCharacterFromServer(userId: string, characterId: string): boolean {
  const charsDir = ensureCharactersDir(userId);
  const filePath = path.join(charsDir, `${characterId}.json`);

  if (!fs.existsSync(filePath)) return false;

  try {
    fs.unlinkSync(filePath);
    return true;
  } catch (e) {
    console.error(`Error deleting character ${characterId}:`, e);
    return false;
  }
}

// Check if a user exists
export function userFolderExists(userId: string): boolean {
  return fs.existsSync(path.join(DATA_DIR, userId));
}

// Create a user folder with user.json
export function createUserFolder(userId: string, email: string, displayName: string): void {
  const userDir = ensureUserDir(userId);
  const userFile = path.join(userDir, 'user.json');
  
  if (!fs.existsSync(userFile)) {
    const userData = { email, displayName, passwordHash: '' };
    fs.writeFileSync(userFile, JSON.stringify(userData, null, 2), 'utf8');
  }
}