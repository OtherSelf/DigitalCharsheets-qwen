// src/components/sheets/compact-sidebar.tsx
'use client';

import { useState } from 'react';
import { useParams } from 'next/navigation';

import {
  Activity,
  Backpack,
  BookOpen,
  BookText,
  Eye,
  EyeOff,
  Info,
  Layers,
  PawPrint,
  Pencil,
  PencilLine,
  Scale,
  Scroll,
  Shield,
  Sparkles,
  Star,
  Swords,
  TrendingUp,
  Wand2,
} from 'lucide-react';

import { Button } from '@/components/ui/button';
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from '@/components/ui/popover';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from '@/components/ui/tooltip';
import { useCharacterContext } from '@/context/character-context';
import { useTranslation } from '@/context/language-context';
import { type GameSystem } from '@/lib/types';
import { cn } from '@/lib/utils';

import { LanguageToggle } from '../layout/language-toggle';
import { Separator } from '../ui/separator';
import { DhHouseRulesDialog } from './dh-sections/dh-house-rules-dialog';
import { HouseRulesDialog } from './dnd-sections/house-rules-dialog';

interface CompactSidebarProps {
  gameSystem: GameSystem;
  activeSection: string;
  onSectionChange: (id: string) => void;
}

export function CompactSidebar({
  gameSystem,
  activeSection,
  onSectionChange,
}: CompactSidebarProps) {
  const { t } = useTranslation();
  const params = useParams<{ id: string }>();
  const {
    getCharacter,
    hideNotes,
    setHideNotes,
    showEditButtons,
    setShowEditButtons,
    updateCharacter,
  } = useCharacterContext();
  const character = params?.id ? getCharacter(params.id) : null;
  const isLevel20 =
    character?.gameSystem === 'Dungeons & Dragons' &&
    (character as any).level === 20;
  const [isHouseRulesDialogOpen, setIsHouseRulesDialogOpen] = useState(false);

  const dndItems = [
    { label: 'info', id: 'info-section', icon: Info },
    { label: 'abilityScores', id: 'stats-section', icon: Activity },
    { label: 'combatStats', id: 'combat-section', icon: Swords },
    {
      label: 'inventoryAndAttunement',
      id: 'inventory-section',
      icon: Backpack,
    },
    { label: 'spells', id: 'spells-section', icon: Sparkles },
    { label: 'companions', id: 'companion-section', icon: PawPrint },
    ...(isLevel20
      ? [{ label: 'divineBoons', id: 'boons-section', icon: Star }]
      : []),
  ];

  const dhItems = [
    { label: 'info', id: 'info-section', icon: Info },
    { label: 'progression', id: 'progression-section', icon: TrendingUp },
    { label: 'skills', id: 'skills-section', icon: BookOpen },
    { label: 'talentsAndTraits', id: 'talents-section', icon: Star },
    { label: 'equipment', id: 'equipment-section', icon: Shield },
    { label: 'inventory', id: 'inventory-section', icon: Backpack },
  ];

  const sidebarItems = gameSystem === 'Dungeons & Dragons' ? dndItems : dhItems;

  const extraSidebarItems = [
    { label: 'notes', id: 'notes-section', icon: BookText },
    { label: 'questJournal', id: 'journal-section', icon: Scroll },
    { label: 'houseRules', id: 'house-rules', icon: Scale },
  ];

  return (
    <TooltipProvider>
      <nav
        className={cn(
          'bg-card z-20 flex flex-col items-center gap-2 border-r p-2',
          'w-16',
        )}
      >
        {sidebarItems.map((item) => (
          <Tooltip key={item.id} delayDuration={0}>
            <TooltipTrigger asChild>
              <Button
                variant={activeSection === item.id ? 'secondary' : 'ghost'}
                onClick={() => onSectionChange(item.id)}
                aria-label={t(item.label)}
                className="w-full"
                size="icon"
              >
                <item.icon className="h-5 w-5" />
              </Button>
            </TooltipTrigger>
            <TooltipContent side="right">
              <p>{t(item.label)}</p>
            </TooltipContent>
          </Tooltip>
        ))}

        <Separator className="my-2" />

        {extraSidebarItems.map((item) => (
          <Tooltip key={item.id} delayDuration={0}>
            <TooltipTrigger asChild>
              <Button
                variant="ghost"
                onClick={() => {
                  if (item.id === 'house-rules') {
                    setIsHouseRulesDialogOpen(true);
                  } else {
                    onSectionChange(item.id);
                  }
                }}
                aria-label={t(item.label)}
                className="w-full"
                size="icon"
              >
                <item.icon className="h-5 w-5" />
              </Button>
            </TooltipTrigger>
            <TooltipContent side="right">
              <p>{t(item.label)}</p>
            </TooltipContent>
          </Tooltip>
        ))}

        <Separator className="my-2" />

        <Tooltip delayDuration={0}>
          <TooltipTrigger asChild>
            <Button
              variant={hideNotes ? 'ghost' : 'secondary'}
              onClick={() => setHideNotes(!hideNotes)}
              aria-label={hideNotes ? t('showNotes') : t('hideNotes')}
              className="w-full"
              size="icon"
            >
              {hideNotes ? (
                <EyeOff className="h-5 w-5" />
              ) : (
                <Eye className="h-5 w-5" />
              )}
            </Button>
          </TooltipTrigger>
          <TooltipContent side="right">
            <p>{hideNotes ? t('showNotes') : t('hideNotes')}</p>
          </TooltipContent>
        </Tooltip>

        <Tooltip delayDuration={0}>
          <TooltipTrigger asChild>
            <Button
              variant={showEditButtons ? 'secondary' : 'ghost'}
              onClick={() => setShowEditButtons(!showEditButtons)}
              aria-label={
                showEditButtons ? t('hideEditButtons') : t('showEditButtons')
              }
              className="w-full"
              size="icon"
            >
              {showEditButtons ? (
                <Pencil className="h-5 w-5" />
              ) : (
                <PencilLine className="h-5 w-5" />
              )}
            </Button>
          </TooltipTrigger>
          <TooltipContent side="right">
            <p>
              {showEditButtons ? t('hideEditButtons') : t('showEditButtons')}
            </p>
          </TooltipContent>
        </Tooltip>

        {/* ─── LANDMARK: EDITION SELECTOR FOR MOBILE SIDEBAR ─── */}
        {character?.gameSystem === 'Dark Heresy' && (
          <Popover>
            <PopoverTrigger asChild>
              <Button
                variant="ghost"
                aria-label={t('selectEdition')}
                className="w-full"
                size="icon"
              >
                <Layers className="h-5 w-5" />
              </Button>
            </PopoverTrigger>
            <PopoverContent side="right" align="center" className="w-40 p-2">
              <div className="space-y-2">
                <p className="text-muted-foreground text-xs font-medium">
                  {t('edition')}
                </p>
                <Select
                  value={character.edition || '1st'}
                  onValueChange={(value: '1st' | '2nd' | 'hybrid') => {
                    if (character)
                      updateCharacter(character.id, { edition: value });
                  }}
                >
                  <SelectTrigger className="h-8 text-xs">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="1st">{t('firstEdition')}</SelectItem>
                    <SelectItem value="2nd">{t('secondEdition')}</SelectItem>
                    <SelectItem value="hybrid">{t('hybridView')}</SelectItem>
                  </SelectContent>
                </Select>
              </div>
            </PopoverContent>
          </Popover>
        )}
        {/* ─── END EDITION SELECTOR ─── */}

        <div className="mt-auto flex flex-col items-center gap-2 pt-2">
          <Separator className="mb-2 w-full" />
          <LanguageToggle className="h-10 w-10" />
        </div>

        {/* DH-HOUSE-RULES-SIDEBAR-MOUNT-START */}
        {params?.id && gameSystem === 'Dungeons & Dragons' && (
          <HouseRulesDialog
            open={isHouseRulesDialogOpen}
            onOpenChange={setIsHouseRulesDialogOpen}
            characterId={params.id}
          />
        )}
        {params?.id && gameSystem === 'Dark Heresy' && (
          <DhHouseRulesDialog
            open={isHouseRulesDialogOpen}
            onOpenChange={setIsHouseRulesDialogOpen}
            characterId={params.id}
          />
        )}
        {/* DH-HOUSE-RULES-SIDEBAR-MOUNT-END */}
      </nav>
    </TooltipProvider>
  );
}
