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

export function LocalAuthProvider({ children }: { children: ReactNode }) {
  const [user, setUser] = useState<LocalUser | null>(null);
  const [isUserLoading, setIsUserLoading] = useState(true);

  useEffect(() => {
    const storedUser = getLocalUser();
    setUser(storedUser);
    setIsUserLoading(false);
  }, []);

  const login = (email: string, displayName?: string) => {
    const newUser: LocalUser = {
      uid: 'local-' + Date.now(),
      email,
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