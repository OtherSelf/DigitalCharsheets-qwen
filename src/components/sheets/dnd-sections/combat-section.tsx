'use client';

import * as React from 'react';
import { type DnDAttack, type CombatResource } from '@/lib/types';
import { Card, CardContent, CardHeader, CardTitle } from '../../ui/card';
import { Input } from '../../ui/input';
import { Textarea } from '../../ui/textarea';
import { Button } from '../../ui/button';
import { Plus, Trash2, Edit, Save, Minus, Info } from 'lucide-react';
import { Label } from '@/components/ui/label';
import { Popover, PopoverContent, PopoverTrigger } from '../../ui/popover';
import { cn } from '@/lib/utils';
import { useCharacterContext } from '@/context/character-context';
import { useTranslation } from '@/context/language-context';
import { Checkbox } from '../../ui/checkbox';


const CLASS_HIT_DICE: Record<string, number> = {
  "Artificer": 8, "Barbarian": 12, "Bard": 8, "Cleric": 8, "Druid": 8,
  "Fighter": 10, "Monk": 8, "Paladin": 10, "Ranger": 10, "Rogue": 8,
  "Sorcerer": 6, "Warlock": 8, "Wizard": 6,
};

const EXHAUSTION_EFFECTS = [
  'No exhaustion',
  'Disadvantage on Ability Checks',
  'Speed halved',
  'Disadvantage on Attack rolls and Saving Throws',
  'Hit point maximum halved',
  'Speed reduced to 0',
  'Death',
];

const EditSaveButton = ({ editing, onEdit, onSave }: { editing: boolean; onEdit: () => void; onSave: () => void }) => (
  editing ? ( <Button size="icon" variant="ghost" onClick={onSave} className="h-7 w-7"><Save className="h-4 w-4" /></Button> ) : ( <Button size="icon" variant="outline" onClick={onEdit} className="h-7 w-7"><Edit className="h-4 w-4" /></Button> )
);

interface CombatStats {
  armorClass: number;
  speed: number;
  hitPoints: { current: number; max: number };
  temporaryHitPoints: number;
  deathSaves: { successes: number; failures: number };
}

interface CombatSectionProps {
  characterId: string;
  initialCombatStats: CombatStats;
  initialExhaustion: number;
  initialHitDiceUsed: Record<string, number>;
  initialAttacks: DnDAttack[];
  initialCombatResources: CombatResource[];
  dexterity: number;
  progressionData: { characterClass: string; level: number; isMulticlass: boolean; multiclasses: { class: string; level: number }[] };
  isCompactView: boolean;
  activeCompactSection: string;
}

export const DndCombatSection = React.forwardRef<{ saveAll: () => void }, CombatSectionProps>(
  ({ characterId, initialCombatStats, initialExhaustion, initialHitDiceUsed, initialAttacks, initialCombatResources, dexterity, progressionData, isCompactView, activeCompactSection }, ref) => {
    const { updateCharacter, showEditButtons, hideNotes, getCharacter } = useCharacterContext();
    const { t } = useTranslation();

    const [combatStats, setCombatStats] = React.useState<CombatStats>(initialCombatStats);
    const [isCombatStatsEditing, setIsCombatStatsEditing] = React.useState(false);
    const [isHpEditing, setIsHpEditing] = React.useState(false);
    const [hpDelta, setHpDelta] = React.useState<string>('');
    const [exhaustion, setExhaustion] = React.useState(initialExhaustion);
    const [hitDiceUsed, setHitDiceUsed] = React.useState<Record<string, number>>(initialHitDiceUsed);
    const [attacks, setAttacks] = React.useState<DnDAttack[]>(initialAttacks);
    const [isAttacksEditing, setIsAttacksEditing] = React.useState(false);
    const [combatResources, setCombatResources] = React.useState<CombatResource[]>(initialCombatResources);
    const [isResourcesEditing, setIsResourcesEditing] = React.useState(false);
    const [newResourceDesc, setNewResourceDesc] = React.useState('');
    const [newResourceMax, setNewResourceMax] = React.useState(1);
    const currentChar = getCharacter(characterId);
    const [allowInspirationHomeRule, setAllowInspirationHomeRule] = React.useState((currentChar as any)?.allowInspirationHomeRule || false);
    const [hpTracking, setHpTracking] = React.useState((currentChar as any)?.hpTracking || '');


    React.useEffect(() => {
      setCombatStats(initialCombatStats);
      setExhaustion(initialExhaustion);
      setHitDiceUsed(initialHitDiceUsed);
      setAttacks(initialAttacks);
      setCombatResources(initialCombatResources);
      setAllowInspirationHomeRule((getCharacter(characterId) as any)?.allowInspirationHomeRule || false);
      setHpTracking((getCharacter(characterId) as any)?.hpTracking || '');
    }, [characterId, getCharacter]);

    const dexMod = Math.floor((dexterity - 10) / 2);

    const primaryClassLevel = progressionData.isMulticlass
      ? Math.max(1, progressionData.level - (progressionData.multiclasses?.reduce((sum, mc) => sum + mc.level, 0) || 0))
      : progressionData.level;
    const primaryDieSize = CLASS_HIT_DICE[progressionData.characterClass] || 8;

    const hitDiceEntries = React.useMemo(() => {
      const entries: { className: string; level: number; dieSize: number }[] = [];
      entries.push({ className: progressionData.characterClass, level: primaryClassLevel, dieSize: primaryDieSize });
      if (progressionData.isMulticlass && progressionData.multiclasses) {
        for (const mc of progressionData.multiclasses) {
          const dieSize = CLASS_HIT_DICE[mc.class] || 8;
          entries.push({ className: mc.class, level: mc.level, dieSize });
        }
      }
      return entries;
    }, [progressionData, primaryClassLevel, primaryDieSize]);

    const handleSaveCombatStats = React.useCallback(() => { updateCharacter(characterId, { armorClass: combatStats.armorClass, speed: combatStats.speed }); setIsCombatStatsEditing(false); }, [characterId, combatStats.armorClass, combatStats.speed, updateCharacter]);
    const handleSaveHp = React.useCallback(() => { updateCharacter(characterId, { hitPoints: combatStats.hitPoints, temporaryHitPoints: combatStats.temporaryHitPoints }); setIsHpEditing(false); }, [characterId, combatStats.hitPoints, combatStats.temporaryHitPoints, updateCharacter]);
    const handleSaveAttacks = React.useCallback(() => { updateCharacter(characterId, { attacks }); setIsAttacksEditing(false); }, [characterId, attacks, updateCharacter]);
    const handleSaveResources = React.useCallback(() => { updateCharacter(characterId, { combatResources }); setIsResourcesEditing(false); }, [characterId, combatResources, updateCharacter]);
    const handleInspirationRuleChange = (checked: boolean | 'indeterminate') => {
      const isChecked = checked === true;
      setAllowInspirationHomeRule(isChecked);
      updateCharacter(characterId, { allowInspirationHomeRule: isChecked });
    };

    const handleHpTrackingBlur = () => {updateCharacter(characterId, { hpTracking });};

    React.useImperativeHandle(ref, () => ({
      saveAll: () => {
        if (isCombatStatsEditing) handleSaveCombatStats();
        if (isHpEditing) handleSaveHp();
        if (isAttacksEditing) handleSaveAttacks();
        if (isResourcesEditing) handleSaveResources();
      }
    }), [isCombatStatsEditing, isHpEditing, isAttacksEditing, isResourcesEditing, handleSaveCombatStats, handleSaveHp, handleSaveAttacks, handleSaveResources]);

    const handleHpMath = (op: 'sub' | 'rec') => {
      const d = parseInt(hpDelta) || 0; if (d === 0) return;
      const n = { ...combatStats.hitPoints, current: op === 'sub' ? Math.max(0, combatStats.hitPoints.current - d) : Math.min(combatStats.hitPoints.max, combatStats.hitPoints.current + d) };
      setCombatStats({ ...combatStats, hitPoints: n }); setHpDelta('');
      if (!isHpEditing) updateCharacter(characterId, { hitPoints: n });
    };

    const handleResourceCurrentChange = (id: string, delta: number) => {
      const next = combatResources.map(r => r.id === id ? { ...r, current: Math.max(0, Math.min(r.max, r.current + delta)) } : r);
      setCombatResources(next);
      updateCharacter(characterId, { combatResources: next });
    };

    const handleResourceFieldChange = (id: string, field: keyof CombatResource, value: string | number) => {
      setCombatResources(prev => prev.map(r => {
        if (r.id !== id) return r;
        if (field === 'max') {
          const newMax = Math.max(0, parseInt(String(value), 10) || 0);
          return { ...r, max: newMax, current: Math.min(r.current, newMax) };
        }
        return { ...r, [field]: value };
      }));
    };

    const addResource = () => {
      if (newResourceDesc.trim()) {
        const next = [...combatResources, { id: `res-${Date.now()}`, description: newResourceDesc.trim(), current: newResourceMax, max: newResourceMax, notes: '' }];
        setCombatResources(next);
        setNewResourceDesc('');
        setNewResourceMax(1);
      }
    };

    const removeResource = (id: string) => { setCombatResources(combatResources.filter(r => r.id !== id)); };

    const handleDeathSaveChange = (type: 'successes' | 'failures', value: number) => {
      const clamped = Math.max(0, Math.min(3, value));
      const next = { ...combatStats.deathSaves, [type]: clamped };
      setCombatStats({ ...combatStats, deathSaves: next });
      updateCharacter(characterId, { deathSaves: next });
    };

    const resetDeathSaves = () => {
      const next = { successes: 0, failures: 0 };
      setCombatStats({ ...combatStats, deathSaves: next });
      updateCharacter(characterId, { deathSaves: next });
    };

    const handleExhaustionChange = (delta: number) => {
      const next = Math.max(0, Math.min(6, exhaustion + delta));
      setExhaustion(next);
      updateCharacter(characterId, { exhaustion: next });
    };

    const handleHitDiceUse = (className: string, delta: number) => {
      const entry = hitDiceEntries.find(e => e.className === className);
      if (!entry) return;
      const currentUsed = hitDiceUsed[className] || 0;
      const nextUsed = Math.max(0, Math.min(entry.level, currentUsed + delta));
      const next = { ...hitDiceUsed, [className]: nextUsed };
      setHitDiceUsed(next);
      updateCharacter(characterId, { hitDiceUsed: next });
    };

    const resetAllHitDice = () => {
      const next: Record<string, number> = {};
      hitDiceEntries.forEach(e => { next[e.className] = 0; });
      setHitDiceUsed(next);
      updateCharacter(characterId, { hitDiceUsed: next });
    };

    return (
      <div className={cn("md:col-span-4 space-y-6", isCompactView && activeCompactSection !== 'combat-section' && "hidden")}>
        <Card id="combat-stats-card">
          <CardHeader className="flex flex-row items-center justify-between px-4 pt-2 pb-2"><CardTitle className="text-[10px] font-bold uppercase text-muted-foreground tracking-tight">{t('combatStats')}</CardTitle>{(showEditButtons || isCombatStatsEditing) && <EditSaveButton editing={isCombatStatsEditing} onEdit={() => setIsCombatStatsEditing(true)} onSave={handleSaveCombatStats} />}</CardHeader>
          <CardContent className="grid grid-cols-3 gap-4 p-4 pt-0 text-center">
            <div className="p-2 rounded-lg bg-background border"><Label className="text-[10px] text-muted-foreground uppercase font-bold">{t('armorClass')}</Label>{isCombatStatsEditing ? (<Input type="number" value={combatStats.armorClass} onChange={e => setCombatStats({ ...combatStats, armorClass: parseInt(e.target.value) || 10 })} className="h-9 w-full text-center" />) : (<div className="text-sm font-bold">{combatStats.armorClass}</div>)}</div>
            <div className="p-2 rounded-lg bg-background border"><Label className="text-[10px] text-muted-foreground uppercase font-bold">{t('initiative')}</Label><div className="text-sm font-bold">+{dexMod}</div></div>
            <div className="p-2 rounded-lg bg-background border"><Label className="text-[10px] text-muted-foreground uppercase font-bold">{t('speed')}</Label>{isCombatStatsEditing ? <Input type="number" value={combatStats.speed} onChange={e => setCombatStats({ ...combatStats, speed: parseInt(e.target.value) || 0 })} className="h-9 w-full text-center" /> : <div className="text-sm font-bold">{combatStats.speed}ft</div>}</div>
          </CardContent>
        </Card>

                <Card id="hit-points-card">
          <CardHeader className="flex flex-row items-center justify-between px-4 pt-2 pb-2">
            <CardTitle className="text-[10px] font-bold uppercase text-muted-foreground tracking-tight">Health</CardTitle>
            {(showEditButtons || isHpEditing) && <EditSaveButton editing={isHpEditing} onEdit={() => setIsHpEditing(true)} onSave={handleSaveHp} />}
          </CardHeader>
          <CardContent className="p-4 pt-0 space-y-4">
            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-4">
                <div className="p-2 border rounded text-center">
                  <Label className="text-[10px] uppercase font-bold">Max</Label>
                  {isHpEditing ? (
                    <Input type="number" value={combatStats.hitPoints.max} onChange={e => setCombatStats({ ...combatStats, hitPoints: { ...combatStats.hitPoints, max: parseInt(e.target.value) || 0 } })} className="h-8 text-center" />
                  ) : (
                    <div className="text-base font-bold">{combatStats.hitPoints.max}</div>
                  )}
                </div>
                <div className="p-2 border rounded text-center">
                  <Label className="text-[10px] uppercase font-bold">Current</Label>
                  {isHpEditing ? (
                    <Input type="number" value={combatStats.hitPoints.current} onChange={e => setCombatStats({ ...combatStats, hitPoints: { ...combatStats.hitPoints, current: parseInt(e.target.value) || 0 } })} className="h-8 text-center" />
                  ) : (
                    <div className="text-base font-bold text-primary">{combatStats.hitPoints.current}</div>
                  )}
                </div>
              </div>
              <div className="space-y-4">
                <div className="p-2 border rounded text-center">
                  <Label className="text-[10px] uppercase font-bold">Temp</Label>
                  {isHpEditing ? (
                    <Input type="number" value={combatStats.temporaryHitPoints} onChange={e => setCombatStats({ ...combatStats, temporaryHitPoints: parseInt(e.target.value) || 0 })} className="h-8 text-center" />
                  ) : (
                    <div className="text-base font-bold">{combatStats.temporaryHitPoints || 0}</div>
                  )}
                </div>
                <div className="flex flex-col gap-2">
                  <Input type="number" placeholder="+/-" value={hpDelta} onChange={e => setHpDelta(e.target.value)} className="h-8 text-center" />
                  <div className="grid grid-cols-2 gap-2">
                    <Button size="sm" variant="outline" onClick={() => handleHpMath('sub')}>Sub</Button>
                    <Button size="sm" variant="outline" onClick={() => handleHpMath('rec')}>Heal</Button>
                  </div>
                </div>
              </div>
            </div>

            {/* NEW: HP Tracking moved INSIDE the Health box at the bottom */}
            <div className="pt-2 border-t">
              <Label className="text-[10px] uppercase font-bold text-muted-foreground mb-1 block">HP Tracking</Label>
              <Textarea 
                value={hpTracking} 
                onChange={(e) => setHpTracking(e.target.value)} 
                onBlur={handleHpTrackingBlur}
                placeholder="e.g., -5 dmg from goblin, +10 healed by potion" 
                className="min-h-[80px] text-xs" 
              />
            </div>
          </CardContent>
        </Card>

        {/* NEW: Inspiration Home Rule Checkbox (Standalone Card below Health) */}
        <Card id="inspiration-rule-card">
          <CardContent className="p-4 flex items-center gap-3">
            <Checkbox 
              id="allowInspirationHomeRule" 
              checked={allowInspirationHomeRule} 
              onCheckedChange={handleInspirationRuleChange} 
            />
            <Label htmlFor="allowInspirationHomeRule" className="text-sm font-medium cursor-pointer select-none">
              Allow Inspiration Homerule
            </Label>
          </CardContent>
        </Card>

        <Card id="death-saves-exhaustion-card">
          <CardHeader className="flex flex-row items-center justify-between px-4 pt-2 pb-2">
            <CardTitle className="text-[10px] font-bold uppercase text-muted-foreground tracking-tight">{t('deathSavesAndExhaustion')}</CardTitle>
            <Button variant="ghost" size="sm" className="h-6 text-[10px]" onClick={resetDeathSaves}>Reset</Button>
          </CardHeader>
          <CardContent className="p-4 pt-0 space-y-4">
            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label className="text-[10px] uppercase font-bold text-green-600">{t('successes')}</Label>
                <div className="flex items-center gap-2">
                  <Button size="icon" variant="outline" className="h-6 w-6" onClick={() => handleDeathSaveChange('successes', combatStats.deathSaves.successes - 1)}><Minus className="h-3 w-3" /></Button>
                  <div className="flex gap-1">
                    {[0, 1, 2].map(i => ( <div key={i} className={cn("w-4 h-4 rounded-full border-2", i < combatStats.deathSaves.successes ? "bg-green-500 border-green-500" : "border-muted-foreground/30")} /> ))}
                  </div>
                  <Button size="icon" variant="outline" className="h-6 w-6" onClick={() => handleDeathSaveChange('successes', combatStats.deathSaves.successes + 1)}><Plus className="h-3 w-3" /></Button>
                </div>
              </div>
              <div className="space-y-2">
                <Label className="text-[10px] uppercase font-bold text-red-600">{t('failures')}</Label>
                <div className="flex items-center gap-2">
                  <Button size="icon" variant="outline" className="h-6 w-6" onClick={() => handleDeathSaveChange('failures', combatStats.deathSaves.failures - 1)}><Minus className="h-3 w-3" /></Button>
                  <div className="flex gap-1">
                    {[0, 1, 2].map(i => ( <div key={i} className={cn("w-4 h-4 rounded-full border-2", i < combatStats.deathSaves.failures ? "bg-red-500 border-red-500" : "border-muted-foreground/30")} /> ))}
                  </div>
                  <Button size="icon" variant="outline" className="h-6 w-6" onClick={() => handleDeathSaveChange('failures', combatStats.deathSaves.failures + 1)}><Plus className="h-3 w-3" /></Button>
                </div>
              </div>
            </div>
            <div className="pt-3 border-t">
              <div className="flex items-center justify-between">
                <Label className="text-[10px] uppercase font-bold">{t('exhaustion')}</Label>
                <div className="flex items-center gap-2">
                  <Button size="icon" variant="outline" className="h-6 w-6" onClick={() => handleExhaustionChange(-1)} disabled={exhaustion <= 0}><Minus className="h-3 w-3" /></Button>
                  <span className={cn("text-lg font-black w-6 text-center", exhaustion >= 5 ? "text-red-500" : exhaustion >= 3 ? "text-orange-500" : exhaustion >= 1 ? "text-yellow-500" : "text-green-500")}>{exhaustion}</span>
                  <Button size="icon" variant="outline" className="h-6 w-6" onClick={() => handleExhaustionChange(1)} disabled={exhaustion >= 6}><Plus className="h-3 w-3" /></Button>
                </div>
              </div>
              <p className={cn("text-[10px] mt-1 text-center", exhaustion >= 5 ? "text-red-500" : exhaustion >= 3 ? "text-orange-500" : "text-muted-foreground")}>
                {EXHAUSTION_EFFECTS[exhaustion]}
              </p>
            </div>
          </CardContent>
        </Card>

        <Card id="hit-dice-card">
          <CardHeader className="flex flex-row items-center justify-between px-4 pt-2 pb-2">
            <CardTitle className="text-[10px] font-bold uppercase text-muted-foreground tracking-tight">{t('hitDice')}</CardTitle>
            <Button variant="ghost" size="sm" className="h-6 text-[10px]" onClick={resetAllHitDice}>{t('longRest')}</Button>
          </CardHeader>
          <CardContent className="p-4 pt-0 space-y-3">
            {hitDiceEntries.map(entry => {
              const used = hitDiceUsed[entry.className] || 0;
              const remaining = entry.level - used;
              return (
                <div key={entry.className} className="flex items-center justify-between p-2 bg-muted/10 rounded border">
                  <div className="flex flex-col">
                    <span className="text-xs font-bold">{entry.className}</span>
                    <span className="text-[9px] text-muted-foreground uppercase">{entry.level}d{entry.dieSize}</span>
                  </div>
                  <div className="flex items-center gap-2">
                    <Button size="icon" variant="outline" className="h-6 w-6" onClick={() => handleHitDiceUse(entry.className, 1)} disabled={remaining <= 0}><Minus className="h-3 w-3" /></Button>
                    <span className="text-sm font-black w-12 text-center">{remaining} / {entry.level}</span>
                    <Button size="icon" variant="outline" className="h-6 w-6" onClick={() => handleHitDiceUse(entry.className, -1)} disabled={used <= 0}><Plus className="h-3 w-3" /></Button>
                  </div>
                </div>
              );
            })}
          </CardContent>
        </Card>

        <Card id="attacks-box">
          <CardHeader className="flex flex-row items-center justify-between px-4 pt-2 pb-2"><CardTitle className="text-[10px] font-bold uppercase text-muted-foreground tracking-tight">{t('attacksAndSpellcasting')}</CardTitle>{(showEditButtons || isAttacksEditing) && <EditSaveButton editing={isAttacksEditing} onEdit={() => setIsAttacksEditing(true)} onSave={handleSaveAttacks} />}</CardHeader>
          <CardContent className="p-4 pt-0 space-y-3">
            {attacks.map(atk => (
              <div key={atk.id} className="flex items-center justify-between p-2 bg-muted/10 rounded border border-muted/20">
                {isAttacksEditing ? (
                  <div className="flex flex-col gap-1 flex-1 mr-2">
                    <Input value={atk.name} onChange={e => setAttacks(attacks.map(a => a.id === atk.id ? { ...a, name: e.target.value } : a))} className="h-7 text-xs" />
                    <div className="flex gap-1">
                      <Input value={atk.atkBonus} onChange={e => setAttacks(attacks.map(a => a.id === atk.id ? { ...a, atkBonus: e.target.value } : a))} className="h-7 text-[10px] w-12" placeholder="Bonus" />
                      <Input value={atk.damageType} onChange={e => setAttacks(attacks.map(a => a.id === atk.id ? { ...a, damageType: e.target.value } : a))} className="h-7 text-[10px] flex-1" placeholder="Damage" />
                    </div>
                  </div>
                ) : (
                  <div className="flex flex-col"><span className="text-xs font-black">{atk.name}</span><span className="text-xs text-muted-foreground">{atk.damageType}</span></div>
                )}
                <div className="flex items-center gap-2">
                  {!isAttacksEditing && <span className="text-sm font-black text-primary">{atk.atkBonus}</span>}
                  {isAttacksEditing && <Button variant="ghost" size="icon" className="h-6 w-6 text-destructive" onClick={() => setAttacks(attacks.filter(a => a.id !== atk.id))}><Trash2 className="h-3 w-3" /></Button>}
                </div>
              </div>
            ))}
            {isAttacksEditing && <Button variant="outline" size="sm" className="w-full h-8 text-[10px]" onClick={() => setAttacks([...attacks, { id: `atk-${Date.now()}`, name: 'New Attack', atkBonus: '+0', damageType: '1d6', notes: '' }])}><Plus className="mr-1 h-3 w-3" /> Add Attack</Button>}
          </CardContent>
        </Card>

        <Card id="combat-resources-card">
          <CardHeader className="flex flex-row items-center justify-between px-4 pt-2 pb-2">
            <CardTitle className="text-[10px] font-bold uppercase text-muted-foreground tracking-tight">{t('combatResources')}</CardTitle>
            {(showEditButtons || isResourcesEditing) && <EditSaveButton editing={isResourcesEditing} onEdit={() => setIsResourcesEditing(true)} onSave={handleSaveResources} />}
          </CardHeader>
          <CardContent className="p-4 pt-0 space-y-2">
            {combatResources.length === 0 && !isResourcesEditing && (
              <p className="text-xs text-muted-foreground italic text-center py-2 border border-dashed rounded-lg">{t('noResources')}</p>
            )}
            {combatResources.map(res => (
              <div key={res.id} className="flex items-center justify-between p-2 bg-muted/10 rounded border border-muted/20">
                {isResourcesEditing ? (
                  <div className="flex flex-col gap-1 flex-1 mr-2">
                    <Input value={res.description} onChange={e => handleResourceFieldChange(res.id, 'description', e.target.value)} className="h-7 text-xs" placeholder="Resource name..." />
                    <div className="flex gap-1 items-center">
                      <span className="text-[9px] uppercase font-bold text-muted-foreground shrink-0">{t('max')}</span>
                      <Input type="number" value={res.max} onChange={e => handleResourceFieldChange(res.id, 'max', e.target.value)} className="h-7 text-[10px] w-16 text-center" min={0} />
                      {!hideNotes && (
                        <Popover>
                          <PopoverTrigger asChild><Button variant={res.notes ? 'secondary' : 'ghost'} size="icon" className="h-6 w-6 shrink-0"><Info className="h-3 w-3" /></Button></PopoverTrigger>
                          <PopoverContent className="w-64">
                            <Label className="text-xs mb-2 block">Notes for {res.description}</Label>
                            <Textarea defaultValue={res.notes || ''} onChange={e => handleResourceFieldChange(res.id, 'notes', e.target.value)} placeholder="Add notes..." className="mt-2 min-h-[100px] text-sm" />
                          </PopoverContent>
                        </Popover>
                      )}
                    </div>
                  </div>
                ) : (
                  <div className="flex items-center gap-2 flex-1 min-w-0">
                    {!hideNotes && (
                      <Popover>
                        <PopoverTrigger asChild><Button variant={res.notes ? 'secondary' : 'ghost'} size="icon" className="h-5 w-5 shrink-0"><Info className="h-3 w-3" /></Button></PopoverTrigger>
                        <PopoverContent className="w-64">
                          <Label className="text-xs mb-2 block">Notes for {res.description}</Label>
                          <Textarea defaultValue={res.notes || ''} onBlur={e => { const next = combatResources.map(r => r.id === res.id ? { ...r, notes: e.target.value } : r); setCombatResources(next); updateCharacter(characterId, { combatResources: next }); }} placeholder="Add notes..." className="mt-2 min-h-[100px] text-sm" />
                        </PopoverContent>
                      </Popover>
                    )}
                    <span className="text-xs font-bold break-words flex-1">{res.description}</span>
                  </div>
                )}
                <div className="flex items-center gap-2">
                  <Button size="icon" variant="outline" className="h-6 w-6" onClick={() => handleResourceCurrentChange(res.id, -1)} disabled={res.current <= 0}><Minus className="h-3 w-3" /></Button>
                  <span className="text-sm font-black w-12 text-center">{res.current} / {res.max}</span>
                  <Button size="icon" variant="outline" className="h-6 w-6" onClick={() => handleResourceCurrentChange(res.id, 1)} disabled={res.current >= res.max}><Plus className="h-3 w-3" /></Button>
                  {isResourcesEditing && ( <Button variant="ghost" size="icon" className="h-6 w-6 text-destructive" onClick={() => removeResource(res.id)}><Trash2 className="h-3 w-3" /></Button> )}
                </div>
              </div>
            ))}
            {isResourcesEditing && (
              <div className="flex gap-2 pt-2 border-t items-center">
                <Input placeholder={t('newResourcePlaceholder')} value={newResourceDesc} onChange={e => setNewResourceDesc(e.target.value)} className="h-8 text-xs flex-1" />
                <Input type="number" value={newResourceMax} onChange={e => setNewResourceMax(parseInt(e.target.value) || 1)} className="h-8 text-xs w-16 text-center" min={1} />
                <Button size="sm" className="h-8" onClick={addResource}><Plus className="h-4 w-4" /></Button>
              </div>
            )}
          </CardContent>
        </Card>
      </div>
    );
  }
);

DndCombatSection.displayName = 'DndCombatSection';