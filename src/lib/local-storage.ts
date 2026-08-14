import { Character } from '@/lib/types';

// Simple user type for local storage
export interface LocalUser {
  uid: string;
  email: string;
  displayName: string;
}

// Local storage keys
const STORAGE_KEYS = {
  USER: 'digital_charsheets_user',
  CHARACTERS: 'digital_charsheets_characters',
};

// Generate a simple unique ID
function generateId(): string {
  return Date.now().toString(36) + Math.random().toString(36).substr(2);
}

// User management
export function getLocalUser(): LocalUser | null {
  if (typeof window === 'undefined') return null;
  const userStr = localStorage.getItem(STORAGE_KEYS.USER);
  return userStr ? JSON.parse(userStr) : null;
}

export function setLocalUser(user: LocalUser): void {
  localStorage.setItem(STORAGE_KEYS.USER, JSON.stringify(user));
}

export function clearLocalUser(): void {
  localStorage.removeItem(STORAGE_KEYS.USER);
}

// Character management
export function getLocalCharacters(): Character[] {
  if (typeof window === 'undefined') return [];
  const charsStr = localStorage.getItem(STORAGE_KEYS.CHARACTERS);
  return charsStr ? JSON.parse(charsStr) : [];
}

export function saveLocalCharacters(characters: Character[]): void {
  localStorage.setItem(STORAGE_KEYS.CHARACTERS, JSON.stringify(characters));
}

export function addLocalCharacter(character: Omit<Character, 'id' | 'userId'>): Character {
  const characters = getLocalCharacters();
  const user = getLocalUser();
  
  const newCharacter: Character = {
    ...character,
    id: generateId(),
    userId: user?.uid || 'local',
  } as Character;
  
  characters.push(newCharacter);
  saveLocalCharacters(characters);
  
  return newCharacter;
}

export function updateLocalCharacter(id: string, data: Partial<Character>): void {
  const characters = getLocalCharacters();
  const index = characters.findIndex(c => c.id === id);
  
  if (index !== -1) {
    characters[index] = { ...characters[index], ...data };
    saveLocalCharacters(characters);
  }
}

export function deleteLocalCharacter(id: string): void {
  const characters = getLocalCharacters();
  const filtered = characters.filter(c => c.id !== id);
  saveLocalCharacters(filtered);
}