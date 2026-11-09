'use client';

import { useCharacterContext } from '@/context/character-context';
import {
  Home,
  BookText,
  Scroll,
  Monitor,
  Smartphone,
  Minus,
  Plus,
  Scale,
  Menu,
  Eye,
  EyeOff,
  Pencil,
  PencilLine,
} from 'lucide-react';
import Link from 'next/link';
import { UserNav } from './layout/user-nav';
import { Button } from './ui/button';
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from '@/components/ui/tooltip';
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
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from './ui/select';
import { HouseRulesDialog } from './sheets/dnd-sections/house-rules-dialog';
import { DhHouseRulesDialog } from './sheets/dh-sections/dh-house-rules-dialog';

interface HeaderProps {
  onNotesClick?: () => void;
  onJournalClick?: () => void;
  mobileActions?: React.ReactNode;
}

export function Header({ onNotesClick, onJournalClick, mobileActions }: HeaderProps) {
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
      const race = dnd.race || "";
      const background = dnd.background || "";
      const charClass = dnd.characterClass || "";

      const raceKey = `race${race.replace(/[^a-zA-Z]/g, '')}`;
      const classKey = `class${charClass}`;
      const bgKey = `bg${background.replace(/[^a-zA-Z]/g, '')}`;

      const translatedRace = t(raceKey) || race;
      const translatedClass = t(classKey) || charClass;
      const translatedBg = t(bgKey) || background;

      return `${t('lvl')} ${dnd.level || 1} ${translatedRace} ${translatedClass} | ${translatedBg}`;
    }

    const dh = char as DarkHeresyCharacter;
    const rank = dh.rank || "";
    const charClass = dh.characterClass || "";

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
      const next = Math.max(0, Math.min(maxInspiration, current + delta)).toString();
      updateCharacter(dnd.id, { inspiration: next });
    }
  };

  return (
    <TooltipProvider>
      {/* 🎯 LANDMARK: SINGLE_ROW_HEADER_CONTAINER - Removed flex-wrap and gap-y-2, tightened padding */}
      <header className="sticky top-0 z-50 flex items-center justify-between gap-x-2 border-b bg-background/95 p-2 backdrop-blur supports-[backdrop-filter]:bg-background/60 md:p-3 lg:p-4">
        
        {/* 1. IDENTITY SECTION: flex-1 and min-w-0 ensure this truncates instead of pushing other elements to a new row */}
        <div className="flex min-w-0 flex-1 items-center gap-2 md:gap-3">
          <Link href="/" className="flex shrink-0 items-center gap-2">
            <Home className="h-7 w-7 md:h-8 md:w-8 text-primary" />
          </Link>

          <Separator orientation="vertical" className="hidden h-7 shrink-0 md:block" />
          
          <div className="flex min-w-0 flex-col">
            <h2 className="truncate font-headline font-bold tracking-tight text-sm md:text-base lg:text-lg">
              {character?.name}
            </h2>
            <p className="truncate text-muted-foreground text-[10px] md:text-xs">
              {character ? getSubtitle(character) : ''}
            </p>
          </div>

          {character && character.gameSystem === 'Dungeons & Dragons' && (
            <div className="flex shrink-0 items-center gap-1 rounded-full border border-primary/20 bg-primary/10 px-1.5 py-0.5 md:px-2">
              <span className="hidden text-[10px] font-bold uppercase tracking-widest text-primary md:inline">
                {t('inspiration')}
              </span>
              <div className="flex items-center gap-0.5">
                <Button size="icon" variant="ghost" className="h-6 w-6 text-primary hover:bg-primary/20" onClick={() => handleInspirationChange(-1)}>
                  <Minus className="h-3 w-3" />
                </Button>
                <span className="min-w-[1rem] text-center text-xs font-black text-primary md:text-sm">
                  {(character as DnD5eCharacter).inspiration || '0'}
                </span>
                <Button size="icon" variant="ghost" className="h-6 w-6 text-primary hover:bg-primary/20" onClick={() => handleInspirationChange(1)}>
                  <Plus className="h-3 w-3" />
                </Button>
              </div>
              {!isCompactView && (
                <Button variant="outline" size="sm" onClick={() => setIsHouseRulesDialogOpen(true)} className="h-6 px-1.5 md:px-2" aria-label={t('houseRules')}>
                  <Scale className="h-3.5 w-3.5 md:h-4 md:w-4 md:mr-1.5" />
                  <span className="hidden md:inline text-xs">{t('houseRules')}</span>
                </Button>
              )}
            </div>
          )}

          {character && character.gameSystem === 'Dark Heresy' && !isCompactView && (
            <div className="flex shrink-0 items-center gap-2 border-l pl-2 md:pl-3">
              <Button variant="outline" size="sm" onClick={() => setIsHouseRulesDialogOpen(true)} className="h-7 px-1.5 md:px-2" aria-label={t('houseRules')}>
                <Scale className="h-3.5 w-3.5 md:h-4 md:w-4 md:mr-1.5" />
                <span className="hidden md:inline text-xs">{t('houseRules')}</span>
              </Button>
              <div className="flex items-center gap-1.5">
                <Label className="text-[10px] md:text-xs text-muted-foreground whitespace-nowrap hidden md:inline">
                  Edition:
                </Label>
                <Select
                  value={character.edition || '1st'}
                  onValueChange={(value: '1st' | '2nd' | 'hybrid') => updateCharacter(character.id, { edition: value })}
                >
                  <SelectTrigger className="h-7 w-[85px] md:w-[110px] text-[10px] md:text-xs" data-testid="dh-edition-select">
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
        </div>

        {/* 2. PRIMARY ACTIONS: shrink-0 prevents these from wrapping or shrinking */}
        <div className="flex shrink-0 items-center gap-1 md:gap-2">
          {mobileActions && (
            <DropdownMenu>
              <DropdownMenuTrigger asChild>
                <Button variant="outline" size="icon" className="sm:hidden h-8 w-8">
                  <Menu className="h-4 w-4" />
                  <span className="sr-only">Open menu</span>
                </Button>
              </DropdownMenuTrigger>
              <DropdownMenuContent align="end" className="w-56">
                {mobileActions}
              </DropdownMenuContent>
            </DropdownMenu>
          )}

          {character && !isSmallScreen && (
            <div className="flex items-center gap-1">
              {onNotesClick && (
                <Tooltip delayDuration={0}>
                  <TooltipTrigger asChild>
                    <Button variant="outline" size="icon" onClick={onNotesClick} aria-label={t('notes')} className="h-8 w-8 md:h-9 md:w-9">
                      <BookText className="h-4 w-4 md:h-5 md:w-5" />
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
                    <Button variant="outline" size="icon" onClick={onJournalClick} aria-label={t('questJournalTitle')} className="h-8 w-8 md:h-9 md:w-9">
                      <Scroll className="h-4 w-4 md:h-5 md:w-5" />
                    </Button>
                  </TooltipTrigger>
                  <TooltipContent side="bottom">
                    <p>{t('questJournalTitle')}</p>
                  </TooltipContent>
                </Tooltip>
              )}
            </div>
          )}

          {!isSmallScreen && (
            <Tooltip delayDuration={0}>
              <TooltipTrigger asChild>
                <Button variant="outline" size="icon" onClick={toggleCompactView} className="h-8 w-8 md:h-9 md:w-9">
                  {isCompactView ? <Monitor className="h-4 w-4 md:h-5 md:w-5" /> : <Smartphone className="h-4 w-4 md:h-5 md:w-5" />}
                </Button>
              </TooltipTrigger>
              <TooltipContent side="bottom">
                <p>{isCompactView ? t('switchToDefaultView') : t('switchToCompactView')}</p>
              </TooltipContent>
            </Tooltip>
          )}

          {character && !isSmallScreen && (
            <div className="flex items-center gap-1 md:border-l md:border-r md:px-2">
              <Tooltip delayDuration={0}>
                <TooltipTrigger asChild>
                  <Button variant={hideNotes ? 'ghost' : 'secondary'} onClick={() => setHideNotes(!hideNotes)} aria-label={hideNotes ? t('showNotes') : t('hideNotes')} size="icon" className="h-8 w-8 md:h-9 md:w-9">
                    {hideNotes ? <EyeOff className="h-4 w-4 md:h-5 md:w-5" /> : <Eye className="h-4 w-4 md:h-5 md:w-5" />}
                  </Button>
                </TooltipTrigger>
                <TooltipContent side="bottom">
                  <p>{hideNotes ? t('showNotes') : t('hideNotes')}</p>
                </TooltipContent>
              </Tooltip>

              <Tooltip delayDuration={0}>
                <TooltipTrigger asChild>
                  <Button variant={showEditButtons ? 'secondary' : 'ghost'} onClick={() => setShowEditButtons(!showEditButtons)} aria-label={showEditButtons ? t('hideEditButtons') : t('showEditButtons')} size="icon" className="h-8 w-8 md:h-9 md:w-9">
                    {showEditButtons ? <Pencil className="h-4 w-4 md:h-5 md:w-5" /> : <PencilLine className="h-4 w-4 md:h-5 md:w-5" />}
                  </Button>
                </TooltipTrigger>
                <TooltipContent side="bottom">
                  <p>{showEditButtons ? t('hideEditButtons') : t('showEditButtons')}</p>
                </TooltipContent>
              </Tooltip>
            </div>
          )}
        </div>

        {/* 3. SECONDARY ACTIONS: shrink-0 prevents these from wrapping or shrinking */}
        <div className="flex shrink-0 items-center gap-1 md:gap-2">
          {(!character || !isCompactView) && <LanguageToggle />}
          <ThemeToggle />
          <UserNav />
        </div>

        {/* Dialogs rendered outside the flex flow */}
        {character && character.gameSystem === 'Dungeons & Dragons' && (
          <HouseRulesDialog open={isHouseRulesDialogOpen} onOpenChange={setIsHouseRulesDialogOpen} characterId={character.id} />
        )}
        {character && character.gameSystem === 'Dark Heresy' && (
          <DhHouseRulesDialog open={isHouseRulesDialogOpen} onOpenChange={setIsHouseRulesDialogOpen} characterId={character.id} />
        )}
      </header>
    </TooltipProvider>
  );
}