// src/app/global-error.tsx

'use client';

import { useEffect } from 'react';

import { enTranslations } from '@/lib/i18n/translations.en';
import { ruTranslations } from '@/lib/i18n/translations.ru';

/**
 * ─── LANDMARK: GLOBAL ERROR BOUNDARY ────────────────────────────────────────
 * Ошибка корневого layout: React уже не рендерит приложение, поэтому здесь нет
 * ни провайдеров, ни Tailwind-классов из `globals.css` — только словари и
 * инлайн-стили. Язык берём из того же `localStorage`, что и `LanguageProvider`
 * (до контекста не дотянуться), с фолбэком на язык браузера.
 *
 * Страница обязана содержать `<html>` и `<body>`: Next заменяет ею корневой
 * layout целиком. Это последний рубеж, поэтому здесь нет компонентов ядра —
 * только словарь и минимальная разметка; код статуса виден, чтобы дежурный
 * отличал падение layout от обычной 404.
 */
const LANGUAGE_KEY = 'language';

function pickLanguage(): 'en' | 'ru' {
  try {
    const saved = window.localStorage.getItem(LANGUAGE_KEY);
    if (saved === 'ru') return 'ru';
    if (saved === 'en') return 'en';
  } catch {
    // Хранилище недоступно — решаем по языку браузера.
  }

  if (typeof navigator !== 'undefined') {
    return navigator.language.toLowerCase().startsWith('ru') ? 'ru' : 'en';
  }

  return 'en';
}

export default function GlobalError({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  const language = pickLanguage();
  const dictionary: Record<string, string> =
    language === 'ru' ? ruTranslations : enTranslations;
  const t = (key: string) => dictionary[key] ?? key;

  useEffect(() => {
    console.error('[app] root layout failed:', error);
  }, [error]);

  return (
    <html lang={language}>
      <body
        style={{
          margin: 0,
          minHeight: '100vh',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          padding: 24,
          background: '#f8fafc',
          color: '#0f172a',
          fontFamily:
            'system-ui, -apple-system, "Segoe UI", Roboto, Helvetica, Arial, sans-serif',
        }}
      >
        <div
          data-testid="global-error"
          data-error-code="500"
          style={{
            width: '100%',
            maxWidth: 520,
            background: '#ffffff',
            border: '1px solid #e2e8f0',
            borderRadius: 12,
            padding: 24,
            boxShadow: '0 10px 30px rgba(15, 23, 42, 0.08)',
          }}
        >
          <h1 style={{ margin: '0 0 8px', fontSize: 18 }}>
            {t('error.500.title')}
          </h1>
          <p style={{ margin: '0 0 6px', fontSize: 12, color: '#64748b' }}>
            {'HTTP 500'}
          </p>
          <p style={{ margin: '0 0 20px', fontSize: 14, color: '#475569' }}>
            {t('error.500.description')}
          </p>
          <div style={{ display: 'flex', flexWrap: 'wrap', gap: 12 }}>
            <button
              type="button"
              onClick={reset}
              style={{
                border: 'none',
                borderRadius: 8,
                padding: '10px 16px',
                background: '#0f172a',
                color: '#f8fafc',
                fontSize: 14,
                cursor: 'pointer',
              }}
            >
              {t('common.retry')}
            </button>
            <button
              type="button"
              onClick={() => window.location.reload()}
              style={{
                border: '1px solid #cbd5e1',
                borderRadius: 8,
                padding: '10px 16px',
                background: '#ffffff',
                color: '#0f172a',
                fontSize: 14,
                cursor: 'pointer',
              }}
            >
              {t('common.reloadPage')}
            </button>
          </div>
          {error.digest && (
            <p
              style={{
                margin: '16px 0 0',
                fontFamily: 'ui-monospace, SFMono-Regular, monospace',
                fontSize: 11,
                color: '#64748b',
              }}
            >
              {`digest: ${error.digest}`}
            </p>
          )}
        </div>
      </body>
    </html>
  );
}
