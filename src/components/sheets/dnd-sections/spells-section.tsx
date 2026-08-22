'use client';

import * as React from 'react';
import { type Spell } from '@/lib/types';
import { Card, CardContent, CardHeader, CardTitle } from '../../ui/card';
import { Input } from '../../ui/input';
import { Textarea } from '../../ui/textarea';
import { Button } from '../../ui/button';
import { Checkbox } from '../../ui/checkbox';
import { Plus, Trash2, Minus, Info, Edit, Save } from 'lucide-react';
import { Label } from '@/components/ui/label';
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from '../../ui/popover';
import { cn } from '@/lib/utils';
import { useCharacterContext } from '@/context/character-context';
import { useTranslation } from '@/context/language-context';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '../../ui/select';

const EditSaveButton = ({ editing, onEdit, onSave }: { editing: boolean, onEdit: () => void, onSave: () => void }) => (
  editing ? ( <Button size="icon" variant="ghost" onClick={onSave} className="h-7 w-7"><Save className="h-4 w-4" /></Button> ) : ( <Button size="icon" variant="outline" onClick={onEdit} className="h-7 w-7"><Edit className="h-4 w-4" /></Button> )
);

const DEFAULT_SLOTS = {
  1: { max: 0, current: 0 }, 2: { max: 0, current: 0 }, 3: { max: 0, current: 0 },
  4: { max: 0, current: 0 }, 5: { max: 0, current: 0 }, 6: { max: 0, current: 0 },
  7: { max: 0, current: 0 }, 8: { max: 0, current: 0 }, 9: { max: 0, current: 0 },
};

interface SpellsSectionProps {
  characterId: string;
  initialSpells: Spell[];
  initialSpellSlots?: Record<number, { max: number; current: number }>;
  isCompactView: boolean;
  activeCompactSection: string;
  initialSpellcasting?: { spellcastingAbility: string; spellAttackBonus: string; spellSaveDifficulty: number };
}

export function DndSpellsSection({ characterId, initialSpells, initialSpellSlots, isCompactView, activeCompactSection, initialSpellcasting }: SpellsSectionProps) {
  const { updateCharacter, showEditButtons, hideNotes } = useCharacterContext();
  const { t } = useTranslation();

  const [spells, setSpells] = React.useState<Spell[]>(initialSpells);
  const [spellSlots, setSpellSlots] = React.useState(initialSpellSlots || DEFAULT_SLOTS);
  const [editingLevel, setEditingLevel] = React.useState<number | null>(null);
  const [newSpellName, setNewSpellName] = React.useState('');
  const [spellcastingData, setSpellcastingData] = React.useState(initialSpellcasting || { spellcastingAbility: 'none', spellAttackBonus: '', spellSaveDifficulty: 0 });
  const [isSpellcastingEditing, setIsSpellcastingEditing] = React.useState(false);

const handleSaveSpellcasting = React.useCallback(() => {
  updateCharacter(characterId, {
    spellcastingAbility: spellcastingData.spellcastingAbility as any,
    spellAttackBonus: spellcastingData.spellAttackBonus,
    spellSaveDifficulty: spellcastingData.spellSaveDifficulty,
  });
  setIsSpellcastingEditing(false);
}, [characterId, spellcastingData, updateCharacter]);

  // Re-sync when switching to a different character
  React.useEffect(() => {
    setSpells(initialSpells);
    setSpellSlots(initialSpellSlots || DEFAULT_SLOTS);
    setSpellcastingData(initialSpellcasting || { spellcastingAbility: 'none', spellAttackBonus: '', spellSaveDifficulty: 0 });
  }, [characterId, initialSpells, initialSpellSlots, initialSpellcasting]); 

  const renderSpellBox = (level: number, title: string) => {
    const levelSpells = spells.filter(s => s.level === level);
    const slots = spellSlots[level] || { max: 0, current: 0 };
    const isEditing = editingLevel === level;
    return (
      <Card key={level} className="flex flex-col border-2 overflow-hidden h-full">
        <CardHeader className="flex flex-col px-4 pt-2 pb-2 border-b bg-muted/10">
          <div className="flex flex-row items-center justify-between w-full mb-1">
            <CardTitle className="text-[10px] font-bold uppercase text-muted-foreground tracking-tight">{title}</CardTitle>
            {level > 0 && (
              <div className="flex items-center gap-2">
                <span className="text-[10px] uppercase font-bold text-muted-foreground">{t('slots')}</span>
                <div className="flex items-center gap-1">
                  <Button size="icon" variant="outline" className="h-5 w-5" onClick={() => { 
  const newMax = Math.max(0, slots.max - 1);
  const n = { 
    ...spellSlots, 
    [level]: { 
      ...slots, 
      max: newMax, 
      current: Math.min(slots.current, newMax) // Cap current so it never exceeds new max
    } 
  }; 
  setSpellSlots(n); 
  updateCharacter(characterId, { spellSlots: n }); 
}}><Minus className="h-2 w-2" /></Button>
                  <span className="text-xs font-black w-4 text-center">{slots.max}</span>
                  <Button size="icon" variant="outline" className="h-5 w-5" onClick={() => { 
  const n = { 
    ...spellSlots, 
    [level]: { 
      ...slots, 
      max: slots.max + 1, 
      current: slots.current + 1 // New slot is checked (available) by default
    } 
  }; 
  setSpellSlots(n); 
  updateCharacter(characterId, { spellSlots: n }); 
}}><Plus className="h-2 w-2" /></Button>
                </div>
              </div>
            )}
            {(showEditButtons || isEditing) && <EditSaveButton editing={isEditing} onEdit={() => setEditingLevel(level)} onSave={() => { updateCharacter(characterId, { spells, spellSlots }); setEditingLevel(null); }} />}
          </div>
          {level > 0 && slots.max > 0 && (
            <div className="flex items-center justify-center gap-2 mt-1">
              {/* Spend Button (Left) */}
              <Button 
                size="icon" 
                variant="outline" 
                className="h-6 w-6" 
                onClick={() => {
                  const n = { 
                    ...spellSlots, 
                    [level]: { ...slots, current: Math.max(0, slots.current - 1) } 
                  };
                  setSpellSlots(n);
                  updateCharacter(characterId, { spellSlots: n });
                }}
                disabled={slots.current <= 0}
                title="Spend a slot"
              >
                <Minus className="h-3 w-3" />
              </Button>

              {/* Checkboxes (Disabled but fully visible as state indicators) */}
              <div className="flex flex-wrap gap-1">
                {Array.from({ length: slots.max }).map((_, i) => (
                  <Checkbox 
                    key={i} 
                    checked={i < slots.current} 
                    disabled 
                    className="h-3 w-3 disabled:opacity-100" 
                  />
                ))}
              </div>

              {/* Recover Button (Right) */}
              <Button 
                size="icon" 
                variant="outline" 
                className="h-6 w-6" 
                onClick={() => {
                  const n = { 
                    ...spellSlots, 
                    [level]: { ...slots, current: Math.min(slots.max, slots.current + 1) } 
                  };
                  setSpellSlots(n);
                  updateCharacter(characterId, { spellSlots: n });
                }}
                disabled={slots.current >= slots.max}
                title="Recover a slot"
              >
                <Plus className="h-3 w-3" />
              </Button>
            </div>
          )}
        </CardHeader>
        <CardContent className="p-3 flex-1 space-y-4">
          <ul className="space-y-1">
            {levelSpells.map(spell => (
              <li key={spell.id} className="group relative flex items-center gap-1">
                {!hideNotes && ( <Popover><PopoverTrigger asChild><Button variant={spell.notes ? 'secondary' : 'ghost'} size="icon" className="h-5 w-5 shrink-0"><Info className="h-3 w-3" /></Button></PopoverTrigger><PopoverContent className="w-64"><Label className="text-xs mb-2 block">Notes for {spell.name}</Label><Textarea defaultValue={spell.notes || ''} onBlur={(e) => setSpells(spells.map(s => s.id === spell.id ? {...s, notes: e.target.value} : s))} placeholder="Add notes..." className="mt-2 min-h-[100px] text-sm" /></PopoverContent></Popover> )}
                {isEditing ? ( <div className="flex gap-1 items-start bg-muted/30 p-1 rounded flex-1"><Input value={spell.name} onChange={e => setSpells(spells.map(s => s.id === spell.id ? {...s, name: e.target.value} : s))} className="h-7 text-xs flex-1" /><Button variant="ghost" size="icon" className="h-7 w-7 text-destructive" onClick={() => setSpells(spells.filter(s => s.id !== spell.id))}><Trash2 className="h-3 w-3" /></Button></div> ) : ( <div className="text-xs font-medium py-1 border-b border-muted/50 last:border-0 hover:bg-muted/20 transition-colors cursor-default flex-1">&bull; {spell.name}</div> )}
              </li>
            ))}
          </ul>
          {isEditing && ( <div className="pt-2 border-t space-y-2"><Input placeholder="Spell Name" value={newSpellName} onChange={e => setNewSpellName(e.target.value)} className="h-7 text-xs" /><Button size="sm" className="w-full h-7 text-[10px]" onClick={() => { if (newSpellName.trim()) { setSpells([...spells, { id: `spell-${Date.now()}`, name: newSpellName, level, notes: '' }]); setNewSpellName(''); } }}><Plus className="mr-1 h-3 w-3" /> {t('add')}</Button></div> )}
        </CardContent>
      </Card>
    );
  };



  return (  
    <div className={cn("space-y-6", isCompactView && activeCompactSection !== 'spells-section' && "hidden")}>
        <Card className="mb-6">
          <CardHeader className="flex flex-row items-center justify-between px-4 pt-2 pb-2">
            <CardTitle className="text-[10px] font-bold uppercase text-muted-foreground tracking-tight">{t('spellcastingStats')}</CardTitle>
            {(showEditButtons || isSpellcastingEditing) && <EditSaveButton editing={isSpellcastingEditing} onEdit={() => setIsSpellcastingEditing(true)} onSave={handleSaveSpellcasting} />}
          </CardHeader>
          <CardContent className="p-4 pt-0">
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
              <div className="flex flex-col gap-1">
                <Label className="text-[10px] text-muted-foreground uppercase font-bold">{t('spellcastingAbility')}</Label>
                {isSpellcastingEditing ? (
                  <Select value={spellcastingData.spellcastingAbility} onValueChange={v => setSpellcastingData({ ...spellcastingData, spellcastingAbility: v })}>
                    <SelectTrigger className="h-8 text-xs"><SelectValue /></SelectTrigger>
                    <SelectContent>
                      <SelectItem value="none">{t('none')}</SelectItem>
                      <SelectItem value="strength">{t('strength')}</SelectItem>
                      <SelectItem value="dexterity">{t('dexterity')}</SelectItem>
                      <SelectItem value="constitution">{t('constitution')}</SelectItem>
                      <SelectItem value="intelligence">{t('intelligence')}</SelectItem>
                      <SelectItem value="wisdom">{t('wisdom')}</SelectItem>
                      <SelectItem value="charisma">{t('charisma')}</SelectItem>
                    </SelectContent>
                  </Select>
                ) : (
                  <span className="text-sm font-bold capitalize">{spellcastingData.spellcastingAbility === 'none' ? '-' : spellcastingData.spellcastingAbility}</span>
                )}
              </div>
              <div className="flex flex-col gap-1">
                <Label className="text-[10px] text-muted-foreground uppercase font-bold">{t('spellAttackBonus')}</Label>
                {isSpellcastingEditing ? (
                  <Input value={spellcastingData.spellAttackBonus} onChange={e => setSpellcastingData({ ...spellcastingData, spellAttackBonus: e.target.value })} className="h-8 text-xs" placeholder="+5" />
                ) : (
                  <span className="text-sm font-bold">{spellcastingData.spellAttackBonus || '-'}</span>
                )}
              </div>
              <div className="flex flex-col gap-1">
                <Label className="text-[10px] text-muted-foreground uppercase font-bold">{t('spellSaveDC')}</Label>
                {isSpellcastingEditing ? (
                  <Input type="number" value={spellcastingData.spellSaveDifficulty} onChange={e => setSpellcastingData({ ...spellcastingData, spellSaveDifficulty: parseInt(e.target.value) || 0 })} className="h-8 text-xs" min={0} />
                ) : (
                  <span className="text-sm font-bold">{spellcastingData.spellSaveDifficulty || '-'}</span>
                )}
              </div>
            </div>
          </CardContent>
        </Card>
      <h2 className="text-2xl font-headline font-bold text-center mb-4">{t('spellList')}</h2>
      <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-5 gap-4">
        {renderSpellBox(0, t('cantrips'))}
        {[1, 2, 3, 4, 5, 6, 7, 8, 9].map(lvl => renderSpellBox(lvl, `${t('level')} ${lvl}`))}
      </div>
    </div>
  );
}