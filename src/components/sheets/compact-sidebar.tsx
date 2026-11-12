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
} from 'lucide-react';

import { Button } from '@/components/ui/button';
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from '@/components/ui/tooltip';
import { useCharacterContext } from '@/context/character-context';
import { useTranslation } from '@/context/language-context';
import { resolveCharacterSystemId } from '@/games/character-system';
import { DhHouseRulesDialog as Dh1HouseRulesDialog } from '@/games/dh1/sections/dh-house-rules-dialog';
import { DhHouseRulesDialog as Dh2HouseRulesDialog } from '@/games/dh2/sections/dh-house-rules-dialog';
import { HouseRulesDialog } from '@/games/dnd5e/sections/house-rules-dialog';
import { type GameSystem } from '@/lib/types';
import { cn } from '@/lib/utils';

import { LanguageToggle } from '../layout/language-toggle';
import { Separator } from '../ui/separator';

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
  } = useCharacterContext();
  const character = params?.id ? getCharacter(params.id) : null;
  const isLevel20 =
    character?.gameSystem === 'Dungeons & Dragons' &&
    (character as any).level === 20;
  const [isHouseRulesDialogOpen, setIsHouseRulesDialogOpen] = useState(false);

  const dndItems = [
    { label: 'common.info', id: 'info-section', icon: Info },
    { label: 'dnd.abilityScores', id: 'stats-section', icon: Activity },
    { label: 'dnd.combatStats', id: 'combat-section', icon: Swords },
    {
      label: 'common.inventoryAndAttunement',
      id: 'inventory-section',
      icon: Backpack,
    },
    { label: 'dnd.spells', id: 'spells-section', icon: Sparkles },
    { label: 'dnd.companions', id: 'companion-section', icon: PawPrint },
    ...(isLevel20
      ? [{ label: 'dnd.divineBoons', id: 'boons-section', icon: Star }]
      : []),
  ];

  const dhPrefix =
    resolveCharacterSystemId(character ?? {}) === 'dh2' ? 'dh2' : 'dh1';
  const dhItems = [
    { label: 'common.info', id: 'info-section', icon: Info },
    {
      label: 'common.progression',
      id: 'progression-section',
      icon: TrendingUp,
    },
    { label: 'common.skills', id: 'skills-section', icon: BookOpen },
    {
      label: `${dhPrefix}.talentsAndTraits`,
      id: 'talents-section',
      icon: Star,
    },
    { label: `${dhPrefix}.equipment`, id: 'equipment-section', icon: Shield },
    { label: 'common.inventory', id: 'inventory-section', icon: Backpack },
  ];

  const sidebarItems = gameSystem === 'Dungeons & Dragons' ? dndItems : dhItems;

  const extraSidebarItems = [
    { label: 'common.notes', id: 'notes-section', icon: BookText },
    { label: 'common.questJournal', id: 'journal-section', icon: Scroll },
    { label: 'common.houseRules', id: 'house-rules', icon: Scale },
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
              aria-label={
                hideNotes ? t('common.showNotes') : t('common.hideNotes')
              }
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
            <p>{hideNotes ? t('common.showNotes') : t('common.hideNotes')}</p>
          </TooltipContent>
        </Tooltip>

        <Tooltip delayDuration={0}>
          <TooltipTrigger asChild>
            <Button
              variant={showEditButtons ? 'secondary' : 'ghost'}
              onClick={() => setShowEditButtons(!showEditButtons)}
              aria-label={
                showEditButtons
                  ? t('common.hideEditButtons')
                  : t('common.showEditButtons')
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
              {showEditButtons
                ? t('common.hideEditButtons')
                : t('common.showEditButtons')}
            </p>
          </TooltipContent>
        </Tooltip>

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
        {params?.id &&
          gameSystem === 'Dark Heresy' &&
          (resolveCharacterSystemId(character ?? {}) === 'dh2' ? (
            <Dh2HouseRulesDialog
              open={isHouseRulesDialogOpen}
              onOpenChange={setIsHouseRulesDialogOpen}
              characterId={params.id}
            />
          ) : (
            <Dh1HouseRulesDialog
              open={isHouseRulesDialogOpen}
              onOpenChange={setIsHouseRulesDialogOpen}
              characterId={params.id}
            />
          ))}
        {/* DH-HOUSE-RULES-SIDEBAR-MOUNT-END */}
      </nav>
    </TooltipProvider>
  );
}
