'use client';

import * as React from 'react';
import { type DnDMulticlass } from '@/lib/types';
import { Card, CardContent, CardHeader } from '../../ui/card';
import { Input } from '../../ui/input';
import { Button } from '../../ui/button';
import { Checkbox } from '../../ui/checkbox';
import { Plus, Trash2, Edit, Save } from 'lucide-react';
import { Label } from '@/components/ui/label';
import {
  Accordion,
  AccordionContent,
  AccordionItem,
  AccordionTrigger,
} from '@/components/ui/accordion';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { useCharacterContext } from '@/context/character-context';
import { useTranslation } from '@/context/language-context';

const DND_CLASSES = [
  "Artificer", "Barbarian", "Bard", "Cleric", "Druid", "Fighter", "Monk",
  "Paladin", "Ranger", "Rogue", "Sorcerer", "Warlock", "Wizard"
] as const;

const calculateLevelFromExp = (exp: number): number => {
  if (exp >= 355000) return 20; if (exp >= 305000) return 19; if (exp >= 265000) return 18;
  if (exp >= 225000) return 17; if (exp >= 195000) return 16; if (exp >= 165000) return 15;
  if (exp >= 140000) return 14; if (exp >= 120000) return 13; if (exp >= 100000) return 12;
  if (exp >= 85000) return 11; if (exp >= 64000) return 10; if (exp >= 48000) return 9;
  if (exp >= 34000) return 8; if (exp >= 23000) return 7; if (exp >= 14000) return 6;
  if (exp >= 6500) return 5; if (exp >= 2700) return 4; if (exp >= 900) return 3;
  if (exp >= 300) return 2; return 1;
};

const EditSaveButton = ({ editing, onEdit, onSave }: { editing: boolean; onEdit: () => void; onSave: () => void }) => (
  editing ? ( <Button size="icon" variant="ghost" onClick={onSave} className="h-7 w-7"><Save className="h-4 w-4" /></Button> ) : ( <Button size="icon" variant="outline" onClick={onEdit} className="h-7 w-7"><Edit className="h-4 w-4" /></Button> )
);

export interface ProgressionData {
  characterClass: string;
  level: number;
  experiencePoints: number;
  isMulticlass: boolean;
  multiclasses: DnDMulticlass[];
}

interface ProgressionSectionProps {
  progressionData: ProgressionData;
  setProgressionData: React.Dispatch<React.SetStateAction<ProgressionData>>;
  expToCount: number;
  setExpToCount: React.Dispatch<React.SetStateAction<number>>;
  isProgressionEditing: boolean;
  setIsProgressionEditing: React.Dispatch<React.SetStateAction<boolean>>;
  handleSaveProgression: () => void;
}

export function DndProgressionSection({ progressionData, setProgressionData, expToCount, setExpToCount, isProgressionEditing, setIsProgressionEditing, handleSaveProgression }: ProgressionSectionProps) {
  const { showEditButtons } = useCharacterContext();
  const { t } = useTranslation();

  // Validate and fix multiclass levels on load (Prevents infinite loops)
  React.useEffect(() => {
    if (progressionData.multiclasses && progressionData.multiclasses.length > 0) {
      const totalMcLevel = progressionData.multiclasses.reduce((sum, m) => sum + m.level, 0);
      const maxTotalMcAllowed = Math.max(0, progressionData.level - 1);
      
      // If multiclass sum exceeds allowed, or total level is over 20, fix it
      if (totalMcLevel > maxTotalMcAllowed || progressionData.level > 20) {
        let sum = 0;
        const fixed = progressionData.multiclasses.map(m => {
            const remaining = Math.max(0, maxTotalMcAllowed - sum);
            const lvl = remaining > 0 ? Math.min(m.level, remaining) : 0;
            sum += lvl;
            return { ...m, level: lvl };
        }).filter(m => m.level >= 1); // Drop any class that got clamped to 0

        // ONLY update if the array actually changed, preventing infinite loops
        const isDifferent = fixed.length !== progressionData.multiclasses.length || 
                            fixed.some((m, i) => m.level !== progressionData.multiclasses[i].level);
                            
        if (isDifferent) {
            setProgressionData(prev => ({ ...prev, multiclasses: fixed }));
        }
      }
    }
  }, [progressionData.level, progressionData.multiclasses, setProgressionData]);

  return (
    <Accordion type="single" collapsible defaultValue="expanded" className="w-full md:max-w-xl">
      <AccordionItem value="expanded" className="border-0">
        <Card className="flex flex-col border-2 overflow-hidden shrink-0 h-full">
          <CardHeader className="px-4 pt-2 pb-2 flex flex-row items-center justify-between bg-muted/5">
            <AccordionTrigger className="flex flex-1 items-center justify-between hover:no-underline py-0"><Label className="text-[10px] font-bold uppercase text-muted-foreground tracking-tight">{t('progression')}</Label></AccordionTrigger>
            {(showEditButtons || isProgressionEditing) && <EditSaveButton editing={isProgressionEditing} onEdit={() => setIsProgressionEditing(true)} onSave={handleSaveProgression} />}
          </CardHeader>
          <AccordionContent>
            <CardContent className="p-4 space-y-4">
               <div className="grid grid-cols-3 gap-4">
                <div className="flex flex-col gap-1">
                  <Label className="text-[10px] text-muted-foreground uppercase font-bold">{t('class')}</Label>
                  {isProgressionEditing ? (
                    <Select value={progressionData.characterClass} onValueChange={v => setProgressionData({ ...progressionData, characterClass: v })}>
                      <SelectTrigger className="h-8 text-xs"><SelectValue /></SelectTrigger>
                      <SelectContent>{DND_CLASSES.map(c => (<SelectItem key={c} value={c} disabled={progressionData.multiclasses.some(m => m.class === c)}>{c}</SelectItem>))}</SelectContent>
                    </Select>
                  ) : (<span className="text-base font-bold truncate">{progressionData.characterClass}</span>)}
                </div>
                <div className="flex flex-col gap-1">
                  <Label className="text-[10px] text-muted-foreground uppercase font-bold">Class Lvl</Label>
                  <span className="text-base font-bold truncate">
                    {progressionData.isMulticlass 
                      ? Math.max(1, progressionData.level - (progressionData.multiclasses?.reduce((sum, mc) => sum + mc.level, 0) || 0)) 
                      : progressionData.level}
                  </span>
                </div>
                <div className="flex flex-col gap-1">
                  <Label className="text-[10px] text-muted-foreground uppercase font-bold">Total Lvl</Label>
                  <span className="text-base font-bold truncate">{progressionData.level}</span>
                </div>
              </div>
              <div className="pt-2 border-t space-y-4">
                <div className="flex items-center justify-between">
                  <Label className="text-[10px] font-bold uppercase">Multiclass</Label>
                  {isProgressionEditing && <Checkbox checked={progressionData.isMulticlass} onCheckedChange={v => setProgressionData({ ...progressionData, isMulticlass: !!v })} />}
                </div>
                {progressionData.isMulticlass && (
                  <div className="space-y-2">
                    {progressionData.multiclasses.map((mc, idx) => (
                      <div key={idx} className="flex gap-2 items-center">
                        {isProgressionEditing ? (
                          <>
                            <Select value={mc.class} onValueChange={v => { const n = [...progressionData.multiclasses]; n[idx].class = v; setProgressionData({ ...progressionData, multiclasses: n }); }}>
                              <SelectTrigger className="h-8 text-xs flex-1"><SelectValue /></SelectTrigger>
                              <SelectContent>{DND_CLASSES.map(c => (<SelectItem key={c} value={c} disabled={progressionData.characterClass === c || progressionData.multiclasses.some((m, i) => m.class === c && i !== idx)}>{c}</SelectItem>))}</SelectContent>
                            </Select>
                            <Input 
                              type="number" 
                              value={mc.level} 
                              onChange={e => { 
                                const rawVal = parseInt(e.target.value) || 1;
                                const n = [...progressionData.multiclasses]; 
                                
                                // 1. Sum of all OTHER multiclass levels
                                const otherMcSum = progressionData.multiclasses.reduce((sum, m, i) => i === idx ? sum : sum + m.level, 0);
                                
                                // 2. Main Class MUST be at least level 1. 
                                // Therefore, multiclass sum <= Total Level - 1.
                                const maxTotalMcAllowed = Math.max(0, progressionData.level - 1);
                                
                                // 3. This specific multiclass can be at most whatever is left of that allowance
                                const maxAllowed = Math.max(1, maxTotalMcAllowed - otherMcSum);
                                
                                // 4. Clamp the new level between 1 and maxAllowed
                                const newMcLevel = Math.max(1, Math.min(maxAllowed, rawVal));
                                n[idx].level = newMcLevel;
                                
                                setProgressionData({ ...progressionData, multiclasses: n }); 
                              }} 
                              className="h-8 w-16 text-center" 
                            />
                            <Button variant="ghost" size="icon" className="h-8 w-8 text-destructive" onClick={() => setProgressionData({ ...progressionData, multiclasses: progressionData.multiclasses.filter((_, i) => i !== idx) })}><Trash2 className="h-4 w-4" /></Button>
                          </>
                        ) : (<span className="text-xs font-semibold">{mc.class} (Lvl {mc.level})</span>)}
                      </div>
                    ))}
                    {isProgressionEditing && (
                      <Button 
                        variant="outline" 
                        size="sm" 
                        className="w-full h-7 text-[10px]" 
                        disabled={progressionData.level >= 20 || progressionData.multiclasses.length >= 12}
                        onClick={() => { 
                          const used = [progressionData.characterClass, ...progressionData.multiclasses.map(m => m.class)]; 
                          const avail = DND_CLASSES.filter(c => !used.includes(c)); 
                          if (avail.length > 0 && progressionData.level < 20) {
                            setProgressionData({ ...progressionData, multiclasses: [...progressionData.multiclasses, { class: avail[0], level: 1 }] }); 
                          }
                        }}
                      >
                        <Plus className="h-3 w-3 mr-1" /> Add Class
                      </Button>
                    )}
                  </div>
                )}
              </div>
              <div className="pt-2 border-t space-y-4">
                <div className="flex flex-col gap-1">
                  <Label className="text-[10px] text-muted-foreground uppercase font-bold">{t('experiencePoints')}</Label>
                  {isProgressionEditing ? (
                    <Input 
                      value={progressionData.experiencePoints} 
                      onChange={v => { 
                        const n = parseInt(v.target.value) || 0; 
                        const calculatedLevel = Math.min(20, calculateLevelFromExp(n));
                        setProgressionData({ ...progressionData, experiencePoints: n, level: calculatedLevel }); 
                      }} 
                      className="h-7 text-xs p-1" 
                    />
                  ) : (
                    <span className="text-sm font-semibold truncate">{progressionData.experiencePoints || '-'}</span>
                  )}
                </div>
                <div className="flex flex-col gap-2">
                  <Label className="text-[10px] text-muted-foreground uppercase font-bold">{t('expToCount')}</Label>
                  <div className="flex gap-2">
                    <Input type="number" value={expToCount} onChange={e => setExpToCount(parseInt(e.target.value) || 0)} className="h-8 text-xs" />
                    <Button size="sm" onClick={() => { const next = (progressionData.experiencePoints || 0) + expToCount; setProgressionData({ ...progressionData, experiencePoints: next, level: calculateLevelFromExp(next) }); setExpToCount(0); }} className="h-8 px-3 text-xs">{t('add')}</Button>
                  </div>
                </div>
              </div>
            </CardContent>
          </AccordionContent>
        </Card>
      </AccordionItem>
    </Accordion>
  );
}