'use client';

import * as React from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '../../ui/card';
import { Input } from '../../ui/input';
import { Textarea } from '../../ui/textarea';
import { Button } from '../../ui/button';
import { Plus, Trash2, Edit, Save, Info } from 'lucide-react';
import { Label } from '@/components/ui/label';
import { Popover, PopoverContent, PopoverTrigger } from '../../ui/popover';
import { cn } from '@/lib/utils';
import { useCharacterContext } from '@/context/character-context';
import { useTranslation } from '@/context/language-context';

type DnDStats = { strength: number; dexterity: number; constitution: number; intelligence: number; wisdom: number; charisma: number };
type DnDStatNotes = { strength?: string; dexterity?: string; constitution?: string; intelligence?: string; wisdom?: string; charisma?: string };

const StatBox = ({ label, value, editing, onChange, isCompactView, notes, onNoteChange, hideNotes }: {
  label: string; value: number; editing: boolean;
  onChange: (e: React.ChangeEvent<HTMLInputElement>) => void;
  isCompactView: boolean; notes?: string;
  onNoteChange: (val: string) => void; hideNotes: boolean;
}) => {
  const modifier = Math.floor((value - 10) / 2);
  const displayModifier = modifier >= 0 ? `+${modifier}` : modifier.toString();
  return (
    <div className={cn("flex flex-col items-center justify-center rounded-lg bg-background text-center border relative", isCompactView ? "p-1" : "p-4")}>
      {!hideNotes && (
        <Popover>
          <PopoverTrigger asChild>
            <Button variant={notes ? 'secondary' : 'ghost'} size="icon" className="h-5 w-5 absolute top-1 right-1">
              <Info className="h-3 w-3" />
            </Button>
          </PopoverTrigger>
          <PopoverContent className="w-64">
            <Label className="text-xs mb-2 block">Notes for {label}</Label>
            <Textarea defaultValue={notes || ''} onBlur={(e) => onNoteChange(e.target.value)} placeholder="Add notes..." className="min-h-[100px] text-sm" />
          </PopoverContent>
        </Popover>
      )}
      <div className={cn("text-[10px] text-muted-foreground uppercase tracking-wider font-bold", isCompactView && "text-[8px]")}>{label}</div>
      <div className="mt-1">
        {editing ? (
          <Input type="number" min={1} max={30} value={value} onChange={onChange} className={cn("text-base font-bold h-7 w-24 text-center", isCompactView && "text-sm h-6 w-16")} />
        ) : (
          <div className={cn("text-base font-bold text-muted-foreground", isCompactView && "text-sm")}>{value}</div>
        )}
      </div>
      <div className="mt-2 w-full">
        <div className="text-[8px] text-muted-foreground uppercase font-bold mb-0.5">Mod</div>
        <div className={cn("text-base font-bold py-1 rounded border shadow-inner bg-background text-foreground border-border", isCompactView && "text-sm py-0.5")}>{displayModifier}</div>
      </div>
    </div>
  );
};

const EditSaveButton = ({ editing, onEdit, onSave }: { editing: boolean; onEdit: () => void; onSave: () => void }) => (
  editing ? ( <Button size="icon" variant="ghost" onClick={onSave} className="h-7 w-7"><Save className="h-4 w-4" /></Button> ) : ( <Button size="icon" variant="outline" onClick={onEdit} className="h-7 w-7"><Edit className="h-4 w-4" /></Button> )
);

interface StatsSectionProps {
  characterId: string;
  stats: DnDStats;
  setStats: React.Dispatch<React.SetStateAction<DnDStats>>;
  isStatsEditing: boolean;
  setIsStatsEditing: React.Dispatch<React.SetStateAction<boolean>>;
  handleSaveStats: () => void;
  statNotes?: DnDStatNotes;
  otherProficienciesAndLanguages: string[];
  setOtherProficienciesAndLanguages: React.Dispatch<React.SetStateAction<string[]>>;
  isOtherProficienciesEditing: boolean;
  setIsOtherProficienciesEditing: React.Dispatch<React.SetStateAction<boolean>>;
  newProfItem: string;
  setNewProfItem: React.Dispatch<React.SetStateAction<string>>;
  handleSaveOtherProf: () => void;
  isCompactView: boolean;
  activeCompactSection: string;
}

export function DndStatsSection({
  characterId, stats, setStats, isStatsEditing, setIsStatsEditing, handleSaveStats, statNotes,
  otherProficienciesAndLanguages, setOtherProficienciesAndLanguages, isOtherProficienciesEditing,
  setIsOtherProficienciesEditing, newProfItem, setNewProfItem, handleSaveOtherProf, isCompactView, activeCompactSection
}: StatsSectionProps) {
  const { updateCharacter, showEditButtons, hideNotes, getCharacter } = useCharacterContext();
  const { t } = useTranslation();

   // Calculate Passive Perception
  const currentChar = getCharacter(characterId);
  const wisdomMod = Math.floor((stats.wisdom - 10) / 2);
  
  // Robustly find the Perception skill
  const perceptionSkill = currentChar?.gameSystem === 'Dungeons & Dragons' 
    ? (currentChar as any).skills?.find((s: any) => 
        s.label?.toLowerCase().includes('perception') || s.name?.toLowerCase().includes('perception')
      )
    : null;
    
  const profBonus = currentChar?.gameSystem === 'Dungeons & Dragons' 
    ? (currentChar as any).proficiencyBonus || 0 
    : 0;
    
  // Formula: 10 + WisMod + (ProfBonus if proficient) + (ProfBonus if expertise)
  const perceptionBonus = perceptionSkill 
    ? (perceptionSkill.proficient ? profBonus : 0) + (perceptionSkill.expertise ? profBonus : 0)
    : 0;
    
  const passivePerception = 10 + wisdomMod + perceptionBonus;

  return (
    <div className={cn("md:col-span-2 space-y-4", isCompactView && activeCompactSection !== 'stats-section' && "hidden")}>
    {!isCompactView && (
      <Card>
        <CardHeader className="flex flex-row items-center justify-between px-4 pt-2 pb-2">
          <CardTitle className="text-[10px] font-bold uppercase text-muted-foreground tracking-tight">{t('characteristics')}</CardTitle>
          {(showEditButtons || isStatsEditing) && <EditSaveButton editing={isStatsEditing} onEdit={() => setIsStatsEditing(true)} onSave={handleSaveStats} />}
        </CardHeader>
        <CardContent className="space-y-3 p-4 pt-0">
          {['strength', 'dexterity', 'constitution', 'intelligence', 'wisdom', 'charisma'].map(key => (
            <StatBox 
              key={key} 
              label={key} 
              value={stats[key as keyof DnDStats]} 
              editing={isStatsEditing} 
              onChange={e => setStats({ ...stats, [key]: parseInt(e.target.value) || 1 })} 
              isCompactView={isCompactView} 
              notes={statNotes?.[key as keyof DnDStatNotes]} 
              onNoteChange={v => updateCharacter(characterId, { statNotes: { ...(statNotes || {}), [key]: v } })} 
              hideNotes={hideNotes} 
            />
          ))}
          
          {/* Passive Perception Display */}
          <div className="pt-3 mt-3 border-t">
            <div className="flex items-center justify-between p-3 rounded-lg bg-primary/5 border border-primary/20">
              <div className="flex flex-col">
                <Label className="text-[10px] text-muted-foreground uppercase font-bold">{t('passivePerception')}</Label>
                <span className="text-[10px] text-muted-foreground">
                  10 + Wisdom Mod {perceptionBonus > 0 ? `+ ${perceptionBonus}` : ''}
                </span>
              </div>
              <div className="text-2xl font-black text-primary">{passivePerception}</div>
            </div>
          </div>
        </CardContent>
      </Card>
    )}
      <Card>
        <CardHeader className="flex flex-row items-center justify-between px-4 pt-2 pb-2">
          <CardTitle className="text-[10px] font-bold uppercase text-muted-foreground tracking-tight">{t('otherProficienciesAndLanguages')}</CardTitle>
          {(showEditButtons || isOtherProficienciesEditing) && <EditSaveButton editing={isOtherProficienciesEditing} onEdit={() => setIsOtherProficienciesEditing(true)} onSave={handleSaveOtherProf} />}
        </CardHeader>
        <CardContent className="p-4 pt-0 space-y-2">
          {otherProficienciesAndLanguages.map((it, i) => (
            <div key={i} className="text-[10px] p-1.5 rounded bg-muted/10 flex justify-between">
              {isOtherProficienciesEditing ? (
                <Input value={it} onChange={e => { const n = [...otherProficienciesAndLanguages]; n[i] = e.target.value; setOtherProficienciesAndLanguages(n); }} className="h-6 text-[10px] flex-1 mr-2" />
              ) : (<span className="break-words font-medium">&bull; {it}</span>)}
              {isOtherProficienciesEditing && (<Button variant="ghost" size="icon" className="h-5 w-5 text-destructive" onClick={() => setOtherProficienciesAndLanguages(otherProficienciesAndLanguages.filter((_, idx) => idx !== i))}><Trash2 className="h-3 w-3" /></Button>)}
            </div>
          ))}
          {isOtherProficienciesEditing && (
            <div className="flex gap-2 pt-2 border-t">
              <Input placeholder="New..." value={newProfItem} onChange={e => setNewProfItem(e.target.value)} className="h-7 text-[10px]" />
              <Button size="sm" className="h-7" onClick={() => { if (newProfItem.trim()) { setOtherProficienciesAndLanguages([...otherProficienciesAndLanguages, newProfItem.trim()]); setNewProfItem(''); } }}><Plus className="h-3 w-3" /></Button>
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}