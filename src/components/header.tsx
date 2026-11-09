'use client';

import { useEffect, useState } from 'react';
import Link from 'next/link';
import { useParams } from 'next/navigation';

import {
  BookText,
  Home,
  Menu,
  Minus,
  Monitor,
  Plus,
  Scale,
  Scroll,
  Smartphone,
} from 'lucide-react';

import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import { useCharacterContext } from '@/context/character-context';
import { useTranslation } from '@/context/language-context';
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
import { Checkbox } from './ui/checkbox';
import { Label } from './ui/label';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from './ui/select';
import { Separator } from './ui/separator';

interface HeaderProps {
  onNotesClick?: () => void;
  onJournalClick?: () => void;
  mobileActions?: React.ReactNode;
}

export function Header({
  onNotesClick,
  onJournalClick,
  mobileActions,
}: HeaderProps) {
  const {
    isCompactView,
    isSmallScreen,
    isTabletScreen,
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

  return (
    <header
      className={cn(
        'app-header sticky top-0 z-50 flex flex-wrap items-center justify-between gap-x-4 gap-y-2 border-b bg-background/95 p-3 backdrop-blur supports-[backdrop-filter]:bg-background/60 md:p-4 xl:p-6',
        params.id && 'is-character-sheet',
      )}
    >
      {/* ─── LANDMARK: HEADER_IDENTITY ─── */}
      <div className="header-identity flex min-w-0 flex-1 items-center gap-2 md:gap-4">
        <Link href="/" className="flex shrink-0 items-center gap-2">
          <Home className="h-8 w-8 text-primary" />
        </Link>

        {/* ─── LANDMARK: HEADER_IDENTITY_CHARACTER_INFO (Now visible in Compact View with responsive sizing) ─── */}
        {character && (
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
        )}
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
        {/* 🎯 LANDMARK: MOBILE_ACTIONS_MENU - Only visible on mobile */}
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

        {/* 🎯 LANDMARK: NOTES_AND_JOURNAL_BUTTONS - Visible on tablet and desktop */}
        {character && !isSmallScreen && (
          <div className="flex items-center gap-2">
            {onNotesClick && (
              <Button
                variant="outline"
                size="sm"
                onClick={onNotesClick}
                className="h-8"
              >
                <BookText className="mr-2 h-4 w-4" />
                <span className="hidden sm:inline">{t('notes')}</span>
              </Button>
            )}
            {onJournalClick && (
              <Button
                variant="outline"
                size="sm"
                onClick={onJournalClick}
                className="h-8"
              >
                <Scroll className="mr-2 h-4 w-4" />
                <span className="hidden sm:inline">
                  {t('questJournalTitle')}
                </span>
              </Button>
            )}
          </div>
        )}

        {!isSmallScreen && (
          <Button variant="outline" size="icon" onClick={toggleCompactView}>
            {isCompactView ? (
              <Monitor className="h-4 w-4" />
            ) : (
              <Smartphone className="h-4 w-4" />
            )}
            <span className="sr-only">
              {isCompactView
                ? t('switchToDefaultView')
                : t('switchToCompactView')}
            </span>
          </Button>
        )}
        {character && !isSmallScreen && (
          <div className="flex items-center gap-2 md:gap-4 md:border-l md:border-r md:px-2">
            <div className="flex items-center gap-1.5 md:gap-2">
              <Checkbox
                id="hide-notes"
                checked={hideNotes}
                onCheckedChange={(checked) => setHideNotes(!!checked)}
              />
              <Label
                htmlFor="hide-notes"
                className="cursor-pointer whitespace-nowrap text-[10px] md:text-xs"
              >
                {isTabletScreen
                  ? t('notes')
                  : hideNotes
                    ? t('showNotes')
                    : t('hideNotes')}
              </Label>
            </div>
            <div className="flex items-center gap-1.5 md:gap-2">
              <Checkbox
                id="show-edit-buttons"
                checked={showEditButtons}
                onCheckedChange={(checked) => setShowEditButtons(!!checked)}
              />
              <Label
                htmlFor="show-edit-buttons"
                className="cursor-pointer whitespace-nowrap text-[10px] md:text-xs"
              >
                {isTabletScreen
                  ? t('edit')
                  : showEditButtons
                    ? t('hideEditButtons')
                    : t('showEditButtons')}
              </Label>
            </div>
          </div>
        )}
        {/* 🎯 LANDMARK: SMART_LANGUAGE_TOGGLE */}
        {(!character || !isCompactView) && <LanguageToggle />}
        <ThemeToggle />
        <UserNav />
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
  );
}
