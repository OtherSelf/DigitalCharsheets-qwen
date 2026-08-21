'use client';

import { Button } from '@/components/ui/button';
import {
  Info,
  TrendingUp,
  BookOpen,
  Star,
  Shield,
  Backpack,
  Scroll,
  BookText,
  Activity,
  Swords,
  Sparkles,
  PawPrint,
  Eye,
  EyeOff,
  Pencil,
  PencilLine,
  Wand2,
} from 'lucide-react';
import { cn } from '@/lib/utils';
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from '@/components/ui/tooltip';
import { Separator } from '../ui/separator';
import { useTranslation } from '@/context/language-context';
import { LanguageToggle } from '../layout/language-toggle';
import { type GameSystem } from '@/lib/types';
import { useCharacterContext } from '@/context/character-context';

interface CompactSidebarProps {
  gameSystem: GameSystem;
  activeSection: string;
  onSectionChange: (id: string) => void;
}

export function CompactSidebar({ gameSystem, activeSection, onSectionChange }: CompactSidebarProps) {
  const { t } = useTranslation();
  const { hideNotes, setHideNotes, showEditButtons, setShowEditButtons } = useCharacterContext();

  const dndItems = [
    { label: 'info', id: 'info-section', icon: Info },
    { label: 'stats', id: 'stats-section', icon: Activity },
    { label: 'boons', id: 'boons-section', icon: Sparkles },
    { label: 'combat', id: 'combat-section', icon: Swords },
    { label: 'inventoryAndAttunement', id: 'inventory-section', icon: Backpack },
    { label: 'spells', id: 'spells-section', icon: Wand2 },
    { label: 'companions', id: 'companion-section', icon: PawPrint },
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
  ];

  return (
    <TooltipProvider>
      <nav
        className={cn(
          'bg-card border-r flex flex-col items-center p-2 gap-2 z-20',
          'w-16'
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
                 variant={'ghost'}
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
        
        <Tooltip delayDuration={0}>
          <TooltipTrigger asChild>
            <Button
              variant={hideNotes ? 'secondary' : 'ghost'}
              onClick={() => setHideNotes(!hideNotes)}
              aria-label={t('hideNotes')}
              className="w-full"
              size="icon"
            >
              {hideNotes ? <EyeOff className="h-5 w-5" /> : <Eye className="h-5 w-5" />}
            </Button>
          </TooltipTrigger>
          <TooltipContent side="right">
            <p>{t('hideNotes')}</p>
          </TooltipContent>
        </Tooltip>

        <Tooltip delayDuration={0}>
          <TooltipTrigger asChild>
            <Button
              variant={showEditButtons ? 'secondary' : 'ghost'}
              onClick={() => setShowEditButtons(!showEditButtons)}
              aria-label={t('showEditButtons')}
              className="w-full"
              size="icon"
            >
              {showEditButtons ? <Pencil className="h-5 w-5" /> : <PencilLine className="h-5 w-5" />}
            </Button>
          </TooltipTrigger>
          <TooltipContent side="right">
            <p>{t('showEditButtons')}</p>
          </TooltipContent>
        </Tooltip>

        <div className="mt-auto pt-2 flex flex-col items-center gap-2">
          <Separator className="w-full mb-2" />
          <LanguageToggle className="h-10 w-10" />
        </div>
      </nav>
    </TooltipProvider>
  );
}
