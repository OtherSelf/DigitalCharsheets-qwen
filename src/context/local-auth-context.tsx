'use client';

import React, { createContext, useContext, ReactNode, useState, useEffect } from 'react';
import { LocalUser, getLocalUser, setLocalUser, clearLocalUser } from '@/lib/local-storage';

interface LocalAuthContextType {
  user: LocalUser | null;
  isUserLoading: boolean;
  login: (email: string, displayName?: string) => void;
  logout: () => void;
}

const LocalAuthContext = createContext<LocalAuthContextType | undefined>(undefined);

// Generate a consistent ID based on email (same email = same ID every time)
function generateUserIdFromEmail(email: string): string {
  // Simple hash function to create a consistent ID from email
  let hash = 0;
  const normalizedEmail = email.toLowerCase().trim();
  for (let i = 0; i < normalizedEmail.length; i++) {
    const char = normalizedEmail.charCodeAt(i);
    hash = ((hash << 5) - hash) + char;
    hash = hash & hash; // Convert to 32-bit integer
  }
  return 'user-' + Math.abs(hash).toString(36);
}

export function LocalAuthProvider({ children }: { children: ReactNode }) {
  const [user, setUser] = useState<LocalUser | null>(null);
  const [isUserLoading, setIsUserLoading] = useState(true);

  useEffect(() => {
    const storedUser = getLocalUser();
    setUser(storedUser);
    setIsUserLoading(false);
  }, []);

  const login = (email: string, displayName?: string) => {
    // Generate a CONSISTENT ID based on the email
    // Same email will ALWAYS produce the same ID
    const userId = generateUserIdFromEmail(email);
    
    const newUser: LocalUser = {
      uid: userId,
      email: email.toLowerCase().trim(),
      displayName: displayName || email.split('@')[0],
    };
    
    setLocalUser(newUser);
    setUser(newUser);
  };

  const logout = () => {
    clearLocalUser();
    setUser(null);
  };

  return (
    <LocalAuthContext.Provider value={{ user, isUserLoading, login, logout }}>
      {children}
    </LocalAuthContext.Provider>
  );
}

export function useLocalAuth() {
  const context = useContext(LocalAuthContext);
  if (context === undefined) {
    throw new Error('useLocalAuth must be used within a LocalAuthProvider');
  }
  return context;
}