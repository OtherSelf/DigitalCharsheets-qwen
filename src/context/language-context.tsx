'use client';

import React, { createContext, useContext, useEffect, useState } from 'react';

import { translations } from '@/lib/i18n';

type Language = 'en' | 'ru';

interface LanguageContextType {
  language: Language;
  setLanguage: (lang: Language) => void;
  t: (key: string) => string;
}

const LanguageContext = createContext<LanguageContextType | undefined>(
  undefined,
);

export function LanguageProvider({ children }: { children: React.ReactNode }) {
  const [language, setLanguage] = useState<Language>('en');

  useEffect(() => {
    const saved = localStorage.getItem('language') as Language;
    if (saved && (saved === 'en' || saved === 'ru')) {
      setLanguage(saved);
    }
  }, []);

  const handleSetLanguage = (lang: Language) => {
    setLanguage(lang);
    localStorage.setItem('language', lang);
  };

  const t = (key: string) => {
    const dict = translations[language];
    const direct = dict[key];
    if (direct) return direct;

    // Level 1 transition: some keys come from persisted character data or
    // server enums (e.g. `weaponSkill`, `classFighter`) and are not yet
    // rewritten to `dh.*`/`dnd.*`. Resolve a unique suffix, then level 2 can
    // remove this fallback.
    if (!key.includes('.')) {
      const suffix = `.${key}`;
      const matches = Object.keys(dict).filter((k) => k.endsWith(suffix));
      if (matches.length === 1) return dict[matches[0]];
    }
    return key;
  };

  return (
    <LanguageContext.Provider
      value={{ language, setLanguage: handleSetLanguage, t }}
    >
      {children}
    </LanguageContext.Provider>
  );
}

export const useTranslation = () => {
  const context = useContext(LanguageContext);
  if (!context) {
    throw new Error('useTranslation must be used within a LanguageProvider');
  }
  return context;
};
