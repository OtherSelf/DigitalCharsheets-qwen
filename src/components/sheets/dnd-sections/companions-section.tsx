'use client';

import * as React from 'react';
import { type DnDCompanion } from '@/lib/types';
import { Card, CardContent, CardHeader, CardTitle } from '../../ui/card';
import { Input } from '../../ui/input';
import { Button } from '../../ui/button';
import { Plus, Trash2 } from 'lucide-react';
import { Label } from '@/components/ui/label';
import { Checkbox } from '../../ui/checkbox';
import { cn } from '@/lib/utils';
import {
  Accordion,
  AccordionContent,
  AccordionItem,
  AccordionTrigger,
} from '@/components/ui/accordion';
import { useCharacterContext } from '@/context/character-context';
import { useTranslation } from '@/context/language-context';

const DetailField = ({ label, value, editing, onChange }: { label: string, value: string | number, editing: boolean, onChange: (val: string) => void }) => (
  <div className="flex flex-col gap-1">
    <Label className="text-[10px] text-muted-foreground uppercase font-bold">{label}</Label>
    {editing ? (
      <Input value={value} onChange={(e) => onChange(e.target.value)} className="h-7 text-xs p-1" />
    ) : (
      <span className="text-sm font-semibold truncate">{value || '-'}</span>
    )}
  </div>
);

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

  const handleAddCompanion = () => {
    const n = [...companions, {
      id: `comp-${Date.now()}`,
      name: 'New Companion',
      type: '',
      size: '',
      armorClass: 10,
      initiative: 0,
      speed: '30ft',
      proficiencyBonus: '0',
      stats: { strength: 10, dexterity: 10, constitution: 10, intelligence: 10, wisdom: 10, charisma: 10 },
      skills: [],
      hitPoints: { current: 10, max: 10 },
      actions: [],
      features: []
    }];
    setCompanions(n);
    updateCharacter(characterId, { companions: n });
  };

  return (
    <div className={cn("space-y-6", isCompactView && activeCompactSection !== 'companion-section' && "hidden")}>
      <div className="flex justify-between items-center mb-4">
        <h2 className="text-2xl font-headline font-bold">{t('companions')}</h2>
        {showEditButtons && <Button size="sm" variant="outline" onClick={handleAddCompanion}><Plus className="h-4 w-4 mr-2" /> Add</Button>}
      </div>
      {companions.map(comp => (
        <Card key={comp.id} className="p-4 border-2">
          <CardHeader className="flex flex-row items-center justify-between p-0 mb-4">
            {showEditButtons ? (
              <Input value={comp.name} onChange={e => { const n = companions.map(c => c.id === comp.id ? { ...c, name: e.target.value } : c); setCompanions(n); updateCharacter(characterId, { companions: n }); }} className="h-8 text-lg font-bold w-full mr-2" />
            ) : (
              <CardTitle className="text-lg font-bold">{comp.name}</CardTitle>
            )}
            <Button variant="ghost" size="icon" className="text-destructive" onClick={() => { const n = companions.filter(c => c.id !== comp.id); setCompanions(n); updateCharacter(characterId, { companions: n }); }}><Trash2 className="h-4 w-4" /></Button>
          </CardHeader>
          <CardContent className="p-0 space-y-4">

            {/* Basic Info Row 1 */}
            <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
              <DetailField label="Type" value={comp.type} editing={showEditButtons} onChange={v => { const n = companions.map(c => c.id === comp.id ? { ...c, type: v } : c); setCompanions(n); updateCharacter(characterId, { companions: n }); }} />
              <DetailField label="Size" value={comp.size} editing={showEditButtons} onChange={v => { const n = companions.map(c => c.id === comp.id ? { ...c, size: v } : c); setCompanions(n); updateCharacter(characterId, { companions: n }); }} />
              <DetailField label="Armor Class" value={comp.armorClass} editing={showEditButtons} onChange={v => { const n = companions.map(c => c.id === comp.id ? { ...c, armorClass: parseInt(v) || 10 } : c); setCompanions(n); updateCharacter(characterId, { companions: n }); }} />
              <DetailField label="Speed" value={comp.speed} editing={showEditButtons} onChange={v => { const n = companions.map(c => c.id === comp.id ? { ...c, speed: v } : c); setCompanions(n); updateCharacter(characterId, { companions: n }); }} />
            </div>

            {/* Basic Info Row 2 + HP */}
            <div className="grid grid-cols-2 md:grid-cols-4 gap-4 items-center">
              <DetailField label="Initiative" value={comp.initiative} editing={showEditButtons} onChange={v => { const n = companions.map(c => c.id === comp.id ? { ...c, initiative: parseInt(v) || 0 } : c); setCompanions(n); updateCharacter(characterId, { companions: n }); }} />
              <DetailField label="Prof Bonus" value={comp.proficiencyBonus} editing={showEditButtons} onChange={v => { const n = companions.map(c => c.id === comp.id ? { ...c, proficiencyBonus: v } : c); setCompanions(n); updateCharacter(characterId, { companions: n }); }} />
              <div className="col-span-2 p-2 border rounded bg-muted/5 text-center">
                <Label className="text-[10px] uppercase font-bold">HP</Label>
                <div className="flex justify-center items-center gap-2">
                  {showEditButtons ? (
                    <>
                      <Input type="number" value={comp.hitPoints.current} onChange={e => { const n = companions.map(c => c.id === comp.id ? { ...c, hitPoints: {...c.hitPoints, current: parseInt(e.target.value) || 0} } : c); setCompanions(n); updateCharacter(characterId, { companions: n }); }} className="h-7 w-12 text-center" />
                      <span>/</span>
                      <Input type="number" value={comp.hitPoints.max} onChange={e => { const n = companions.map(c => c.id === comp.id ? { ...c, hitPoints: {...c.hitPoints, max: parseInt(e.target.value) || 0} } : c); setCompanions(n); updateCharacter(characterId, { companions: n }); }} className="h-7 w-12 text-center" />
                    </>
                  ) : (<span className="text-lg font-bold">{comp.hitPoints.current} / {comp.hitPoints.max}</span>)}
                </div>
              </div>
            </div>

            {/* Ability Scores */}
            <div className="pt-2 border-t">
              <Label className="text-[10px] uppercase font-bold mb-2 block">Ability Scores</Label>
              <div className="grid grid-cols-3 md:grid-cols-6 gap-2">
                {(['strength', 'dexterity', 'constitution', 'intelligence', 'wisdom', 'charisma'] as const).map(stat => {
                  const val = comp.stats[stat];
                  const mod = Math.floor((val - 10) / 2);
                  const displayMod = mod >= 0 ? `+${mod}` : mod.toString();
                  return (
                    <div key={stat} className="flex flex-col items-center justify-center rounded-lg bg-background text-center border p-2">
                      <span className="text-[9px] font-bold text-muted-foreground uppercase">{stat.slice(0,3)}</span>
                      {showEditButtons ? (
                        <Input type="number" value={val} onChange={e => {
                          const newVal = parseInt(e.target.value) || 0;
                          const n = companions.map(c => c.id === comp.id ? { ...c, stats: { ...c.stats, [stat]: newVal } } : c);
                          setCompanions(n); updateCharacter(characterId, { companions: n });
                        }} className="h-7 w-12 text-center text-sm font-bold" />
                      ) : (
                        <span className="text-sm font-bold text-muted-foreground">{val}</span>
                      )}
                      <div className="text-[8px] text-muted-foreground uppercase font-bold mt-1">Mod</div>
                      <div className="text-sm font-bold">{displayMod}</div>
                    </div>
                  );
                })}
              </div>
            </div>

            {/* Skills, Actions, Features */}
            <Accordion type="multiple" className="w-full pt-2 border-t">
              <AccordionItem value="skills" className="border-b-0">
                <AccordionTrigger className="text-sm font-semibold hover:no-underline py-2">{t('skills')} ({comp.skills.length})</AccordionTrigger>
                <AccordionContent>
                  <div className="space-y-1">
                    {comp.skills.length > 0 ? comp.skills.map((sk, i) => (
                      <div key={i} className="flex items-center gap-2 text-xs">
                        <Checkbox checked={sk.proficient} disabled={!showEditButtons} onCheckedChange={v => {
                          const n = companions.map(c => c.id === comp.id ? { ...c, skills: c.skills.map((s, idx) => idx === i ? { ...s, proficient: !!v } : s) } : c);
                          setCompanions(n); updateCharacter(characterId, { companions: n });
                        }} className="h-3 w-3" />
                        <span className="font-black w-6 text-center">{sk.value >= 0 ? '+' : ''}{sk.value}</span>
                        <span className="flex-1">{sk.label}</span>
                      </div>
                    )) : <p className="text-xs text-muted-foreground italic">No skills.</p>}
                  </div>
                </AccordionContent>
              </AccordionItem>
              <AccordionItem value="actions" className="border-b-0">
                <AccordionTrigger className="text-sm font-semibold hover:no-underline py-2">Actions ({comp.actions.length})</AccordionTrigger>
                <AccordionContent>
                  <div className="space-y-2">
                    {comp.actions.map((act, i) => (
                      <div key={i} className="text-xs p-2 bg-muted/10 rounded border flex justify-between items-center">
                        {showEditButtons ? (
                          <Input value={act.name} onChange={e => {
                            const n = companions.map(c => c.id === comp.id ? { ...c, actions: c.actions.map((a, idx) => idx === i ? { ...a, name: e.target.value } : a) } : c);
                            setCompanions(n); updateCharacter(characterId, { companions: n });
                          }} className="h-6 text-xs flex-1 mr-2" />
                        ) : (
                          <span className="font-semibold flex-1">&bull; {act.name}</span>
                        )}
                        {showEditButtons && <Button variant="ghost" size="icon" className="h-5 w-5 text-destructive" onClick={() => {
                          const n = companions.map(c => c.id === comp.id ? { ...c, actions: c.actions.filter((_, idx) => idx !== i) } : c);
                          setCompanions(n); updateCharacter(characterId, { companions: n });
                        }}><Trash2 className="h-3 w-3" /></Button>}
                      </div>
                    ))}
                    {showEditButtons && <Button size="sm" variant="outline" className="w-full h-7 text-[10px]" onClick={() => {
                      const n = companions.map(c => c.id === comp.id ? { ...c, actions: [...c.actions, { id: `act-${Date.now()}`, name: 'New Action', notes: '' }] } : c);
                      setCompanions(n); updateCharacter(characterId, { companions: n });
                    }}><Plus className="h-3 w-3 mr-1" /> Add Action</Button>}
                  </div>
                </AccordionContent>
              </AccordionItem>
              <AccordionItem value="features" className="border-b-0">
                <AccordionTrigger className="text-sm font-semibold hover:no-underline py-2">Features ({comp.features.length})</AccordionTrigger>
                <AccordionContent>
                  <div className="space-y-2">
                    {comp.features.map((feat, i) => (
                      <div key={i} className="text-xs p-2 bg-muted/10 rounded border flex justify-between items-center">
                        {showEditButtons ? (
                          <Input value={feat.name} onChange={e => {
                            const n = companions.map(c => c.id === comp.id ? { ...c, features: c.features.map((f, idx) => idx === i ? { ...f, name: e.target.value } : f) } : c);
                            setCompanions(n); updateCharacter(characterId, { companions: n });
                          }} className="h-6 text-xs flex-1 mr-2" />
                        ) : (
                          <span className="font-semibold flex-1">&bull; {feat.name}</span>
                        )}
                        {showEditButtons && <Button variant="ghost" size="icon" className="h-5 w-5 text-destructive" onClick={() => {
                          const n = companions.map(c => c.id === comp.id ? { ...c, features: c.features.filter((_, idx) => idx !== i) } : c);
                          setCompanions(n); updateCharacter(characterId, { companions: n });
                        }}><Trash2 className="h-3 w-3" /></Button>}
                      </div>
                    ))}
                    {showEditButtons && <Button size="sm" variant="outline" className="w-full h-7 text-[10px]" onClick={() => {
                      const n = companions.map(c => c.id === comp.id ? { ...c, features: [...c.features, { id: `feat-${Date.now()}`, name: 'New Feature', notes: '' }] } : c);
                      setCompanions(n); updateCharacter(characterId, { companions: n });
                    }}><Plus className="h-3 w-3 mr-1" /> Add Feature</Button>}
                  </div>
                </AccordionContent>
              </AccordionItem>
            </Accordion>
          </CardContent>
        </Card>
      ))}
    </div>
  );
}