import fs from 'fs';
import path from 'path';
import { Character } from './types';

const DATA_DIR = path.join(process.cwd(), 'data');

// Ensure a user's data directory exists
function ensureUserDir(userId: string) {
  const userDir = path.join(DATA_DIR, userId);
  if (!fs.existsSync(userDir)) {
    fs.mkdirSync(userDir, { recursive: true });
  }
  return userDir;
}

// Get the file path for a specific user's characters
function getCharactersFilePath(userId: string): string {
  const userDir = ensureUserDir(userId);
  return path.join(userDir, 'characters.json');
}

// READ: Get all characters for a specific user
export function getCharactersFromServer(userId: string): Character[] {
  const filePath = getCharactersFilePath(userId);
  
  if (!fs.existsSync(filePath)) {
    return [];
  }
  
  try {
    const fileContents = fs.readFileSync(filePath, 'utf8');
    return JSON.parse(fileContents) as Character[];
  } catch (error) {
    console.error(`Error reading characters for user ${userId}:`, error);
    return [];
  }
}

// WRITE: Save characters for a specific user
export function saveCharactersToServer(userId: string, characters: Character[]): void {
  const filePath = getCharactersFilePath(userId);
  
  try {
    fs.writeFileSync(filePath, JSON.stringify(characters, null, 2), 'utf8');
  } catch (error) {
    console.error(`Error writing characters for user ${userId}:`, error);
  }
}