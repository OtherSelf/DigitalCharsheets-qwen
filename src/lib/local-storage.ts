import { Character } from '@/lib/types';
import type { UserRole } from '@/lib/user-role';

/**
 * Снимок профиля для UI. Это НЕ источник прав: `role`/`isBlocked` здесь нужны
 * только чтобы показать пункт «Админка» и предупреждение о стартовом пароле.
 * Сервер проверяет роль по `user.json` на каждом административном запросе,
 * поэтому подмена localStorage доступа не даёт.
 */
export interface LocalUser {
  uid: string;
  username: string;
  displayName: string;
  hasRecoveryPhrase: boolean; // Needed for UI to know if prompt is required
  role?: UserRole;
  isBlocked?: boolean;
  /** Пароль был сгенерирован при первом запуске — стоит сменить. */
  mustChangePassword?: boolean;
}

const STORAGE_KEYS = {
  USER: 'digital_charsheets_user',
  CHARACTERS: 'digital_charsheets_characters', // Kept for your existing local fallback logic
};

function generateId(): string {
  return Date.now().toString(36) + Math.random().toString(36).substr(2);
}

export function getLocalUser(): LocalUser | null {
  if (typeof window === 'undefined') return null;
  const userStr = localStorage.getItem(STORAGE_KEYS.USER);
  if (!userStr) return null;
  const user = JSON.parse(userStr);
  // Backward compatibility: map old 'email' field to 'username'
  if (user.email && !user.username) {
    user.username = user.email;
  }
  return user;
}

export function setLocalUser(user: LocalUser): void {
  localStorage.setItem(STORAGE_KEYS.USER, JSON.stringify(user));
}

export function clearLocalUser(): void {
  localStorage.removeItem(STORAGE_KEYS.USER);
}

/**
 * Полная очистка локальных данных аккаунта: снимок профиля И локальные листы.
 *
 * Обычному выходу (`clearLocalUser`) этого не нужно — листы остаются на
 * сервере. А после удаления аккаунта localStorage не должен хранить даже
 * устаревший снимок: аккаунта больше нет, восстанавливать его «из кеша» нельзя.
 */
export function clearLocalAccountData(): void {
  if (typeof window === 'undefined') return;
  localStorage.removeItem(STORAGE_KEYS.USER);
  localStorage.removeItem(STORAGE_KEYS.CHARACTERS);
}

// (Keep your existing getLocalCharacters, saveLocalCharacters, addLocalCharacter, etc. exactly as you had them)
export function getLocalCharacters(): Character[] {
  if (typeof window === 'undefined') return [];
  const charsStr = localStorage.getItem(STORAGE_KEYS.CHARACTERS);
  return charsStr ? JSON.parse(charsStr) : [];
}

export function saveLocalCharacters(characters: Character[]): void {
  localStorage.setItem(STORAGE_KEYS.CHARACTERS, JSON.stringify(characters));
}

export function addLocalCharacter(character: Omit<Character, 'id'>): Character {
  const characters = getLocalCharacters();
  const newCharacter: Character = {
    ...character,
    id: generateId(),
  } as Character;
  characters.push(newCharacter);
  saveLocalCharacters(characters);
  return newCharacter;
}

export function updateLocalCharacter(
  id: string,
  data: Partial<Character>,
): void {
  const characters = getLocalCharacters();
  const index = characters.findIndex((c) => c.id === id);
  if (index !== -1) {
    characters[index] = { ...characters[index], ...data } as Character;
    saveLocalCharacters(characters);
  }
}

export function deleteLocalCharacter(id: string): void {
  const characters = getLocalCharacters();
  const filtered = characters.filter((c) => c.id !== id);
  saveLocalCharacters(filtered);
}
