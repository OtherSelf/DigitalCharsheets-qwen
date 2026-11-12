'use client';

import { useEffect, useState } from 'react';
import Link from 'next/link';
import { useParams } from 'next/navigation';

import {
  ArrowLeft,
  BookText,
  Eye,
  EyeOff,
  LogIn,
  Menu,
  Monitor,
  Pencil,
  PencilLine,
  Scroll,
  Shield,
  Smartphone,
} from 'lucide-react';

import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import { useCharacterContext } from '@/context/character-context';
import { useTranslation } from '@/context/language-context';
import { useLocalAuth } from '@/context/local-auth-context';
import {
  getCharacterModule,
  resolveCharacterSystemId,
} from '@/games/character-system';
import { useGameUiSlots } from '@/hooks/use-game-ui-slots';
import { useSiteTitle } from '@/hooks/use-site-title';
import { type Character } from '@/lib/types';
import { cn } from '@/lib/utils';

import { LanguageToggle } from './layout/language-toggle';
import { ThemeToggle } from './layout/theme-toggle';
import { UserNav } from './layout/user-nav';
import { Button } from './ui/button';
import { Separator } from './ui/separator';
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from './ui/tooltip';

/**
 * ─── LANDMARK: UNIFIED_HEADER ───────────────────────────────────────────────
 * Одна шапка на всё приложение. Раньше их было три: `Header`, `GuestHeader`
 * и самописные шапки на /settings и /stats-editor (последняя вообще без
 * шапки). Из-за этого на каждом экране был свой набор кнопок, иконок и
 * отступов.
 *
 * Теперь шапка адаптируется по контексту:
 *   • бренд-ссылка «Digital Character Sheets» есть всегда;
 *   • на листе персонажа рядом с брендом — имя и система;
 *   • на служебных страницах — заголовок через `title`/`subtitle`;
 *   • гость видит «Вход / Регистрация» (`authAction="login"`), на самой
 *     /login кнопка скрыта (`authAction="none"`), в остальных случаях —
 *     `UserNav` с меню профиля;
 *   • `backHref` добавляет стрелку «назад» слева от бренда (нужна только
 *     когда возврат ведёт не на главную — иначе бренд-ссылка уже домой).
 */
interface HeaderProps {
  onNotesClick?: () => void;
  onJournalClick?: () => void;
  mobileActions?: React.ReactNode;
  /**
   * Действие авторизации справа:
   *   auto  — `UserNav` (для гостя сам покажет «Войти»);
   *   login — для гостя «Вход / Регистрация» (широкая кнопка как раньше);
   *   none  — для гостя ничего (страница /login, где кнопка лишняя).
   */
  authAction?: 'auto' | 'login' | 'none';
  /** Заголовок страницы в шапке (настройки, массовый редактор). */
  title?: string;
  /** Подзаголовок страницы в шапке. */
  subtitle?: string;
  /** Куда ведёт стрелка «назад»; без неё остаётся только бренд-ссылка домой. */
  backHref?: string;
}

export function Header({
  onNotesClick,
  onJournalClick,
  mobileActions,
  authAction = 'auto',
  title,
  subtitle,
  backHref,
}: HeaderProps) {
  const {
    isCompactView,
    isSmallScreen,
    toggleCompactView,
    getCharacter,
    isLoaded,
    hideNotes,
    setHideNotes,
    showEditButtons,
    setShowEditButtons,
    updateCharacter,
  } = useCharacterContext();
  const { t } = useTranslation();
  const siteTitle = useSiteTitle();
  const { user } = useLocalAuth();
  const params = useParams<{ id: string }>();
  const [character, setCharacter] = useState<Character | undefined>(undefined);

  useEffect(() => {
    if (isLoaded && params.id) {
      setCharacter(getCharacter(params.id));
    } else {
      setCharacter(undefined);
    }
  }, [isLoaded, params.id, getCharacter]);

  // Игровые подпись и действия в шапке приходят из слота плагина (этап 3):
  // в ядре не остаётся ни одной проверки на конкретную игру.
  const systemId = character ? resolveCharacterSystemId(character) : undefined;
  const gameModule = character ? getCharacterModule(character) : undefined;
  const uiSlots = useGameUiSlots(systemId);
  const HeaderActions = uiSlots?.HeaderActions;
  const characterSubtitle = character
    ? (uiSlots?.HeaderSubtitle?.(character, t) ??
      (gameModule ? t(gameModule.nameKey) : ''))
    : undefined;

  // Пока сессия не прочитана на клиенте, гостем считаем любого без user:
  // страницы приложения сами показывают Loader до окончания загрузки.
  const isGuest = !user;

  // На листе персонажа слева уже есть имя и система, поэтому бренд остаётся
  // только иконкой — иначе на планшете/десктопе он отжимает инструменты
  // листа. На служебных страницах (настройки, редактор) текст бренда прячем
  // только на телефоне: там рядом стоит заголовок страницы.
  const brandTextClass = cn(
    'truncate font-headline font-bold leading-tight',
    character ? 'hidden' : title ? 'hidden text-base md:inline' : 'text-lg',
  );

  const compactLabel = isCompactView
    ? t('common.switchToDefaultView')
    : t('common.switchToCompactView');

  const authControls =
    authAction === 'login' ? (
      isGuest ? (
        /*
          ─── LANDMARK: GUEST_LOGIN_STABLE_WIDTH ───
          «Вход / Регистрация» и «Login / Register» разной длины. Кнопка
          прижата к правому краю шапки, поэтому без фиксированной ширины
          смена языка сдвигала все иконки слева от неё. min-w в em держит
          слот одинаковым в обеих локалях и масштабируется вместе с текстом
          (--text-scale), а justify-start закрепляет иконку у левого края.
        */
        <Button
          variant="ghost"
          asChild
          className="sm:min-w-[15em] sm:justify-start"
        >
          <Link href="/login" aria-label={t('auth.loginRegister')}>
            <LogIn className="h-4 w-4 sm:mr-2" />
            <span className="hidden sm:inline">{t('auth.loginRegister')}</span>
          </Link>
        </Button>
      ) : (
        <UserNav />
      )
    ) : authAction === 'none' ? (
      user ? (
        <UserNav />
      ) : null
    ) : (
      <UserNav />
    );

  return (
    <TooltipProvider>
      <header
        data-testid={isGuest ? 'guest-header' : 'app-header'}
        className={cn(
          'app-header bg-background/95 supports-[backdrop-filter]:bg-background/60 sticky top-0 z-50 flex flex-wrap items-center justify-between gap-x-4 gap-y-2 border-b p-3 backdrop-blur md:p-4 xl:p-6',
          params.id && 'is-character-sheet',
        )}
      >
        {/* ─── LANDMARK: HEADER_IDENTITY ─── */}
        <div className="header-identity flex min-w-0 flex-1 items-center gap-2 md:gap-4">
          {backHref && (
            <Button
              variant="ghost"
              size="icon"
              asChild
              className="h-9 w-9 shrink-0"
            >
              <Link href={backHref} aria-label={t('common.back') || 'Back'}>
                <ArrowLeft className="h-5 w-5" />
              </Link>
            </Button>
          )}

          <Link
            href="/"
            className="flex min-w-0 items-center gap-2"
            aria-label={t('common.backToDashboard') || 'Back to Dashboard'}
          >
            <Shield className="text-primary h-6 w-6 shrink-0" />
            {/*
            На широких экранах бренд виден всегда; на листе персонажа текст
            скрыт (там важнее имя), на служебных страницах — скрыт только на
            телефоне, где рядом стоит заголовок.
          */}
            <span className={brandTextClass}>
              {siteTitle || 'Digital Character Sheets'}
            </span>
          </Link>

          {/* ─── LANDMARK: HEADER_IDENTITY_CHARACTER_INFO (Now visible in Compact View with responsive sizing) ─── */}
          {character ? (
            <>
              <Separator
                orientation="vertical"
                className="hidden h-8 shrink-0 md:block"
              />
              <div className="flex min-w-0 flex-col gap-0">
                <h2
                  className={`font-headline truncate font-bold tracking-tight ${isCompactView ? 'text-sm md:text-base lg:text-lg' : 'text-lg xl:text-xl'}`}
                  title={character.name}
                >
                  {character.name}
                </h2>
                <p
                  className={`text-muted-foreground truncate ${isCompactView ? 'text-[10px] md:text-xs' : 'text-xs xl:text-sm'}`}
                >
                  {characterSubtitle}
                </p>
              </div>
            </>
          ) : title ? (
            <>
              <Separator
                orientation="vertical"
                className="hidden h-8 shrink-0 md:block"
              />
              <div className="flex min-w-0 flex-col gap-0">
                <h1 className="font-headline truncate text-lg font-bold tracking-tight xl:text-xl">
                  {title}
                </h1>
                {subtitle && (
                  <p className="text-muted-foreground truncate text-xs xl:text-sm">
                    {subtitle}
                  </p>
                )}
              </div>
            </>
          ) : null}
          {/* ─── END LANDMARK: HEADER_IDENTITY_CHARACTER_INFO ─── */}

          {character && HeaderActions && (
            <HeaderActions
              character={character}
              isCompactView={isCompactView}
            />
          )}
        </div>

        {/* ─── LANDMARK: HEADER_ACTIONS ─── */}
        <div className="header-actions flex flex-wrap items-center justify-end gap-2">
          {/* LANDMARK: MOBILE_ACTIONS_MENU - Only visible on mobile */}
          {mobileActions && (
            <DropdownMenu>
              <DropdownMenuTrigger asChild>
                <Button
                  variant="outline"
                  size="icon"
                  className="h-9 w-9 sm:hidden"
                >
                  <Menu className="h-4 w-4" />
                  <span className="sr-only">{t('common.openMenu')}</span>
                </Button>
              </DropdownMenuTrigger>
              <DropdownMenuContent align="end" className="w-56">
                {mobileActions}
              </DropdownMenuContent>
            </DropdownMenu>
          )}

          {/* ─── LANDMARK: HEADER_SHEET_ACTIONS ───
            Инструменты листа: «Заметки», «Журнал заданий» и тумблеры
            «заметки»/«правка». Показываются только иконки, подпись —
            в подсказке при наведении (Tooltip) и в `aria-label`.
            Доступные имена остались прежними: «Notes», «Журнал заданий»,
            «Hide Notes», «Show Edit Buttons» — на них опираются визуальные
            тесты (`tests/visual/helpers.ts`, `getByRole` по имени).
            Раньше подписи занимали до 310 px, и на планшете (768–1299 px)
            шапка переносилась на две строки. На планшете эта группа остаётся
            слева, а иконки приложения справа. */}
          {character && !isSmallScreen && (
            <div className="header-sheet-actions flex flex-wrap items-center gap-2">
              {(onNotesClick || onJournalClick) && (
                <div className="flex items-center gap-1.5 md:gap-2">
                  {onNotesClick && (
                    <Tooltip delayDuration={0}>
                      <TooltipTrigger asChild>
                        <Button
                          variant="outline"
                          size="icon"
                          onClick={onNotesClick}
                          aria-label={t('common.notes')}
                          className="h-8 w-8 md:h-9 md:w-9"
                        >
                          <BookText className="h-4 w-4" />
                        </Button>
                      </TooltipTrigger>
                      <TooltipContent side="bottom">
                        <p>{t('common.notes')}</p>
                      </TooltipContent>
                    </Tooltip>
                  )}
                  {onJournalClick && (
                    <Tooltip delayDuration={0}>
                      <TooltipTrigger asChild>
                        <Button
                          variant="outline"
                          size="icon"
                          onClick={onJournalClick}
                          aria-label={t('common.questJournalTitle')}
                          className="h-8 w-8 md:h-9 md:w-9"
                        >
                          <Scroll className="h-4 w-4" />
                        </Button>
                      </TooltipTrigger>
                      <TooltipContent side="bottom">
                        <p>{t('common.questJournalTitle')}</p>
                      </TooltipContent>
                    </Tooltip>
                  )}
                </div>
              )}
              <div className="flex items-center gap-1.5 md:gap-2 md:border-r md:border-l md:px-2">
                <Tooltip delayDuration={0}>
                  <TooltipTrigger asChild>
                    <Button
                      variant={hideNotes ? 'ghost' : 'secondary'}
                      size="icon"
                      onClick={() => setHideNotes(!hideNotes)}
                      aria-label={
                        hideNotes
                          ? t('common.showNotes')
                          : t('common.hideNotes')
                      }
                      aria-pressed={!hideNotes}
                      className="h-8 w-8 md:h-9 md:w-9"
                    >
                      {hideNotes ? (
                        <EyeOff className="h-4 w-4" />
                      ) : (
                        <Eye className="h-4 w-4" />
                      )}
                    </Button>
                  </TooltipTrigger>
                  <TooltipContent side="bottom">
                    <p>
                      {hideNotes
                        ? t('common.showNotes')
                        : t('common.hideNotes')}
                    </p>
                  </TooltipContent>
                </Tooltip>
                <Tooltip delayDuration={0}>
                  <TooltipTrigger asChild>
                    <Button
                      variant={showEditButtons ? 'secondary' : 'ghost'}
                      size="icon"
                      onClick={() => setShowEditButtons(!showEditButtons)}
                      aria-label={
                        showEditButtons
                          ? t('common.hideEditButtons')
                          : t('common.showEditButtons')
                      }
                      aria-pressed={showEditButtons}
                      className="h-8 w-8 md:h-9 md:w-9"
                    >
                      {showEditButtons ? (
                        <Pencil className="h-4 w-4" />
                      ) : (
                        <PencilLine className="h-4 w-4" />
                      )}
                    </Button>
                  </TooltipTrigger>
                  <TooltipContent side="bottom">
                    <p>
                      {showEditButtons
                        ? t('common.hideEditButtons')
                        : t('common.showEditButtons')}
                    </p>
                  </TooltipContent>
                </Tooltip>
              </div>
            </div>
          )}

          {/* ─── LANDMARK: HEADER_VIEW_ACTIONS ───
            Иконки приложения: компактный вид, язык, тема, профиль. */}
          <div className="header-view-actions flex items-center gap-2">
            {!isSmallScreen && (
              <Button
                variant="outline"
                size="icon"
                onClick={toggleCompactView}
                aria-label={compactLabel}
                title={compactLabel}
                data-testid={isGuest ? 'guest-compact-toggle' : undefined}
              >
                {isCompactView ? (
                  <Monitor className="h-4 w-4" />
                ) : (
                  <Smartphone className="h-4 w-4" />
                )}
                <span className="sr-only">{compactLabel}</span>
              </Button>
            )}
            {/* LANDMARK: SMART_LANGUAGE_TOGGLE */}
            {(!character || !isCompactView) && <LanguageToggle />}
            <ThemeToggle />
            {authControls}
          </div>
        </div>
      </header>
    </TooltipProvider>
  );
}
