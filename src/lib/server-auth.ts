import fs from 'fs';
import path from 'path';
import crypto from 'crypto';
import { LocalUser } from './local-storage';
import { getCharactersFromServer } from './server-storage';
import { getDataDir } from './data-dir';

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

export function generateUserId(username: string): string {
  let hash = 0;
  const normalizedUsername = username.toLowerCase().trim();
  for (let i = 0; i < normalizedUsername.length; i++) {
    const char = normalizedUsername.charCodeAt(i);
    hash = ((hash << 5) - hash) + char;
    hash = hash & hash;
  }
  return 'user-' + Math.abs(hash).toString(36);
}

export function userExists(userId: string): boolean {
  return fs.existsSync(path.join(getDataDir(), userId, 'user.json'));
}

export function getStoredUser(userId: string): { username: string; passwordHash: string; displayName: string; recoveryPhrase?: string } | null {
  const userFile = path.join(getDataDir(), userId, 'user.json');
  if (!fs.existsSync(userFile)) return null;
  try {
    const data = JSON.parse(fs.readFileSync(userFile, 'utf8'));
    if (data.email && !data.username) {
      data.username = data.email;
    }
    return data;
  } catch {
    return null;
  }
}

export function saveUserData(userId: string, username: string, passwordHash: string, displayName: string, recoveryPhrase?: string): void {
  const userDir = path.join(getDataDir(), userId);
  if (!fs.existsSync(userDir)) fs.mkdirSync(userDir, { recursive: true });
  
  const userData: any = { username, passwordHash, displayName };
  if (recoveryPhrase) userData.recoveryPhrase = recoveryPhrase.toLowerCase().trim();
  
  fs.writeFileSync(path.join(userDir, 'user.json'), JSON.stringify(userData, null, 2), 'utf8');
}

export function authenticateUser(username: string, password: string, displayName?: string): 
  { success: boolean; user?: LocalUser; error?: string; isNewUser?: boolean } {
  const normalizedUsername = username.toLowerCase().trim();
  const userId = generateUserId(normalizedUsername);
  const passwordHash = hashPassword(password);

  if (userExists(userId)) {
    const storedUser = getStoredUser(userId);
    if (!storedUser) return { success: false, error: 'Failed to read user data.' };
    if (storedUser.passwordHash !== passwordHash) return { success: false, error: 'Incorrect password.' };
    
    return {
      success: true,
      isNewUser: false,
      user: { uid: userId, username: storedUser.username, displayName: storedUser.displayName, hasRecoveryPhrase: !!storedUser.recoveryPhrase }
    };
  } else {
    const finalDisplayName = displayName || normalizedUsername.split('@')[0];
    saveUserData(userId, normalizedUsername, passwordHash, finalDisplayName);
    return {
      success: true,
      isNewUser: true,
      user: { uid: userId, username: normalizedUsername, displayName: finalDisplayName, hasRecoveryPhrase: false }
    };
  }
}

export function verifyRecovery(username: string, words: string[], recoveryPhraseInput: string): 
  { success: boolean; user?: LocalUser; error?: string } {
  const normalizedUsername = username.toLowerCase().trim();
  const userId = generateUserId(normalizedUsername);

  if (!userExists(userId)) return { success: false, error: 'No account found with this username/email.' };
  const storedUser = getStoredUser(userId);
  if (!storedUser) return { success: false, error: 'Failed to read user data.' };
  if (!storedUser.recoveryPhrase) return { success: false, error: 'No recovery phrase set for this account.' };

  const characters = getCharactersFromServer(userId);
  if (characters.length === 0) return { success: false, error: 'No character sheets found locally. Cannot verify ownership.' };

  const characterDataString = JSON.stringify(characters);
  for (const word of words) {
    const cleanWord = word.toLowerCase().trim();
    if (!cleanWord) return { success: false, error: 'Please provide valid words.' };
    const escapedWord = cleanWord.replace(/[.*+?^${}()|[\]]/g, '$&');
    if (!new RegExp(`\\b${escapedWord}\\b`, 'i').test(characterDataString)) {
      return { success: false, error: `The word "${word}" was not found in any of your character sheets.` };
    }
  }

  if (!checkPhraseMatch(storedUser.recoveryPhrase, recoveryPhraseInput)) {
    return { success: false, error: 'Recovery phrase does not match. (At least one word must match, order does not matter).' };
  }

  return {
    success: true,
    user: { uid: userId, username: storedUser.username, displayName: storedUser.displayName, hasRecoveryPhrase: true }
  };
}

export function updateRecoveryCredentials(username: string, newPassword: string, newRecoveryPhrase: string): 
  { success: boolean; error?: string } {
  const userId = generateUserId(username.toLowerCase().trim());
  if (!userExists(userId)) return { success: false, error: 'User not found.' };

  try {
    const userFile = path.join(getDataDir(), userId, 'user.json');
    const userData = JSON.parse(fs.readFileSync(userFile, 'utf8'));
    userData.passwordHash = hashPassword(newPassword);
    userData.recoveryPhrase = newRecoveryPhrase.toLowerCase().trim();
    if (userData.email) {
       delete userData.email;
    }
    userData.username = username.toLowerCase().trim();
    fs.writeFileSync(userFile, JSON.stringify(userData, null, 2), 'utf8');
    return { success: true };
  } catch (e) {
    console.error('Error updating recovery credentials:', e);
    return { success: false, error: 'Failed to update account.' };
  }
}

export function setRecoveryPhrase(userId: string, phrase: string): boolean {
  try {
    const userFile = path.join(getDataDir(), userId, 'user.json');
    const userData = JSON.parse(fs.readFileSync(userFile, 'utf8'));
    userData.recoveryPhrase = phrase.toLowerCase().trim();
    fs.writeFileSync(userFile, JSON.stringify(userData, null, 2), 'utf8');
    return true;
  } catch (e) {
    console.error('Error setting recovery phrase:', e);
    return false;
  }
}

export function recoverPasswordWithUsernameAndWords(username: string, words: string[], newPassword: string): { success: boolean; error?: string } {
  const normalizedUsername = username.toLowerCase().trim();
  const userId = generateUserId(normalizedUsername);

  if (!userExists(userId)) return { success: false, error: 'No account found with this username/email.' };
  
  const storedUser = getStoredUser(userId);
  if (!storedUser) return { success: false, error: 'Failed to read user data.' };
  if (!storedUser.recoveryPhrase) return { success: false, error: 'No recovery phrase set for this account.' };

  const characters = getCharactersFromServer(userId);
  if (characters.length === 0) return { success: false, error: 'No character sheets found locally. Cannot verify ownership.' };

  const characterDataString = JSON.stringify(characters);
  for (const word of words) {
    const cleanWord = word.toLowerCase().trim();
    if (!cleanWord) return { success: false, error: 'Please provide valid words.' };
    const escapedWord = cleanWord.replace(/[.*+?^${}()|[\]]/g, '$&');
    if (!new RegExp(`\\b${escapedWord}\\b`, 'i').test(characterDataString)) {
      return { success: false, error: `The word "${word}" was not found in any of your character sheets.` };
    }
  }

  try {
    const userFile = path.join(getDataDir(), userId, 'user.json');
    const userData = JSON.parse(fs.readFileSync(userFile, 'utf8'));
    userData.passwordHash = hashPassword(newPassword);
    if (userData.email) {
       delete userData.email;
    }
    userData.username = normalizedUsername;
    fs.writeFileSync(userFile, JSON.stringify(userData, null, 2), 'utf8');
    return { success: true };
  } catch (e) {
    console.error('Error resetting password:', e);
    return { success: false, error: 'Failed to reset password.' };
  }
}

// ... [keep all existing code above] ...

// ... [keep all existing code above] ...

// 🎯 LANDMARK: UPDATE_USER_PROFILE_FUNCTION (IMPROVED ERROR HANDLING)
export function updateUserProfile(
  currentUserId: string,
  newUsername: string,
  newDisplayName: string,
  newPassword?: string,
  newRecoveryPhrase?: string
): { success: boolean; user?: LocalUser; error?: string } {
  const userDir = path.join(getDataDir(), currentUserId);
  const userFile = path.join(userDir, 'user.json');
  
  if (!fs.existsSync(userFile)) {
    return { success: false, error: 'User not found.' };
  }

  try {
    const userData = JSON.parse(fs.readFileSync(userFile, 'utf8'));
    
    const normalizedNewUsername = newUsername.toLowerCase().trim();
    const newUserId = generateUserId(normalizedNewUsername);
    
    let finalUserId = currentUserId;
    let finalUserDir = userDir;
    
    // If login changes, we need to migrate to a new directory
    if (newUserId !== currentUserId) {
      const newUserDir = path.join(getDataDir(), newUserId);
      
      // Check if new directory already exists (another user with this login)
      if (fs.existsSync(newUserDir)) {
        return { success: false, error: 'This login is already taken.' };
      }
      
      try {
        // Create new directory
        fs.mkdirSync(newUserDir, { recursive: true });
        
        // Copy ALL files from old directory to new directory
        const files = fs.readdirSync(userDir);
        for (const file of files) {
          const oldPath = path.join(userDir, file);
          const newPath = path.join(newUserDir, file);
          const stat = fs.statSync(oldPath);
          
          if (stat.isFile()) {
            fs.copyFileSync(oldPath, newPath);
          } else if (stat.isDirectory()) {
            // Recursively copy directories (in case there are subdirectories)
            fs.cpSync(oldPath, newPath, { recursive: true });
          }
        }
        
        // Delete old directory
        fs.rmSync(userDir, { recursive: true, force: true });
        
        finalUserId = newUserId;
        finalUserDir = newUserDir;
      } catch (migrationError) {
        console.error('Migration error:', migrationError);
        // If migration fails, continue with the old directory
        finalUserId = currentUserId;
        finalUserDir = userDir;
      }
    }

    const updatedUserFile = path.join(finalUserDir, 'user.json');
    
    // Use the data we already read, no need to re-read the file
    const updatedData: any = {
      username: normalizedNewUsername,
      displayName: newDisplayName.trim(),
      passwordHash: userData.passwordHash,
    };
    
    if (newPassword && newPassword.trim().length > 0) {
      updatedData.passwordHash = hashPassword(newPassword);
    }
    
    if (newRecoveryPhrase !== undefined) {
      if (newRecoveryPhrase.trim() === '') {
        delete updatedData.recoveryPhrase;
      } else {
        updatedData.recoveryPhrase = newRecoveryPhrase.toLowerCase().trim();
      }
    } else if (userData.recoveryPhrase) {
      updatedData.recoveryPhrase = userData.recoveryPhrase;
    }

    fs.writeFileSync(updatedUserFile, JSON.stringify(updatedData, null, 2), 'utf8');

    return {
      success: true,
      user: {
        uid: finalUserId,
        username: normalizedNewUsername,
        displayName: newDisplayName.trim(),
        hasRecoveryPhrase: !!updatedData.recoveryPhrase
      }
    };
  } catch (e) {
    console.error('Error updating user profile:', e);
    return { success: false, error: `Failed to update profile: ${e instanceof Error ? e.message : 'Unknown error'}` };
  }
}