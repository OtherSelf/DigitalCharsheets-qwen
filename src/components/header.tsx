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
  Minus,
  Monitor,
  Pencil,
  PencilLine,
  Plus,
  Scale,
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
  DarkHeresyCharacter,
  DnD5eCharacter,
  type Character,
} from '@/lib/types';
import { cn } from '@/lib/utils';

import { LanguageToggle } from './layout/language-toggle';
import { ThemeToggle } from './layout/theme-toggle';
import { UserNav } from './layout/user-nav';
import { DhHouseRulesDialog } from './sheets/dh-sections/dh-house-rules-dialog';
import { HouseRulesDialog } from './sheets/dnd-sections/house-rules-dialog';
import { Button } from './ui/button';
import { Label } from './ui/label';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from './ui/select';
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
  const { user } = useLocalAuth();
  const params = useParams<{ id: string }>();
  const [isHouseRulesDialogOpen, setIsHouseRulesDialogOpen] = useState(false);
  const [character, setCharacter] = useState<Character | undefined>(undefined);

  useEffect(() => {
    if (isLoaded && params.id) {
      setCharacter(getCharacter(params.id));
    } else {
      setCharacter(undefined);
    }
  }, [isLoaded, params.id, getCharacter]);

  // ─── LANDMARK: SAFE_GET_SUBTITLE ───
  const getSubtitle = (char: Character) => {
    if (char.gameSystem === 'Dungeons & Dragons') {
      const dnd = char as DnD5eCharacter;

      const race = dnd.race || '';
      const background = dnd.background || '';
      const charClass = dnd.characterClass || '';

      const raceKey = `race${race.replace(/[^a-zA-Z]/g, '')}`;
      const classKey = `class${charClass}`;
      const bgKey = `bg${background.replace(/[^a-zA-Z]/g, '')}`;

      const translatedRace = t(raceKey) || race;
      const translatedClass = t(classKey) || charClass;
      const translatedBg = t(bgKey) || background;

      return `${t('lvl')} ${dnd.level || 1} ${translatedRace} ${translatedClass} | ${translatedBg}`;
    }

    const dh = char as DarkHeresyCharacter;

    const rank = dh.rank || '';
    const charClass = dh.characterClass || '';

    const rankKey = `rank${rank.replace(/[^a-zA-Z]/g, '')}`;
    const classKey = `career${charClass.replace(/[^a-zA-Z]/g, '')}`;
    const translatedRank = t(rankKey) || rank;
    const translatedClass = t(classKey) || charClass;
    const translatedSystem = t('gameSystemDarkHeresy') || dh.gameSystem;

    return `${translatedRank} ${translatedClass} | ${translatedSystem}`;
  };

  const handleInspirationChange = (delta: number) => {
    if (character && character.gameSystem === 'Dungeons & Dragons') {
      const dnd = character as DnD5eCharacter;
      const current = parseInt(dnd.inspiration) || 0;
      const maxInspiration = dnd.allowInspirationHomeRule ? 999 : 1;
      const next = Math.max(
        0,
        Math.min(maxInspiration, current + delta),
      ).toString();
      updateCharacter(dnd.id, { inspiration: next });
    }
  };

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
    ? t('switchToDefaultView')
    : t('switchToCompactView');

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
          <Link href="/login" aria-label={t('authLoginRegister')}>
            <LogIn className="h-4 w-4 sm:mr-2" />
            <span className="hidden sm:inline">{t('authLoginRegister')}</span>
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
          'app-header sticky top-0 z-50 flex flex-wrap items-center justify-between gap-x-4 gap-y-2 border-b bg-background/95 p-3 backdrop-blur supports-[backdrop-filter]:bg-background/60 md:p-4 xl:p-6',
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
              <Link href={backHref} aria-label={t('back') || 'Back'}>
                <ArrowLeft className="h-5 w-5" />
              </Link>
            </Button>
          )}

          <Link
            href="/"
            className="flex min-w-0 items-center gap-2"
            aria-label={t('backToDashboard') || 'Back to Dashboard'}
          >
            <Shield className="h-6 w-6 shrink-0 text-primary" />
            {/*
            На широких экранах бренд виден всегда; на листе персонажа текст
            скрыт (там важнее имя), на служебных страницах — скрыт только на
            телефоне, где рядом стоит заголовок.
          */}
            <span className={brandTextClass}>Digital Character Sheets</span>
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
                  className={`truncate font-headline font-bold tracking-tight ${isCompactView ? 'text-sm md:text-base lg:text-lg' : 'text-lg xl:text-xl'}`}
                >
                  {character.name}
                </h2>
                <p
                  className={`truncate text-muted-foreground ${isCompactView ? 'text-[10px] md:text-xs' : 'text-xs xl:text-sm'}`}
                >
                  {getSubtitle(character)}
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
                <h1 className="truncate font-headline text-lg font-bold tracking-tight xl:text-xl">
                  {title}
                </h1>
                {subtitle && (
                  <p className="truncate text-xs text-muted-foreground xl:text-sm">
                    {subtitle}
                  </p>
                )}
              </div>
            </>
          ) : null}
          {/* ─── END LANDMARK: HEADER_IDENTITY_CHARACTER_INFO ─── */}

          {character && character.gameSystem === 'Dungeons & Dragons' && (
            <div className="flex shrink-0 items-center gap-2 rounded-full border border-primary/20 bg-primary/10 px-2 py-1 md:ml-2 md:px-3">
              <span className="hidden text-[10px] font-bold uppercase tracking-widest text-primary sm:inline">
                {t('inspiration')}
              </span>
              <div className="flex items-center gap-1">
                <Button
                  size="icon"
                  variant="ghost"
                  className="h-6 w-6 text-primary hover:bg-primary/20"
                  onClick={() => handleInspirationChange(-1)}
                >
                  <Minus className="h-3 w-3" />
                </Button>
                <span className="min-w-[1rem] text-center text-sm font-black text-primary">
                  {(character as DnD5eCharacter).inspiration || '0'}
                </span>
                <Button
                  size="icon"
                  variant="ghost"
                  className="h-6 w-6 text-primary hover:bg-primary/20"
                  onClick={() => handleInspirationChange(1)}
                >
                  <Plus className="h-3 w-3" />
                </Button>
              </div>
              {!isCompactView && (
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => setIsHouseRulesDialogOpen(true)}
                  className="h-7 px-2 xl:ml-2"
                  aria-label={t('houseRules')}
                >
                  <Scale className="h-4 w-4 xl:mr-2" />
                  <span className="hidden xl:inline">{t('houseRules')}</span>
                </Button>
              )}
            </div>
          )}

          {/* ─── LANDMARK: DH HEADER CONTROLS (House Rules + Edition) ─── */}
          {character &&
            character.gameSystem === 'Dark Heresy' &&
            !isCompactView && (
              <div className="ml-2 flex shrink-0 items-center gap-2 border-l pl-2 md:gap-3 md:pl-4">
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => setIsHouseRulesDialogOpen(true)}
                  className="h-7 px-2"
                  aria-label={t('houseRules')}
                >
                  <Scale className="h-4 w-4 xl:mr-2" />
                  <span className="hidden xl:inline">{t('houseRules')}</span>
                </Button>
                <div className="flex items-center gap-2">
                  <Label className="hidden whitespace-nowrap text-xs text-muted-foreground md:inline">
                    Edition:
                  </Label>
                  <Select
                    value={character.edition || '1st'}
                    onValueChange={(value: '1st' | '2nd' | 'hybrid') =>
                      updateCharacter(character.id, { edition: value })
                    }
                  >
                    <SelectTrigger
                      className="h-7 w-[110px] text-xs"
                      data-testid="dh-edition-select"
                    >
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="1st">1st Edition</SelectItem>
                      <SelectItem value="2nd">2nd Edition</SelectItem>
                      <SelectItem value="hybrid">Hybrid</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
              </div>
            )}
          {/* ─── END DH HEADER CONTROLS ─── */}
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
                  <span className="sr-only">Open menu</span>
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
                          aria-label={t('notes')}
                          className="h-8 w-8 md:h-9 md:w-9"
                        >
                          <BookText className="h-4 w-4" />
                        </Button>
                      </TooltipTrigger>
                      <TooltipContent side="bottom">
                        <p>{t('notes')}</p>
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
                          aria-label={t('questJournalTitle')}
                          className="h-8 w-8 md:h-9 md:w-9"
                        >
                          <Scroll className="h-4 w-4" />
                        </Button>
                      </TooltipTrigger>
                      <TooltipContent side="bottom">
                        <p>{t('questJournalTitle')}</p>
                      </TooltipContent>
                    </Tooltip>
                  )}
                </div>
              )}
              <div className="flex items-center gap-1.5 md:gap-2 md:border-l md:border-r md:px-2">
                <Tooltip delayDuration={0}>
                  <TooltipTrigger asChild>
                    <Button
                      variant={hideNotes ? 'ghost' : 'secondary'}
                      size="icon"
                      onClick={() => setHideNotes(!hideNotes)}
                      aria-label={hideNotes ? t('showNotes') : t('hideNotes')}
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
                    <p>{hideNotes ? t('showNotes') : t('hideNotes')}</p>
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
                          ? t('hideEditButtons')
                          : t('showEditButtons')
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
                        ? t('hideEditButtons')
                        : t('showEditButtons')}
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

        {character && character.gameSystem === 'Dungeons & Dragons' && (
          <HouseRulesDialog
            open={isHouseRulesDialogOpen}
            onOpenChange={setIsHouseRulesDialogOpen}
            characterId={character.id}
          />
        )}
        {character && character.gameSystem === 'Dark Heresy' && (
          <DhHouseRulesDialog
            open={isHouseRulesDialogOpen}
            onOpenChange={setIsHouseRulesDialogOpen}
            characterId={character.id}
          />
        )}
      </header>
    </TooltipProvider>
  );
}
