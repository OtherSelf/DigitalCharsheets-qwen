import fs from 'fs';
import path from 'path';
import crypto from 'crypto';
import { LocalUser } from './local-storage';
import { getCharactersFromServer } from './server-storage';

const DATA_DIR = path.join(process.cwd(), 'data');

function hashPassword(password: string): string {
  return crypto.createHash('sha256').update(password).digest('hex');
}

function normalizePhrase(phrase: string): string[] {
  return phrase.toLowerCase().trim().split(/\s+/).filter(w => w.length > 0);
}

function checkPhraseMatch(storedPhrase: string, inputPhrase: string): boolean {
  const storedWords = normalizePhrase(storedPhrase);
  const inputWords = normalizePhrase(inputPhrase);
  return inputWords.some(word => storedWords.includes(word));
}

export function generateUserIdFromEmail(email: string): string {
  let hash = 0;
  const normalizedEmail = email.toLowerCase().trim();
  for (let i = 0; i < normalizedEmail.length; i++) {
    const char = normalizedEmail.charCodeAt(i);
    hash = ((hash << 5) - hash) + char;
    hash = hash & hash;
  }
  return 'user-' + Math.abs(hash).toString(36);
}

export function userExists(userId: string): boolean {
  return fs.existsSync(path.join(DATA_DIR, userId, 'user.json'));
}

export function getStoredUser(userId: string): { email: string; passwordHash: string; displayName: string; recoveryPhrase?: string } | null {
  const userFile = path.join(DATA_DIR, userId, 'user.json');
  if (!fs.existsSync(userFile)) return null;
  try {
    return JSON.parse(fs.readFileSync(userFile, 'utf8'));
  } catch {
    return null;
  }
}

export function saveUserData(userId: string, email: string, passwordHash: string, displayName: string, recoveryPhrase?: string): void {
  const userDir = path.join(DATA_DIR, userId);
  if (!fs.existsSync(userDir)) fs.mkdirSync(userDir, { recursive: true });
  
  const userData: any = { email, passwordHash, displayName };
  if (recoveryPhrase) userData.recoveryPhrase = recoveryPhrase.toLowerCase().trim();
  
  fs.writeFileSync(path.join(userDir, 'user.json'), JSON.stringify(userData, null, 2), 'utf8');
}

export function authenticateUser(email: string, password: string, displayName?: string): 
  { success: boolean; user?: LocalUser; error?: string; isNewUser?: boolean } {
  const normalizedEmail = email.toLowerCase().trim();
  const userId = generateUserIdFromEmail(normalizedEmail);
  const passwordHash = hashPassword(password);

  if (userExists(userId)) {
    const storedUser = getStoredUser(userId);
    if (!storedUser) return { success: false, error: 'Failed to read user data.' };
    if (storedUser.passwordHash !== passwordHash) return { success: false, error: 'Incorrect password.' };
    
    return {
      success: true,
      isNewUser: false,
      user: { uid: userId, email: storedUser.email, displayName: storedUser.displayName, hasRecoveryPhrase: !!storedUser.recoveryPhrase }
    };
  } else {
    const finalDisplayName = displayName || normalizedEmail.split('@')[0];
    saveUserData(userId, normalizedEmail, passwordHash, finalDisplayName);
    return {
      success: true,
      isNewUser: true,
      user: { uid: userId, email: normalizedEmail, displayName: finalDisplayName, hasRecoveryPhrase: false }
    };
  }
}

export function verifyRecovery(email: string, words: string[], recoveryPhraseInput: string): 
  { success: boolean; user?: LocalUser; error?: string } {
  const normalizedEmail = email.toLowerCase().trim();
  const userId = generateUserIdFromEmail(normalizedEmail);

  if (!userExists(userId)) return { success: false, error: 'No account found with this email.' };
  const storedUser = getStoredUser(userId);
  if (!storedUser) return { success: false, error: 'Failed to read user data.' };
  if (!storedUser.recoveryPhrase) return { success: false, error: 'No recovery phrase set for this account.' };

  // Reads directly from your local data/ folder
  const characters = getCharactersFromServer(userId);
  if (characters.length === 0) return { success: false, error: 'No character sheets found locally. Cannot verify ownership.' };

  const characterDataString = JSON.stringify(characters);
  for (const word of words) {
    const cleanWord = word.toLowerCase().trim();
    if (!cleanWord) return { success: false, error: 'Please provide valid words.' };
    const escapedWord = cleanWord.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
    if (!new RegExp(`\\b${escapedWord}\\b`, 'i').test(characterDataString)) {
      return { success: false, error: `The word "${word}" was not found in any of your character sheets.` };
    }
  }

  if (!checkPhraseMatch(storedUser.recoveryPhrase, recoveryPhraseInput)) {
    return { success: false, error: 'Recovery phrase does not match. (At least one word must match, order does not matter).' };
  }

  return {
    success: true,
    user: { uid: userId, email: storedUser.email, displayName: storedUser.displayName, hasRecoveryPhrase: true }
  };
}

export function updateRecoveryCredentials(email: string, newPassword: string, newRecoveryPhrase: string): 
  { success: boolean; error?: string } {
  const userId = generateUserIdFromEmail(email.toLowerCase().trim());
  if (!userExists(userId)) return { success: false, error: 'User not found.' };

  try {
    const userFile = path.join(DATA_DIR, userId, 'user.json');
    const userData = JSON.parse(fs.readFileSync(userFile, 'utf8'));
    userData.passwordHash = hashPassword(newPassword);
    userData.recoveryPhrase = newRecoveryPhrase.toLowerCase().trim();
    fs.writeFileSync(userFile, JSON.stringify(userData, null, 2), 'utf8');
    return { success: true };
  } catch (e) {
    console.error('Error updating recovery credentials:', e);
    return { success: false, error: 'Failed to update account.' };
  }
}

export function setRecoveryPhrase(userId: string, phrase: string): boolean {
  try {
    const userFile = path.join(DATA_DIR, userId, 'user.json');
    const userData = JSON.parse(fs.readFileSync(userFile, 'utf8'));
    userData.recoveryPhrase = phrase.toLowerCase().trim();
    fs.writeFileSync(userFile, JSON.stringify(userData, null, 2), 'utf8');
    return true;
  } catch (e) {
    console.error('Error setting recovery phrase:', e);
    return false;
  }
}