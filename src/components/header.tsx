'use client';

import { useCharacterContext } from '@/context/character-context';
import {
  Home,
  BookText,
  Scroll,
  Monitor,
  Smartphone,
  FileDown,
  Minus,
  Plus,
  Scale,
} from 'lucide-react';
import Link from 'next/link';
import { UserNav } from './layout/user-nav';
import { Button } from './ui/button';
import { Checkbox } from './ui/checkbox';
import { Label } from './ui/label';
import { useParams } from 'next/navigation';
import { useState, useEffect } from 'react';
import {
  type Character,
  DnD5eCharacter,
  DarkHeresyCharacter,
} from '@/lib/types';
import { Separator } from './ui/separator';
import { ThemeToggle } from './layout/theme-toggle';
import { useTranslation } from '@/context/language-context';
import { LanguageToggle } from './layout/language-toggle';
import { exportCharacterToExcel } from '@/lib/export-utils';
import { HouseRulesDialog } from './sheets/dnd-sections/house-rules-dialog';
import { DhHouseRulesDialog } from './sheets/dh-sections/dh-house-rules-dialog';

interface HeaderProps {
  onNotesClick?: () => void;
  onJournalClick?: () => void;
}

export function Header({ onNotesClick, onJournalClick }: HeaderProps) {
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

  const getSubtitle = (char: Character) => {
    if (char.gameSystem === 'Dungeons & Dragons') {
      const dnd = char as DnD5eCharacter;
      
      // Generate translation keys matching the format we used in the character form
      const raceKey = `race${dnd.race.replace(/[^a-zA-Z]/g, '')}`;
      const classKey = `class${dnd.characterClass}`;
      const bgKey = `bg${dnd.background.replace(/[^a-zA-Z]/g, '')}`;
      
      // Fallback to the raw English value if a translation key is somehow missing
      const translatedRace = t(raceKey) || dnd.race;
      const translatedClass = t(classKey) || dnd.characterClass;
      const translatedBg = t(bgKey) || dnd.background;
      
      return `${t('lvl')} ${dnd.level} ${translatedRace} ${translatedClass} | ${translatedBg}`;
    }
    
    const dh = char as DarkHeresyCharacter;
    
    // Map raw values to translation keys (fallback to raw value if key is somehow missing)
    const rankKey = `rank${dh.rank.replace(/[^a-zA-Z]/g, '')}`;
    const classKey = `career${dh.characterClass.replace(/[^a-zA-Z]/g, '')}`;
    
    const translatedRank = t(rankKey) || dh.rank;
    const translatedClass = t(classKey) || dh.characterClass;
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
        Math.min(maxInspiration, current + delta)
      ).toString();
      updateCharacter(dnd.id, { inspiration: next });
    }
  };

  return (
    <header className="app-header sticky top-0 z-50 flex flex-wrap items-center justify-between gap-x-4 gap-y-2 border-b bg-background/95 p-3 backdrop-blur supports-[backdrop-filter]:bg-background/60 md:p-4 xl:p-6">

      {/* ─── LANDMARK: HEADER_IDENTITY ─── */}
      <div className="header-identity flex min-w-0 flex-1 items-center gap-2 md:gap-4">
        <Link href="/" className="flex shrink-0 items-center gap-2">
          <Home className="h-8 w-8 text-primary" />
        </Link>

        {character && !isCompactView && (
          <>
            <Separator
              orientation="vertical"
              className="hidden h-8 shrink-0 md:block"
            />
            <div className="flex min-w-0 flex-col gap-0">
              <h2 className="truncate text-lg font-headline font-bold tracking-tight xl:text-xl">
                {character.name}
              </h2>
              <p className="truncate text-xs text-muted-foreground xl:text-sm">
                {getSubtitle(character)}
              </p>
            </div>
          </>
        )}

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

{/* DH-HOUSE-RULES-HEADER-BUTTON-START */}
{character && character.gameSystem === 'Dark Heresy' && !isCompactView && (
  <Button
    variant="outline"
    size="sm"
    onClick={() => setIsHouseRulesDialogOpen(true)}
    className="h-7 px-2 ml-2"
    aria-label={t('houseRules')}
  >
    <Scale className="h-4 w-4 xl:mr-2" />
    <span className="hidden xl:inline">{t('houseRules')}</span>
  </Button>
)}
{/* DH-HOUSE-RULES-HEADER-BUTTON-END */}
      </div>

      {/* ─── LANDMARK: HEADER_ACTIONS ─── */}
      <div className="header-actions flex flex-wrap items-center justify-end gap-2">

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
                onCheckedChange={checked => setHideNotes(!!checked)}
              />
              <Label
                htmlFor="hide-notes"
                className="cursor-pointer whitespace-nowrap text-[10px] md:text-xs"
              >
                {isTabletScreen ? t('notes') : t('hideNotes')}
              </Label>
            </div>

            <div className="flex items-center gap-1.5 md:gap-2">
              <Checkbox
                id="show-edit-buttons"
                checked={showEditButtons}
                onCheckedChange={checked => setShowEditButtons(!!checked)}
              />
              <Label
                htmlFor="show-edit-buttons"
                className="cursor-pointer whitespace-nowrap text-[10px] md:text-xs"
              >
                {isTabletScreen ? t('edit') : t('showEditButtons')}
              </Label>
            </div>
          </div>
        )}

        {character && !isCompactView && (
          <Button
            variant="outline"
            size="sm"
            onClick={() => exportCharacterToExcel(character)}
            className="hidden h-8 sm:flex"
            aria-label={t('exportSheet')}
          >
            <FileDown className="h-4 w-4 xl:mr-2" />
            <span className="hidden xl:inline">{t('exportSheet')}</span>
          </Button>
        )}

        {character && !isSmallScreen && onNotesClick && onJournalClick && (
          <>
            <Button
              variant="outline"
              size="sm"
              onClick={onNotesClick}
              className="hidden h-8 sm:flex"
              aria-label={t('notes')}
            >
              <BookText className="h-4 w-4 xl:mr-2" />
              <span className="hidden xl:inline">{t('notes')}</span>
            </Button>

            <Button
              variant="outline"
              size="sm"
              onClick={onJournalClick}
              className="hidden h-8 sm:flex"
              aria-label={t('questJournal')}
            >
              <Scroll className="h-4 w-4 xl:mr-2" />
              <span className="hidden xl:inline">{t('questJournal')}</span>
            </Button>
          </>
        )}

        {!isSmallScreen && <LanguageToggle />}
        <ThemeToggle />
        <UserNav />
      </div>

      {/* DH-HOUSE-RULES-DIALOG-MOUNT-START */}
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
{/* DH-HOUSE-RULES-DIALOG-MOUNT-END */}
    </header>
  );
}