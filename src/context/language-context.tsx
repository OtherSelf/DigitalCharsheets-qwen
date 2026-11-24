'use client';

import React, {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useState,
} from 'react';

import {
  interpolate,
  pluralForm,
  translations,
  type TranslationVars,
} from '@/lib/i18n';
import {
  DEFAULT_LANGUAGE,
  isLanguage,
  LANGUAGE_STORAGE_KEY,
  parseLanguage,
  persistLanguageCookie,
  readLanguageCookie,
  type Language,
} from '@/lib/language';

export type { Language };

interface LanguageContextType {
  language: Language;
  setLanguage: (lang: Language) => void;
  /** Перевод с подстановкой `{name}`/`{count}`. */
  t: (key: string, vars?: TranslationVars) => string;
  /**
   * Перевод с формой числа: ключ `<key>_<form>` (`_one`/`_few`/`_many`),
   * фолбэк — `<key>_other`, затем сам ключ. `count` подставляется всегда.
   */
  tPlural: (key: string, count: number, vars?: TranslationVars) => string;
}

const LanguageContext = createContext<LanguageContextType | undefined>(
  undefined,
);

/**
 * ─── LANDMARK: LANGUAGE PROVIDER ────────────────────────────────────────────
 * Начальный язык приходит пропом из root layout: его уже прочитал сервер из
 * cookie/`Accept-Language`, поэтому первый HTML и первое состояние клиента
 * совпадают и гидратация не находит расхождения.
 *
 * Источник истины — cookie `dcs_language`; `localStorage` остался зеркалом,
 * потому что только его изменения видны другим вкладкам (`storage`-событие).
 * Запись выбора идёт и туда, и туда.
 */
export function LanguageProvider({
  children,
  initialLanguage = DEFAULT_LANGUAGE,
}: {
  children: React.ReactNode;
  initialLanguage?: Language;
}) {
  const [language, setLanguageState] = useState<Language>(initialLanguage);

  // `<html lang>` обязан совпадать с текстами: сервер ставит его сразу,
  // клиент — при каждом переключении и при возврате вкладки.
  useEffect(() => {
    document.documentElement.lang = language;
  }, [language]);

  useEffect(() => {
    // Cookie нет — это либо первая загрузка после обновления (выбор лежал
    // только в localStorage), либо явно очищенные cookie. Сохраняем действующий
    // язык в cookie, чтобы следующий SSR не гадал.
    if (!readLanguageCookie()) {
      let restored: Language | null = null;
      try {
        restored = parseLanguage(localStorage.getItem(LANGUAGE_STORAGE_KEY));
      } catch {
        // Хранилище недоступно (приватный режим) — остаётся язык сервера.
      }
      persistLanguageCookie(restored ?? initialLanguage);

      if (restored && restored !== initialLanguage) {
        /*
          Документ уже отрендерен на языке сервера, а выбор пользователя другой.
          Менять текст на клиенте — это и есть «мигание» языка; один перезагруз
          с готовой cookie отдаёт весь документ на выбранном языке сразу.
          Повторно не случится: cookie теперь есть.
        */
        window.location.reload();
        return;
      }
    }

    // Другая вкладка переключила язык: cookie уже записана ею, здесь только
    // состояние и атрибут — иначе вкладки показывают разные языки.
    const onStorage = (event: StorageEvent) => {
      if (event.key !== LANGUAGE_STORAGE_KEY) return;
      const next = parseLanguage(event.newValue);
      if (next) setLanguageState(next);
    };
    window.addEventListener('storage', onStorage);
    return () => window.removeEventListener('storage', onStorage);
  }, [initialLanguage]);

  const setLanguage = useCallback((lang: Language) => {
    if (!isLanguage(lang)) return;
    setLanguageState(lang);
    document.documentElement.lang = lang;
    persistLanguageCookie(lang);
    try {
      localStorage.setItem(LANGUAGE_STORAGE_KEY, lang);
    } catch {
      // Хранилище недоступно — cookie остаётся источником истины.
    }
  }, []);

  const dict = translations[language];
  // Ключи всегда полные (`namespace.key`): suffix-fallback эпохи перехода
  // удалён; namespaced-ключи проверяет tests/unit/translations.test.ts.
  const t = (key: string, vars?: TranslationVars) =>
    interpolate(dict[key] ?? key, vars);

  const tPlural = (key: string, count: number, vars?: TranslationVars) => {
    const form = pluralForm(language, count);
    const template = dict[`${key}_${form}`] ?? dict[`${key}_other`] ?? dict[key];
    return interpolate(template ?? key, { count, ...vars });
  };

  return (
    <LanguageContext.Provider value={{ language, setLanguage, t, tPlural }}>
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
