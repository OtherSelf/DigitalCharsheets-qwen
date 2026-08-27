'use client';

import * as React from 'react';
import { type DnDCompanion } from '@/lib/types';
import { Button } from '../../ui/button';
import { Plus } from 'lucide-react';
import { cn } from '@/lib/utils';
import { useCharacterContext } from '@/context/character-context';
import { useTranslation } from '@/context/language-context';
import { CompanionSheet } from './companion-sheet';

interface CompanionsSectionProps {
  characterId: string;
  companions: DnDCompanion[];
  setCompanions: React.Dispatch<React.SetStateAction<DnDCompanion[]>>;
  isCompactView: boolean;
  activeCompactSection: string;
}

export function DndCompanionsSection({ characterId, companions, setCompanions, isCompactView, activeCompactSection }: CompanionsSectionProps) {
  const { updateCharacter, showEditButtons } = useCharacterContext();
  const { t } = useTranslation();

  const [editingCompanionId, setEditingCompanionId] = React.useState<string | null>(null);

  const handleAddCompanion = () => {
    const newCompanion: DnDCompanion = {
      id: `comp-${Date.now()}`,
      name: 'New Companion',
      type: '',
      size: '',
      armorClass: 10,
      initiative: 0,
      speed: '30',
      proficiencyBonus: '+2',
      stats: { strength: 10, dexterity: 10, constitution: 10, intelligence: 10, wisdom: 10, charisma: 10 },
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
      showHitDice: true
    };
    const n = [...companions, newCompanion];
    setCompanions(n);
    updateCharacter(characterId, { companions: n });
    setEditingCompanionId(newCompanion.id);
  };

  const updateCompanion = (companionId: string, updates: Partial<DnDCompanion>) => {
    const n = companions.map(c => c.id === companionId ? { ...c, ...updates } : c);
    setCompanions(n);
    updateCharacter(characterId, { companions: n });
  };

  const handleDeleteCompanion = (companionId: string) => {
    const n = companions.filter(c => c.id !== companionId);
    setCompanions(n);
    updateCharacter(characterId, { companions: n });
    if (editingCompanionId === companionId) setEditingCompanionId(null);
  };

  return (
    <div className={cn("space-y-8", isCompactView && activeCompactSection !== 'companion-section' && "hidden")}>
      <div className="flex justify-between items-center mb-6">
        <h2 className="text-3xl font-headline font-bold">{t('companions')}</h2>
        {showEditButtons && (
          <Button size="sm" variant="outline" onClick={handleAddCompanion}>
            <Plus className="h-4 w-4 mr-2" /> {t('addCompanion') || 'Add Companion'}
          </Button>
        )}
      </div>
      
      {companions.map(comp => (
        <CompanionSheet
          key={comp.id}
          companion={comp}
          onUpdate={(updates) => updateCompanion(comp.id, updates)}
          onDelete={() => handleDeleteCompanion(comp.id)}
          isEditing={editingCompanionId === comp.id && showEditButtons}
          onToggleEdit={() => setEditingCompanionId(editingCompanionId === comp.id ? null : comp.id)}
        />
      ))}
      
      {companions.length === 0 && showEditButtons && (
        <div className="text-center p-12 border-2 border-dashed rounded-lg bg-muted/10">
          <p className="text-muted-foreground mb-4">No companions added yet.</p>
          <Button size="sm" variant="outline" onClick={handleAddCompanion}>
            <Plus className="h-4 w-4 mr-2" /> Add Your First Companion
          </Button>
        </div>
      )}
    </div>
  );
}