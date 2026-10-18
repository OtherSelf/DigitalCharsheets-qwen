'use client';

import React, { createContext, useContext, ReactNode, useState, useEffect } from 'react';
import { LocalUser, getLocalUser, setLocalUser, clearLocalUser } from '@/lib/local-storage';

interface LoginResult {
  success: boolean;
  error?: string;
  isNewUser?: boolean;
  user?: LocalUser;
}

interface LocalAuthContextType {
  user: LocalUser | null;
  isUserLoading: boolean;
  login: (email: string, password: string, displayName?: string) => Promise<LoginResult>;
  logout: () => void;
  restoreSession: (user: LocalUser) => void; // 🆕 LANDMARK: used by recovery flow
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

  // 🆕 LANDMARK: single source of truth for persisting + setting the session
  const restoreSession = (nextUser: LocalUser) => {
    setLocalUser(nextUser);
    setUser(nextUser);
  };

  const login = async (email: string, password: string, displayName?: string): Promise<LoginResult> => {
    try {
      const res = await fetch('/api/auth', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email, password, displayName }),
      });

      const data = await res.json().catch(() => null);

      if (!res.ok || !data?.success || !data?.user) {
        return {
          success: false,
          error: data?.error || `Server returned an error (${res.status}).`,
        };
      }

      restoreSession(data.user);
      return { success: true, isNewUser: data.isNewUser, user: data.user };
    } catch (error) {
      console.error('[auth] login failed:', error);
      return { success: false, error: 'Failed to connect to server.' };
    }
  };

  const logout = () => {
    clearLocalUser();
    setUser(null);
  };

  const updateUserPhrase = (hasPhrase: boolean) => {
    const current = user ?? getLocalUser();
    if (!current) return;

    const updated: LocalUser = { ...current, hasRecoveryPhrase: hasPhrase };
    setLocalUser(updated);
    setUser(updated);
  };

  return (
    <LocalAuthContext.Provider
      value={{ user, isUserLoading, login, logout, restoreSession, updateUserPhrase }}
    >
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