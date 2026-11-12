// src/components/sheets/compact-sidebar.tsx
'use client';

import { useState } from 'react';

import {
  BookText,
  Eye,
  EyeOff,
  Pencil,
  PencilLine,
  Scale,
  Scroll,
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
import { getCharacterModule } from '@/games/character-system';
import { type Character } from '@/lib/types';
import { cn } from '@/lib/utils';

import { LanguageToggle } from '../layout/language-toggle';
import { Separator } from '../ui/separator';

interface CompactSidebarProps {
  character: Character;
  activeSection: string;
  onSectionChange: (id: string) => void;
}

/**
 * ─── LANDMARK: COMPACT SIDEBAR ─────────────────────────────────────────────
 * Мобильный сайдбар листа. Список секций — это слот плагина `CompactNav`
 * (этап 3): у D&D и DH разные наборы и разные i18n-ключи. Общие пункты
 * «Заметки / Журнал / Домашние правила» рисует ядро; тело диалога правил
 * приходит из слота `HouseRulesDialog`, поэтому игровых проверок здесь нет.
 */
export function CompactSidebar({
  character,
  activeSection,
  onSectionChange,
}: CompactSidebarProps) {
  const { t } = useTranslation();
  const { hideNotes, setHideNotes, showEditButtons, setShowEditButtons } =
    useCharacterContext();
  const [isHouseRulesDialogOpen, setIsHouseRulesDialogOpen] = useState(false);

  const gameModule = getCharacterModule(character);
  const navItems = gameModule?.ui?.CompactNav?.(character) ?? [];
  const HouseRulesDialogSlot = gameModule?.ui?.HouseRulesDialog;

  const extraSidebarItems = [
    {
      labelKey: 'common.notes',
      id: 'notes-section',
      icon: <BookText className="h-5 w-5" />,
    },
    {
      labelKey: 'common.questJournal',
      id: 'journal-section',
      icon: <Scroll className="h-5 w-5" />,
    },
    ...(HouseRulesDialogSlot
      ? [
          {
            labelKey: 'common.houseRules',
            id: 'house-rules',
            icon: <Scale className="h-5 w-5" />,
          },
        ]
      : []),
  ];

  return (
    <TooltipProvider>
      <nav
        className={cn(
          'bg-card z-20 flex flex-col items-center gap-2 border-r p-2',
          'w-16',
        )}
      >
        {navItems.map((item) => (
          <Tooltip key={item.id} delayDuration={0}>
            <TooltipTrigger asChild>
              <Button
                variant={activeSection === item.id ? 'secondary' : 'ghost'}
                onClick={() => onSectionChange(item.id)}
                aria-label={t(item.labelKey)}
                className="w-full"
                size="icon"
              >
                {item.icon}
              </Button>
            </TooltipTrigger>
            <TooltipContent side="right">
              <p>{t(item.labelKey)}</p>
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
                aria-label={t(item.labelKey)}
                className="w-full"
                size="icon"
              >
                {item.icon}
              </Button>
            </TooltipTrigger>
            <TooltipContent side="right">
              <p>{t(item.labelKey)}</p>
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

        {HouseRulesDialogSlot && (
          <HouseRulesDialogSlot
            characterId={character.id}
            open={isHouseRulesDialogOpen}
            onOpenChange={setIsHouseRulesDialogOpen}
          />
        )}
      </nav>
    </TooltipProvider>
  );
}
