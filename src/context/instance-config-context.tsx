'use client';

import { createContext, useContext, type ReactNode } from 'react';

/**
 * ─── LANDMARK: INSTANCE CONFIG (CLIENT) ────────────────────────────────────
 * Публичная часть настроек инстанса, которую серверный layout кладёт в
 * провайдер: клиенту нужно знать, включена ли политика и условия, открыта ли
 * регистрация и какой возраст указан в политике.
 *
 * Здесь только то, что не является секретом и не меняется между запросами
 * одного рендера. Реквизиты оператора и текст политики остаются на сервере:
 * страница `/privacy` собирает их и отдаёт уже готовым.
 */
export interface PublicInstanceConfig {
  privacy: { enabled: boolean; version: string };
  terms: { enabled: boolean };
  registration: { open: boolean };
  access: { loginRestrictedToStaff: boolean };
  ageMinimum: number;
}

const FALLBACK: PublicInstanceConfig = {
  privacy: { enabled: true, version: '' },
  terms: { enabled: false },
  registration: { open: true },
  access: { loginRestrictedToStaff: false },
  ageMinimum: 16,
};

const InstanceConfigContext = createContext<PublicInstanceConfig>(FALLBACK);

export function InstanceConfigProvider({
  config,
  children,
}: {
  config: PublicInstanceConfig;
  children: ReactNode;
}) {
  return (
    <InstanceConfigContext.Provider value={config}>
      {children}
    </InstanceConfigContext.Provider>
  );
}

export function useInstanceConfig(): PublicInstanceConfig {
  return useContext(InstanceConfigContext);
}
