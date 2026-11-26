'use client';

import * as React from 'react';

import { ChevronDown, ChevronUp, Plus } from 'lucide-react';

import { Button } from '@/components/ui/button';
import {
  Collapsible,
  CollapsibleContent,
  CollapsibleTrigger,
} from '@/components/ui/collapsible';
import { useCharacterContext, useTranslation } from '@/games/plugin-host';
import { cn } from '@/lib/utils';

import type { DnDCompanion } from '../types';
import { CompanionSheet } from './companion-sheet';

interface CompanionsSectionProps {
  characterId: string;
  companions: DnDCompanion[];
  setCompanions: React.Dispatch<React.SetStateAction<DnDCompanion[]>>;
  isCompactView: boolean;
  /** Телефонная подача: только она прячет соседние секции. */
  isPhoneView: boolean;
  activeCompactSection: string;
}

export function DndCompanionsSection({
  characterId,
  companions,
  setCompanions,
  isCompactView,
  isPhoneView,
  activeCompactSection,
}: CompanionsSectionProps) {
  const { updateCharacter, showEditButtons } = useCharacterContext();
  const { t } = useTranslation();
  const [isCompanionsOpen, setIsCompanionsOpen] = React.useState(true);
  const [editingCompanionId, setEditingCompanionId] = React.useState<
    string | null
  >(null);

  const handleAddCompanion = () => {
    const newCompanion: DnDCompanion = {
      id: `comp-${Date.now()}`,
      name: t('dnd.newCompanion'),
      type: '',
      size: '',
      armorClass: 10,
      initiative: 0,
      speed: '30',
      proficiencyBonus: '+2',
      stats: {
        strength: 10,
        dexterity: 10,
        constitution: 10,
        intelligence: 10,
        wisdom: 10,
        charisma: 10,
      },
      skills: [],
      hitPoints: { current: 10, max: 10 },
      actions: [],
      features: [],
      characterClass: 'NPC',
      level: 1,
      experiencePoints: 0,
      hitDice: '1d8',
      showStats: true,
      showCombat: true,
      showAttacks: true,
      showInventory: true,
      showSpells: false,
      showNarrative: false,
      showInfo: false,
      showProgression: false,
      showDivineBoons: false,
      showHitDice: true,
    };
    const n = [...companions, newCompanion];
    setCompanions(n);
    updateCharacter(characterId, { companions: n });
    setEditingCompanionId(newCompanion.id);
  };

  const updateCompanion = (
    companionId: string,
    updates: Partial<DnDCompanion>,
  ) => {
    const n = companions.map((c) =>
      c.id === companionId ? { ...c, ...updates } : c,
    );
    setCompanions(n);
    updateCharacter(characterId, { companions: n });
  };

  const handleDeleteCompanion = (companionId: string) => {
    const n = companions.filter((c) => c.id !== companionId);
    setCompanions(n);
    updateCharacter(characterId, { companions: n });
    if (editingCompanionId === companionId) setEditingCompanionId(null);
  };

  return (
    <Collapsible
      id="companions-section"
      open={isCompanionsOpen}
      onOpenChange={setIsCompanionsOpen}
      className={cn(
        'space-y-8',
        isPhoneView &&
          activeCompactSection !== 'companions-section' &&
          'hidden',
      )}
    >
      {/*
        На телефоне заголовок и «Add Companion» стоят в потоке и переносятся
        на вторую строку: absolute-кнопка накладывалась на заголовок и резала
        его до «Comp…». С md заголовок снова по центру, кнопка — справа.
      */}
      <div className="relative mb-6 flex flex-wrap items-center justify-between gap-2 md:justify-center">
        <CollapsibleTrigger asChild>
          <Button
            variant="ghost"
            size="sm"
            className="flex h-auto items-center gap-2 p-0 hover:bg-transparent"
          >
            <h2 className="font-headline text-2xl font-bold">
              {t('dnd.companions')}
            </h2>
            {isCompanionsOpen ? (
              <ChevronUp className="h-5 w-5" />
            ) : (
              <ChevronDown className="h-5 w-5" />
            )}
          </Button>
        </CollapsibleTrigger>
        {showEditButtons && (
          <div className="md:absolute md:top-1/2 md:right-0 md:-translate-y-1/2">
            <Button size="sm" variant="outline" onClick={handleAddCompanion}>
              <Plus className="mr-2 h-4 w-4" /> {t('dnd.addCompanion')}
            </Button>
          </div>
        )}
      </div>

      <CollapsibleContent className="space-y-8">
        {companions.map((comp) => (
          <CompanionSheet
            key={comp.id}
            companion={comp}
            onUpdate={(updates) => updateCompanion(comp.id, updates)}
            onDelete={() => handleDeleteCompanion(comp.id)}
            isEditing={editingCompanionId === comp.id && showEditButtons}
            onToggleEdit={() =>
              setEditingCompanionId(
                editingCompanionId === comp.id ? null : comp.id,
              )
            }
          />
        ))}

        {companions.length === 0 && showEditButtons && (
          <div className="bg-muted/10 rounded-lg border-2 border-dashed p-12 text-center">
            <p className="text-muted-foreground mb-4">
              {t('dnd.noCompanionsAdded')}
            </p>
            <Button size="sm" variant="outline" onClick={handleAddCompanion}>
              <Plus className="mr-2 h-4 w-4" /> {t('dnd.addYourFirstCompanion')}
            </Button>
          </div>
        )}
      </CollapsibleContent>
    </Collapsible>
  );
}
