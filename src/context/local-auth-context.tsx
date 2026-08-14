'use client';

import React, { createContext, useContext, ReactNode, useState, useEffect } from 'react';
import { LocalUser, getLocalUser, setLocalUser, clearLocalUser } from '@/lib/local-storage';

interface LocalAuthContextType {
  user: LocalUser | null;
  isUserLoading: boolean;
  login: (email: string, password: string, displayName?: string) => Promise<{ success: boolean; error?: string; isNewUser?: boolean }>;
  logout: () => void;
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
        return { success: true, isNewUser: data.isNewUser };
      }
      
      return { success: false, error: data.error || 'Login failed.' };
    } catch (error) {
      return { success: false, error: 'Failed to connect to server.' };
    }
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