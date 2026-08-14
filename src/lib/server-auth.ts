import fs from 'fs';
import path from 'path';
import crypto from 'crypto';
import { LocalUser } from './local-storage';

const DATA_DIR = path.join(process.cwd(), 'data');

// Hash password using SHA-256
function hashPassword(password: string): string {
  return crypto.createHash('sha256').update(password).digest('hex');
}

// Generate consistent user ID from email
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

// Check if a user exists
export function userExists(userId: string): boolean {
  const userDir = path.join(DATA_DIR, userId);
  const userFile = path.join(userDir, 'user.json');
  return fs.existsSync(userFile);
}

// Get stored user data
export function getStoredUser(userId: string): { email: string; passwordHash: string; displayName: string } | null {
  const userFile = path.join(DATA_DIR, userId, 'user.json');
  
  if (!fs.existsSync(userFile)) {
    return null;
  }
  
  try {
    const data = fs.readFileSync(userFile, 'utf8');
    return JSON.parse(data);
  } catch {
    return null;
  }
}

// Save user data
export function saveUserData(userId: string, email: string, passwordHash: string, displayName: string): void {
  const userDir = path.join(DATA_DIR, userId);
  
  if (!fs.existsSync(userDir)) {
    fs.mkdirSync(userDir, { recursive: true });
  }
  
  const userFile = path.join(userDir, 'user.json');
  const userData = { email, passwordHash, displayName };
  
  fs.writeFileSync(userFile, JSON.stringify(userData, null, 2), 'utf8');
}

// Authenticate or create user
export function authenticateUser(email: string, password: string, displayName?: string): 
  { success: boolean; user?: LocalUser; error?: string; isNewUser?: boolean } {
  
  const normalizedEmail = email.toLowerCase().trim();
  const userId = generateUserIdFromEmail(normalizedEmail);
  const passwordHash = hashPassword(password);
  
  if (userExists(userId)) {
    // User exists - verify password
    const storedUser = getStoredUser(userId);
    
    if (!storedUser) {
      return { success: false, error: 'Failed to read user data.' };
    }
    
    if (storedUser.passwordHash !== passwordHash) {
      return { success: false, error: 'Incorrect password.' };
    }
    
    // Password correct - login successful
    return {
      success: true,
      isNewUser: false,
      user: {
        uid: userId,
        email: storedUser.email,
        displayName: storedUser.displayName,
      }
    };
  } else {
    // User doesn't exist - create new account
    const finalDisplayName = displayName || normalizedEmail.split('@')[0];
    saveUserData(userId, normalizedEmail, passwordHash, finalDisplayName);
    
    return {
      success: true,
      isNewUser: true,
      user: {
        uid: userId,
        email: normalizedEmail,
        displayName: finalDisplayName,
      }
    };
  }
}