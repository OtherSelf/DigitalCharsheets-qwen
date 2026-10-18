'use client';

import React, { createContext, useContext, ReactNode, useState, useEffect } from 'react';
import { LocalUser, getLocalUser, setLocalUser, clearLocalUser } from '@/lib/local-storage';

interface LocalAuthContextType {
  user: LocalUser | null;
  isUserLoading: boolean;
  login: (email: string, password: string, displayName?: string) => Promise<{ success: boolean; error?: string; isNewUser?: boolean; user?: LocalUser }>;
  logout: () => void;
  updateUserPhrase: (hasPhrase: boolean) => void;
}

const LocalAuthContext = createContext<LocalAuthContextType | undefined>(undefined);

export function LocalAuthProvider({ children }: { children: ReactNode }) {
  const [user, setUser] = useState<LocalUser | null>(null);
  const [isUserLoading, setIsUserLoading] = useState(true);

  useEffect(() => {
    const storedUser = getLocalUser();
    setUser(storedUser);
    setIsUserLoading(false);
  }, []);

  const login = async (email: string, password: string, displayName?: string) => {
    try {
      const res = await fetch('/api/auth', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email, password, displayName }),
      });
      const data = await res.json();
      if (data.success && data.user) {
        setLocalUser(data.user);
        setUser(data.user);
        return { success: true, isNewUser: data.isNewUser, user: data.user };
      }
      return { success: false, error: data.error || 'Login failed.' };
    } catch (error) {
      return { success: false, error: 'Failed to connect to local server.' };
    }
  };

  const logout = () => {
    clearLocalUser();
    setUser(null);
  };

  const updateUserPhrase = (hasPhrase: boolean) => {
    if (user) {
      const updatedUser = { ...user, hasRecoveryPhrase: hasPhrase };
      setLocalUser(updatedUser);
      setUser(updatedUser);
    }
  };

  return (
    <LocalAuthContext.Provider value={{ user, isUserLoading, login, logout, updateUserPhrase }}>
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