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
import { cn } from '@/lib/utils';
import Link from 'next/link';
import { UserNav } from './layout/user-nav';
import { Button } from './ui/button';
import { Checkbox } from './ui/checkbox';
import { Label } from './ui/label';
import { useParams } from 'next/navigation';
import { useState, useEffect } from 'react';
import { type Character, DnD5eCharacter, DarkHeresyCharacter } from '@/lib/types';
import { Separator } from './ui/separator';
import { ThemeToggle } from './layout/theme-toggle';
import { useTranslation } from '@/context/language-context';
import { LanguageToggle } from './layout/language-toggle';
import { exportCharacterToExcel } from '@/lib/export-utils';
import { HouseRulesDialog } from './sheets/dnd-sections/house-rules-dialog';

interface HeaderProps {
    onNotesClick?: () => void;
    onJournalClick?: () => void;
}

export function Header({ onNotesClick, onJournalClick }: HeaderProps) {
  const { isCompactView, isSmallScreen, toggleCompactView, getCharacter, isLoaded, hideNotes, setHideNotes, showEditButtons, setShowEditButtons, updateCharacter } =
    useCharacterContext();
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
      return `Level ${dnd.level} ${dnd.race} ${dnd.characterClass} | ${dnd.background}`;
    } else {
      const dh = char as DarkHeresyCharacter;
      return `${dh.rank} ${dh.characterClass} | ${dh.gameSystem}`;
    }
  };

  const handleInspirationChange = (delta: number) => {
    if (character && character.gameSystem === 'Dungeons & Dragons') {
      const dnd = character as DnD5eCharacter;
      const current = parseInt(dnd.inspiration) || 0;
      const maxInspiration = dnd.allowInspirationHomeRule ? 999 : 1;
      const next = Math.max(0, Math.min(maxInspiration, current + delta)).toString();
      updateCharacter(dnd.id, { inspiration: next });
    }
  };

  return (
    <header className="flex items-center justify-between border-b p-4 md:p-6 bg-background/95 backdrop-blur supports-[backdrop-filter]:bg-background/60 sticky top-0 z-50">
      <div className="flex items-center gap-4">
        <Link href="/" className="flex items-center gap-2">
          <Home className="w-8 h-8 text-primary" />
        </Link>
        {character && !isCompactView && (
          <>
            <Separator orientation="vertical" className="h-8 mx-2" />
            <div className="flex flex-col gap-0">
              <h2 className="text-xl font-headline font-bold tracking-tight break-words">
                {character.name}
              </h2>
              <p className="text-sm text-muted-foreground break-words">
                {getSubtitle(character)}
              </p>
            </div>
          </>
        )}
        {character && character.gameSystem === 'Dungeons & Dragons' && (
          <div className="flex items-center gap-2 ml-2 px-3 py-1 rounded-full bg-primary/10 border border-primary/20">
            <span className="text-[10px] font-bold uppercase text-primary tracking-widest hidden sm:inline">{t('inspiration')}</span>
            <div className="flex items-center gap-1.5">
              <Button size="icon" variant="ghost" className="h-6 w-6 text-primary hover:bg-primary/20" onClick={() => handleInspirationChange(-1)}>
                <Minus className="h-3 w-3" />
              </Button>
              <span className="text-sm font-black text-primary min-w-[1rem] text-center">{(character as DnD5eCharacter).inspiration || '0'}</span>
              <Button size="icon" variant="ghost" className="h-6 w-6 text-primary hover:bg-primary/20" onClick={() => handleInspirationChange(1)}>
                <Plus className="h-3 w-3" />
              </Button>
            </div>
            
            {!isCompactView && (
              <Button
                variant="outline"
                size="sm"
                onClick={() => setIsHouseRulesDialogOpen(true)}
                className="ml-2"
              >
                <Scale className="mr-2 h-4 w-4" />
                House Rules
              </Button>
            )}
          </div>
        )}
      </div>
      <div className="flex items-center gap-2">
        {!isSmallScreen && (
          <Button variant="outline" size="icon" onClick={toggleCompactView}>
            {isCompactView ? (
              <Monitor className="h-4 w-4" />
            ) : (
              <Smartphone className="h-4 w-4" />
            )}
            <span className="sr-only">
              {isCompactView
                ? 'Switch to Default View'
                : 'Switch to Compact View'}
            </span>
          </Button>
        )}
        
        {character && !isCompactView && (
          <div className="flex items-center gap-2 md:gap-4 px-2 mx-1 h-8 border-l border-r">
            <div className="flex items-center gap-1.5 md:gap-2">
              <Checkbox 
                id="hide-notes" 
                checked={hideNotes} 
                onCheckedChange={(checked) => setHideNotes(!!checked)} 
              />
              <Label htmlFor="hide-notes" className="text-[10px] md:text-xs whitespace-nowrap cursor-pointer">
                {isSmallScreen ? t('notes') : t('hideNotes')}
              </Label>
            </div>
            <div className="flex items-center gap-1.5 md:gap-2">
              <Checkbox 
                id="show-edit-buttons" 
                checked={showEditButtons} 
                onCheckedChange={(checked) => setShowEditButtons(!!checked)} 
              />
              <Label htmlFor="show-edit-buttons" className="text-[10px] md:text-xs whitespace-nowrap cursor-pointer">
                {isSmallScreen ? t('edit') : t('showEditButtons')}
              </Label>
            </div>
          </div>
        )}
        
        {character && !isCompactView && (
          <Button 
            variant="outline" 
            size="sm" 
            onClick={() => exportCharacterToExcel(character)}
            className="hidden sm:flex"
          >
            <FileDown className="mr-2 h-4 w-4" />
            {t('exportSheet')}
          </Button>
        )}

        {character && !isCompactView && onNotesClick && onJournalClick && (
          <>
            <Button
              variant="outline"
              size="sm"
              onClick={onNotesClick}
            >
              <BookText className="mr-2 h-4 w-4" />
              {t('notes')}
            </Button>
            <Button
              variant="outline"
              size="sm"
              onClick={onJournalClick}
            >
              <Scroll className="mr-2 h-4 w-4" />
              {t('questJournal')}
            </Button>
          </>
        )}
        {!isCompactView && <LanguageToggle />}
        <ThemeToggle />
        <UserNav />
      </div>
      {character && (
        <HouseRulesDialog 
          open={isHouseRulesDialogOpen} 
          onOpenChange={setIsHouseRulesDialogOpen} 
          characterId={character.id} 
        />
        )}
    </header>
  );
}
