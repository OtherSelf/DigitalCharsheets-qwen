'use client';

import Link from 'next/link';

import { LogIn, Monitor, Shield, Smartphone } from 'lucide-react';

import { Button } from '@/components/ui/button';
import { useCharacterContext } from '@/context/character-context';
import { useTranslation } from '@/context/language-context';

import { LanguageToggle } from './language-toggle';
import { ThemeToggle } from './theme-toggle';

interface GuestHeaderProps {
  /** Кнопка «Вход / Регистрация» (на самой /login она не нужна). */
  showLoginLink?: boolean;
}

/**
 * ─── LANDMARK: GUEST_HEADER ────────────────────────────────────────────────
 * Шапка гостевых страниц (главная до входа, /demo, /login). Повторяет набор
 * кнопок основной шапки приложения:
 *   • мобильный (компактный) вид — тот же toggleCompactView из CharacterContext;
 *   • тема — ThemeToggle;
 *   • язык — LanguageToggle.
 *
 * На тач-экранах компактный вид включается автоматически (isSmallScreen), как
 * и в основной шапке, поэтому кнопка там скрыта.
 */
export function GuestHeader({ showLoginLink = false }: GuestHeaderProps) {
  const { isCompactView, isSmallScreen, toggleCompactView } =
    useCharacterContext();
  const { t } = useTranslation();

  const compactLabel = isCompactView
    ? t('switchToDefaultView')
    : t('switchToCompactView');

  return (
    <header
      data-testid="guest-header"
      className="sticky top-0 z-50 border-b bg-card/50 backdrop-blur supports-[backdrop-filter]:bg-background/60"
    >
      <div className="container mx-auto flex h-16 items-center justify-between gap-3 px-4">
        <Link href="/" className="flex min-w-0 items-center gap-2">
          <Shield className="h-6 w-6 shrink-0 text-primary" />
          <span className="truncate font-headline text-lg font-bold">
            Digital Character Sheets
          </span>
        </Link>

        <div className="flex shrink-0 items-center gap-2 sm:gap-3">
          {!isSmallScreen && (
            <Button
              variant="outline"
              size="icon"
              onClick={toggleCompactView}
              aria-label={compactLabel}
              title={compactLabel}
              data-testid="guest-compact-toggle"
            >
              {isCompactView ? (
                <Monitor className="h-4 w-4" />
              ) : (
                <Smartphone className="h-4 w-4" />
              )}
            </Button>
          )}
          <LanguageToggle />
          <ThemeToggle />
          {/*
            ─── LANDMARK: GUEST_LOGIN_STABLE_WIDTH ───
            «Вход / Регистрация» и «Login / Register» разной длины. Кнопка
            прижата к правому краю шапки, поэтому без фиксированной ширины
            смена языка сдвигала все иконки слева от неё. min-w в em держит
            слот одинаковым в обеих локалях и масштабируется вместе с текстом
            (--text-scale), а justify-start закрепляет иконку у левого края.
          */}
          {showLoginLink && (
            <Button
              variant="ghost"
              asChild
              className="sm:min-w-[15em] sm:justify-start"
            >
              <Link href="/login" aria-label={t('authLoginRegister')}>
                <LogIn className="h-4 w-4 sm:mr-2" />
                <span className="hidden sm:inline">
                  {t('authLoginRegister')}
                </span>
              </Link>
            </Button>
          )}
        </div>
      </div>
    </header>
  );
}
