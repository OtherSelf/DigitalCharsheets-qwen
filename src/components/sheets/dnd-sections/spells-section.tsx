'use client';

import * as React from 'react';
import { type Spell, type SpellcastingEntry } from '@/lib/types';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { Button } from '@/components/ui/button';
import { Checkbox } from '@/components/ui/checkbox';
import { Plus, Trash2, Minus, Info, Edit, Save } from 'lucide-react';
import { Label } from '@/components/ui/label';
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { cn } from '@/lib/utils';
import { useCharacterContext } from '@/context/character-context';
import { useTranslation } from '@/context/language-context';

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
  initialSpellcastingEntries?: SpellcastingEntry[];
  stats?: Record<string, number>;
  proficiencyBonus?: number;
}

export function DndSpellsSection({ 
  characterId, 
  initialSpells, 
  initialSpellSlots, 
  isCompactView, 
  activeCompactSection, 
  initialSpellcastingEntries,
  stats,
  proficiencyBonus
}: SpellsSectionProps) {
  const { updateCharacter, showEditButtons, hideNotes } = useCharacterContext();
  const { t } = useTranslation();

  const [spells, setSpells] = React.useState<Spell[]>(initialSpells);
  const [spellSlots, setSpellSlots] = React.useState<Record<number, { max: number; current: number }>>(initialSpellSlots || DEFAULT_SLOTS);
  const [editingLevel, setEditingLevel] = React.useState<number | null>(null);
  const [newSpellName, setNewSpellName] = React.useState('');
  
  const [spellcastingEntries, setSpellcastingEntries] = React.useState<SpellcastingEntry[]>(initialSpellcastingEntries || []);
  const [isSpellcastingEditing, setIsSpellcastingEditing] = React.useState(false);

  React.useEffect(() => {
    setSpells(initialSpells);
    setSpellSlots(initialSpellSlots || DEFAULT_SLOTS);
    setSpellcastingEntries(initialSpellcastingEntries || []);
  }, [characterId, initialSpells, initialSpellSlots, initialSpellcastingEntries]); 

  const getSpellcastingMod = (ability: string) => {
    if (ability === 'none' || !ability || !stats) return 0;
    const statValue = stats[ability] || 10;
    return Math.floor((statValue - 10) / 2);
  };

  const calculateSpellAttack = (ability: string) => {
    const mod = getSpellcastingMod(ability);
    const total = mod + (proficiencyBonus || 0);
    return total >= 0 ? `+${total}` : `${total}`;
  };

  const calculateSpellSaveDC = (ability: string) => {
    return 8 + (proficiencyBonus || 0) + getSpellcastingMod(ability);
  };

  const handleSpellcastingFieldChange = (id: string, field: keyof SpellcastingEntry, value: string | number) => {
    setSpellcastingEntries(prev => {
      const updated = prev.map(entry => {
        if (entry.id !== id) return entry;
        const newEntry = { ...entry, [field]: value };
        if (field === 'ability' && typeof value === 'string') {
          newEntry.attackBonus = calculateSpellAttack(value);
          newEntry.saveDC = calculateSpellSaveDC(value);
        }
        return newEntry;
      });
      // Write through immediately to keep Combat section in sync
      updateCharacter(characterId, { spellcastingEntries: updated });
      return updated;
    });
  };

  const addSpellcastingEntry = () => {
    const newEntry: SpellcastingEntry = { id: `spellcast-${Date.now()}`, ability: 'none', attackBonus: '+0', saveDC: 10 };
    const updated = [...spellcastingEntries, newEntry];
    setSpellcastingEntries(updated);
    updateCharacter(characterId, { spellcastingEntries: updated });
  };

  const removeSpellcastingEntry = (id: string) => {
    const updated = spellcastingEntries.filter(e => e.id !== id);
    setSpellcastingEntries(updated);
    updateCharacter(characterId, { spellcastingEntries: updated });
  };

  const handleSaveSpellcasting = React.useCallback(() => {
    // Data is already persisted via write-through, just exit edit mode
    setIsSpellcastingEditing(false);
  }, []);

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
                    const n = { ...spellSlots, [level]: { ...slots, max: newMax, current: Math.min(slots.current, newMax) } }; 
                    setSpellSlots(n); 
                    updateCharacter(characterId, { spellSlots: n }); 
                  }}><Minus className="h-2 w-2" /></Button>
                  <span className="text-xs font-black w-4 text-center">{slots.max}</span>
                  <Button size="icon" variant="outline" className="h-5 w-5" onClick={() => { 
                    const n = { ...spellSlots, [level]: { ...slots, max: slots.max + 1, current: slots.current + 1 } }; 
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
              <Button size="icon" variant="outline" className="h-6 w-6" onClick={() => {
                const n = { ...spellSlots, [level]: { ...slots, current: Math.max(0, slots.current - 1) } };
                setSpellSlots(n);
                updateCharacter(characterId, { spellSlots: n });
              }} disabled={slots.current <= 0} title="Spend a slot">
                <Minus className="h-3 w-3" />
              </Button>
              <div className="flex flex-wrap gap-1">
                {Array.from({ length: slots.max }).map((_, i) => (
                  <Checkbox key={i} checked={i < slots.current} disabled className="h-3 w-3 disabled:opacity-100" />
                ))}
              </div>
              <Button size="icon" variant="outline" className="h-6 w-6" onClick={() => {
                const n = { ...spellSlots, [level]: { ...slots, current: Math.min(slots.max, slots.current + 1) } };
                setSpellSlots(n);
                updateCharacter(characterId, { spellSlots: n });
              }} disabled={slots.current >= slots.max} title="Recover a slot">
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
      
      {/* ONLY IN COMPACT VIEW: Spellcasting Entries Box (Duplicated from Attacks & Spellcasting) */}
      {isCompactView && (
        <Card className="mb-6">
          <CardHeader className="flex flex-row items-center justify-between px-4 pt-2 pb-2">
            <CardTitle className="text-[10px] font-bold uppercase text-muted-foreground tracking-tight">{t('spellcastingStats')}</CardTitle>
            {(showEditButtons || isSpellcastingEditing) && <EditSaveButton editing={isSpellcastingEditing} onEdit={() => setIsSpellcastingEditing(true)} onSave={handleSaveSpellcasting} />}
          </CardHeader>
          <CardContent className="p-4 pt-0 space-y-2">
            {spellcastingEntries.map((entry) => (
              <div key={entry.id} className="grid grid-cols-12 gap-2 items-center p-2 bg-muted/10 rounded border border-muted/20">
                <div className="col-span-6 w-full">
                  <div className="flex items-center gap-1 mb-1">
                    {!hideNotes && (
                      <Popover>
                        <PopoverTrigger asChild>
                          <Button
                            variant={entry.notes ? 'secondary' : 'ghost'}
                            size="icon"
                            className="h-5 w-5 shrink-0"
                            title="Notes"
                          >
                            <Info className="h-3 w-3" />
                          </Button>
                        </PopoverTrigger>
                        <PopoverContent className="w-64">
                          <Label className="text-xs mb-2 block">
                            Notes for {entry.ability === 'none' ? 'Spellcasting' : entry.ability.charAt(0).toUpperCase() + entry.ability.slice(1)}
                          </Label>
                          <Textarea
                            defaultValue={entry.notes || ''}
                            onBlur={(e) => {
                              const updated = spellcastingEntries.map(en =>
                                en.id === entry.id ? { ...en, notes: e.target.value } : en
                              );
                              setSpellcastingEntries(updated);
                              updateCharacter(characterId, { spellcastingEntries: updated });
                            }}
                            placeholder="Add notes..."
                            className="mt-2 min-h-[100px] text-sm"
                          />
                        </PopoverContent>
                      </Popover>
                    )}
                    <Label className="text-[9px] text-muted-foreground uppercase">Ability</Label>
                  </div>
                  {isSpellcastingEditing ? (
                    <Select value={entry.ability} onValueChange={(v) => handleSpellcastingFieldChange(entry.id, 'ability', v)}>
                      <SelectTrigger className="h-8 text-xs"><SelectValue /></SelectTrigger>
                      <SelectContent>
                        <SelectItem value="none">None</SelectItem>
                        <SelectItem value="strength">Strength</SelectItem>
                        <SelectItem value="dexterity">Dexterity</SelectItem>
                        <SelectItem value="constitution">Constitution</SelectItem>
                        <SelectItem value="intelligence">Intelligence</SelectItem>
                        <SelectItem value="wisdom">Wisdom</SelectItem>
                        <SelectItem value="charisma">Charisma</SelectItem>
                      </SelectContent>
                    </Select>
                  ) : (
                    <span className="text-xs font-bold">
                      {entry.ability === 'none' ? 'None' : entry.ability.charAt(0).toUpperCase() + entry.ability.slice(1)}
                    </span>
                  )}
                </div>
                <div className="col-span-3 w-full">
                  <Label className="text-[9px] text-muted-foreground uppercase mb-1 block">Atk Bonus</Label>
                  {isSpellcastingEditing ? (
                    <Input value={entry.attackBonus} onChange={e => handleSpellcastingFieldChange(entry.id, 'attackBonus', e.target.value)} className="h-8 text-xs text-center" />
                  ) : (
                    <span className="text-xs font-bold">{entry.attackBonus || '-'}</span>
                  )}
                </div>
                <div className="col-span-2 w-full">
                  <Label className="text-[9px] text-muted-foreground uppercase mb-1 block">Save DC</Label>
                  {isSpellcastingEditing ? (
                    <Input type="number" value={entry.saveDC} onChange={e => handleSpellcastingFieldChange(entry.id, 'saveDC', parseInt(e.target.value) || 0)} className="h-8 text-xs text-center" />
                  ) : (
                    <span className="text-xs font-bold">{entry.saveDC || '-'}</span>
                  )}
                </div>
                <div className="col-span-1 flex justify-end">
                  {isSpellcastingEditing && (
                    <Button variant="ghost" size="icon" className="h-8 w-8 text-destructive shrink-0" onClick={() => removeSpellcastingEntry(entry.id)}>
                      <Trash2 className="h-3 w-3" />
                    </Button>
                  )}
                </div>
              </div>
            ))}
            {isSpellcastingEditing && (
              <Button variant="outline" size="sm" className="w-full h-8 text-[10px] mt-2" onClick={addSpellcastingEntry}>
                <Plus className="mr-1 h-3 w-3" /> Add Spellcasting Entry
              </Button>
            )}
          </CardContent>
        </Card>
      )}

      <h2 className="text-2xl font-headline font-bold text-center mb-4">{t('spellList')}</h2>
      <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-5 gap-4">
        {renderSpellBox(0, t('cantrips'))}
        {[1, 2, 3, 4, 5, 6, 7, 8, 9].map(lvl => renderSpellBox(lvl, `${t('level')} ${lvl}`))}
      </div>
    </div>
  );
}