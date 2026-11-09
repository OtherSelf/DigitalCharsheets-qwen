'use client';

import React, {
  createContext,
  ReactNode,
  useCallback,
  useContext,
  useEffect,
  useState,
} from 'react';

import {
  clearLocalAccountData,
  clearLocalUser,
  getLocalUser,
  LocalUser,
  setLocalUser,
} from '@/lib/local-storage';

/**
 * ─── LANDMARK: AUTH CONTEXT (cookie-сессия) ─────────────────────────────────
 * Источник истины сессии — подписанная httpOnly-cookie, которую ставит
 * `/api/auth`. В localStorage остаётся только снимок профиля для UI (uid,
 * логин, displayName, флаг recovery-фразы): он не даёт доступа к данным и
 * при расхождении с сервером (401) сбрасывается.
 */

interface LoginResult {
  success: boolean;
  error?: string;
  isNewUser?: boolean;
  user?: LocalUser;
  /** Причина отказа от API: no_account / invalid_password / exists / … */
  reason?: string;
}

interface AccountExistsResult {
  exists: boolean;
  error?: string;
}

/**
 * ─── LANDMARK: LAST AUTH KIND ───────────────────────────────────────────────
 * Чем закончилась последняя авторизация в этой вкладке: `register` — создан
 * новый аккаунт, `login` — вход в существующий, `restore` — восстановление
 * доступа по фразе.
 *
 * Зачем это знать: черновик персонажа, сделанный до входа, имеет смысл
 * создавать только в новом аккаунте. При входе в существующий он остаётся
 * черновиком и показывается плашкой на дашборде — иначе приложение молча
 * добавляло «нового» персонажа и выглядело так, будто список потерян.
 */
export type LastAuthKind = 'register' | 'login' | 'restore';

interface LocalAuthContextType {
  user: LocalUser | null;
  isUserLoading: boolean;
  /** `null` — вкладку открыли с уже сохранённой сессией, авторизации не было. */
  lastAuthKind: LastAuthKind | null;
  login: (
    username: string,
    password: string,
    displayName?: string,
  ) => Promise<LoginResult>;
  register: (
    username: string,
    password: string,
    displayName: string,
    recoveryPhrase: string,
  ) => Promise<LoginResult>;
  accountExists: (username: string) => Promise<AccountExistsResult>;
  /**
   * Удалить СВОЙ аккаунт. Требует текущий пароль; при успехе сервер стирает
   * каталог и cookie, а контекст — локальный снимок профиля.
   */
  deleteAccount: (password: string) => Promise<LoginResult>;
  logout: () => void;
  restoreSession: (user: LocalUser) => void; // LANDMARK: used by recovery flow
  updateUserPhrase: (hasPhrase: boolean) => void;
}

const LocalAuthContext = createContext<LocalAuthContextType | undefined>(
  undefined,
);

export function LocalAuthProvider({ children }: { children: ReactNode }) {
  const [user, setUser] = useState<LocalUser | null>(null);
  const [isUserLoading, setIsUserLoading] = useState(true);
  const [lastAuthKind, setLastAuthKind] = useState<LastAuthKind | null>(null);

  useEffect(() => {
    const storedUser = getLocalUser();
    setUser(storedUser);
    setIsUserLoading(false);
  }, []);

  // LANDMARK: single source of truth for persisting + setting the session
  const restoreSession = useCallback((nextUser: LocalUser) => {
    setLocalUser(nextUser);
    setUser(nextUser);
    // login/register зовут restoreSession и перебивают вид своим значением
    // в том же тике — сюда попадает только восстановление по фразе.
    setLastAuthKind('restore');
  }, []);

  const login = useCallback(
    async (
      username: string,
      password: string,
      displayName?: string,
    ): Promise<LoginResult> => {
      try {
        const res = await fetch('/api/auth', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ username, password, displayName }),
        });

        const data = await res.json().catch(() => null);

        if (!res.ok || !data?.success || !data?.user) {
          return {
            success: false,
            error: data?.error || `Server returned an error (${res.status}).`,
            reason: data?.reason,
          };
        }

        restoreSession(data.user);
        setLastAuthKind('login');
        return { success: true, isNewUser: data.isNewUser, user: data.user };
      } catch (error) {
        console.error('[auth] login failed:', error);
        return { success: false, error: 'Failed to connect to server.' };
      }
    },
    [restoreSession],
  );

  /**
   * Явная регистрация через /api/auth/register. В отличие от login, занятый
   * логин — ошибка (`reason: 'exists'`), а не вход в чужой аккаунт.
   */
  const register = useCallback(
    async (
      username: string,
      password: string,
      displayName: string,
      recoveryPhrase: string,
    ): Promise<LoginResult> => {
      try {
        const res = await fetch('/api/auth/register', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            username,
            password,
            displayName,
            recoveryPhrase,
          }),
        });

        const data = await res.json().catch(() => null);

        if (!res.ok || !data?.success || !data?.user) {
          return {
            success: false,
            error: data?.error || `Server returned an error (${res.status}).`,
            reason: data?.reason,
          };
        }

        restoreSession(data.user);
        setLastAuthKind('register');
        return { success: true, isNewUser: true, user: data.user };
      } catch (error) {
        console.error('[auth] registration failed:', error);
        return { success: false, error: 'Failed to connect to server.' };
      }
    },
    [restoreSession],
  );

  /** Проверка существования аккаунта (для страницы /login). */
  const accountExists = useCallback(
    async (username: string): Promise<AccountExistsResult> => {
      try {
        const res = await fetch('/api/auth/exists', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ username }),
        });
        const data = await res.json().catch(() => null);
        if (!res.ok || !data?.success) {
          return {
            exists: false,
            error: data?.error || `Server returned an error (${res.status}).`,
          };
        }
        return { exists: !!data.exists };
      } catch (error) {
        console.error('[auth] account check failed:', error);
        return { exists: false, error: 'Failed to connect to server.' };
      }
    },
    [],
  );

  /**
   * ─── LANDMARK: DELETE ACCOUNT (client) ─────────────────────────────────────
   * Пароль уходит на сервер для повторной аутентификации; одной cookie мало.
   * При успехе сервер уже стёр cookie и каталог данных, поэтому здесь только
   * чистим локальный снимок профиля (и устаревшие локальные листы) — иначе
   * приложение продолжило бы показывать «удалённого» пользователя до reload.
   */
  const deleteAccount = useCallback(
    async (password: string): Promise<LoginResult> => {
      try {
        const res = await fetch('/api/auth/profile', {
          method: 'DELETE',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ password }),
        });

        const data = await res.json().catch(() => null);

        if (!res.ok || !data?.success) {
          return {
            success: false,
            error: data?.error || `Server returned an error (${res.status}).`,
            reason: data?.reason,
          };
        }

        clearLocalAccountData();
        setUser(null);
        setLastAuthKind(null);
        return { success: true };
      } catch (error) {
        console.error('[auth] account deletion failed:', error);
        return { success: false, error: 'Failed to connect to server.' };
      }
    },
    [],
  );

  const logout = useCallback(() => {
    // Стираем cookie на сервере; локальный снимок — в любом случае.
    try {
      void fetch('/api/auth/logout', { method: 'POST' }).catch(() => undefined);
    } catch {
      // Сеть недоступна — cookie истечёт сама, локальный профиль уже чистим.
    }
    clearLocalUser();
    setUser(null);
    setLastAuthKind(null);
  }, []);

  const updateUserPhrase = useCallback(
    (hasPhrase: boolean) => {
      const current = user ?? getLocalUser();
      if (!current) return;

      const updated: LocalUser = { ...current, hasRecoveryPhrase: hasPhrase };
      setLocalUser(updated);
      setUser(updated);
    },
    [user],
  );

  return (
    <LocalAuthContext.Provider
      value={{
        user,
        isUserLoading,
        lastAuthKind,
        login,
        register,
        accountExists,
        deleteAccount,
        logout,
        restoreSession,
        updateUserPhrase,
      }}
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
