'use client';

import * as React from 'react';
import { type DnDAttack, type CombatResource, type SpellcastingEntry, type DnDAbility } from '@/lib/types';
import { Card, CardContent, CardHeader, CardTitle } from '../../ui/card';
import { Input } from '../../ui/input';
import { Textarea } from '../../ui/textarea';
import { Button } from '../../ui/button';
import { Plus, Trash2, Edit, Save, Minus, Info } from 'lucide-react';
import { Label } from '@/components/ui/label';
import { Checkbox } from '@/components/ui/checkbox';
import { Popover, PopoverContent, PopoverTrigger } from '../../ui/popover';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '../../ui/select';
import { cn } from '@/lib/utils';
import { useCharacterContext } from '@/context/character-context';
import { useTranslation } from '@/context/language-context';

const CLASS_HIT_DICE: Record<string, number> = {
  "Artificer": 8, "Barbarian": 12, "Bard": 8, "Cleric": 8, "Druid": 8,
  "Fighter": 10, "Monk": 8, "Paladin": 10, "Ranger": 10, "Rogue": 8,
  "Sorcerer": 6, "Warlock": 8, "Wizard": 6,
};

const EXHAUSTION_EFFECTS = [
  'Disadvantage on ability checks',
  'Speed halved',
  'Disadvantage on attack rolls and saving throws',
  'Hit point maximum halved',
  'Speed reduced to 0',
  'Death',
];

const EditSaveButton = ({ editing, onEdit, onSave }: { editing: boolean; onEdit: () => void; onSave: () => void }) => (
  editing ? <Button size="icon" variant="ghost" onClick={onSave} className="h-7 w-7"><Save className="h-4 w-4" /></Button> : <Button size="icon" variant="outline" onClick={onEdit} className="h-7 w-7"><Edit className="h-4 w-4" /></Button>
);

interface CombatStats {
  armorClass: number;
  speed: number;
  hitPoints: { current: number; max: number };
  hitPointsNotes?: string;
  hpTracking?: string;
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
  initialSpellcastingEntries: SpellcastingEntry[];
  stats: Record<string, number>;
  proficiencyBonus: number;
  progressionData: { 
    characterClass: string; 
    level: number; 
    isMulticlass: boolean; 
    multiclasses: { class: string; level: number; isDisabled?: boolean }[];
  };
  isCompactView: boolean;
  activeCompactSection: string;
  manualHitDice?: string;
  onManualHitDiceChange?: (value: string) => void;
}

export const DndCombatSection = React.forwardRef<{ saveAll: () => void }, CombatSectionProps>(
  ({ characterId, initialCombatStats, initialExhaustion, initialHitDiceUsed, initialAttacks, initialCombatResources, initialSpellcastingEntries, stats, proficiencyBonus, progressionData, isCompactView, activeCompactSection, manualHitDice, onManualHitDiceChange }, ref) => {
    const { updateCharacter, showEditButtons, hideNotes } = useCharacterContext();
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
    const [isHitDiceEditing, setIsHitDiceEditing] = React.useState(false);
    
    const [spellcastingEntries, setSpellcastingEntries] = React.useState<SpellcastingEntry[]>(initialSpellcastingEntries);
    const [isSpellcastingEditing, setIsSpellcastingEditing] = React.useState(false);

    React.useEffect(() => {
      setCombatStats(initialCombatStats);
      setExhaustion(initialExhaustion);
      setHitDiceUsed(initialHitDiceUsed);
      setCombatResources(initialCombatResources);
      setSpellcastingEntries(initialSpellcastingEntries);
  
      const migratedAttacks = initialAttacks.map(atk => ({
        ...atk,
        ability: (atk as any).ability || 'strength',
        useProficiencyBonus: (atk as any).useProficiencyBonus !== undefined ? (atk as any).useProficiencyBonus : true,
        damageDice: (atk as any).damageDice || '1d6',
        damageModifier: (atk as any).damageModifier || '+0',
      }));
      setAttacks(migratedAttacks);
    }, [characterId, initialAttacks]);

    React.useEffect(() => {
      if (!isSpellcastingEditing) {
        setSpellcastingEntries(initialSpellcastingEntries);
      }
    }, [initialSpellcastingEntries, isSpellcastingEditing]);

    const calculateAttackBonus = (ability: DnDAbility | 'none', useProficiency: boolean) => {
      if (ability === 'none' || !ability) return '+0';
      const statValue = stats[ability] || 10;
      const mod = Math.floor((statValue - 10) / 2);
      const total = mod + (useProficiency ? proficiencyBonus : 0);
      return total >= 0 ? `+${total}` : `${total}`;
    };

    const handleAttackFieldChange = (id: string, field: keyof DnDAttack, value: string | number | boolean) => {
      setAttacks(prev => {
        const updated = prev.map(atk => {
          if (atk.id !== id) return atk;
          return { ...atk, [field]: value };
        });
        updateCharacter(characterId, { attacks: updated });
        return updated;
      });
    };

    const addAttack = () => {
      const newAttack: DnDAttack = { 
        id: `atk-${Date.now()}`, 
        name: 'New Attack', 
        ability: 'strength', 
        useProficiencyBonus: true, 
        damageDice: '1d6', 
        damageModifier: '+0', 
        notes: '' 
      };
      const updated = [...attacks, newAttack];
      setAttacks(updated);
      updateCharacter(characterId, { attacks: updated });
    };

    const removeAttack = (id: string) => {
      const updated = attacks.filter(a => a.id !== id);
      setAttacks(updated);
      updateCharacter(characterId, { attacks: updated });
    };

    const dexMod = Math.floor(((stats.dexterity || 10) - 10) / 2);
    const conMod = Math.floor(((stats.constitution || 10) - 10) / 2);
    const baseMaxHp = 8 + conMod;

    const activeMcLevelSum = progressionData.isMulticlass
      ? (progressionData.multiclasses?.reduce((sum, mc) => sum + (mc.isDisabled ? 0 : mc.level), 0) || 0)
      : 0;

    const primaryClassLevel = progressionData.isMulticlass
      ? Math.max(1, progressionData.level - activeMcLevelSum)
      : progressionData.level;
    const primaryDieSize = CLASS_HIT_DICE[progressionData.characterClass] || 8;

    const hitDiceEntries = React.useMemo(() => {
      const entries: { className: string; level: number; dieSize: number }[] = [];
      entries.push({ className: progressionData.characterClass, level: primaryClassLevel, dieSize: primaryDieSize });
      if (progressionData.isMulticlass && progressionData.multiclasses) {
        for (const mc of progressionData.multiclasses) {
          if (!mc.isDisabled) {
            entries.push({ className: mc.class, level: mc.level, dieSize: CLASS_HIT_DICE[mc.class] || 8 });
          }
        }
      }
      return entries;
    }, [progressionData, primaryClassLevel, primaryDieSize]);

    const handleSaveCombatStats = React.useCallback(() => { updateCharacter(characterId, { armorClass: combatStats.armorClass, speed: combatStats.speed }); setIsCombatStatsEditing(false); }, [characterId, combatStats.armorClass, combatStats.speed, updateCharacter]);
    const handleSaveHp = React.useCallback(() => { updateCharacter(characterId, { hitPoints: combatStats.hitPoints, temporaryHitPoints: combatStats.temporaryHitPoints }); setIsHpEditing(false); }, [characterId, combatStats.hitPoints, combatStats.temporaryHitPoints, updateCharacter]);
    const handleSaveAttacks = React.useCallback(() => { updateCharacter(characterId, { attacks }); setIsAttacksEditing(false); }, [characterId, attacks, updateCharacter]);
    const handleSaveResources = React.useCallback(() => { updateCharacter(characterId, { combatResources }); setIsResourcesEditing(false); }, [characterId, combatResources, updateCharacter]);
    const handleSaveSpellcasting = React.useCallback(() => { updateCharacter(characterId, { spellcastingEntries }); setIsSpellcastingEditing(false); }, [characterId, spellcastingEntries, updateCharacter]);

    React.useImperativeHandle(ref, () => ({
      saveAll: () => {
        if (isCombatStatsEditing) handleSaveCombatStats();
        if (isHpEditing) handleSaveHp();
        if (isAttacksEditing) handleSaveAttacks();
        if (isResourcesEditing) handleSaveResources();
        if (isSpellcastingEditing) handleSaveSpellcasting();
      }
    }), [isCombatStatsEditing, isHpEditing, isAttacksEditing, isResourcesEditing, isSpellcastingEditing, handleSaveCombatStats, handleSaveHp, handleSaveAttacks, handleSaveResources, handleSaveSpellcasting]);

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

    const getSpellcastingMod = (ability: string) => {
      if (ability === 'none' || !ability) return 0;
      const statValue = stats[ability] || 10;
      return Math.floor((statValue - 10) / 2);
    };

    const calculateSpellAttack = (ability: string) => {
      const mod = getSpellcastingMod(ability);
      const total = mod + proficiencyBonus;
      return total >= 0 ? `+${total}` : `${total}`;
    };

    const calculateSpellSaveDC = (ability: string) => {
      return 8 + proficiencyBonus + getSpellcastingMod(ability);
    };

    const handleSpellcastingFieldChange = (id: string, field: keyof SpellcastingEntry, value: string | number) => {
      setSpellcastingEntries(prev => prev.map(entry => {
        if (entry.id !== id) return entry;
        const updated = { ...entry, [field]: value };
        if (field === 'ability' && typeof value === 'string') {
          updated.attackBonus = calculateSpellAttack(value);
          updated.saveDC = calculateSpellSaveDC(value);
        }
        return updated;
      }));
    };

    const addSpellcastingEntry = () => {
      const newEntry: SpellcastingEntry = { id: `spellcast-${Date.now()}`, ability: 'none', attackBonus: '+0', saveDC: 10 };
      setSpellcastingEntries([...spellcastingEntries, newEntry]);
    };

    const removeSpellcastingEntry = (id: string) => {
      setSpellcastingEntries(spellcastingEntries.filter(e => e.id !== id));
    };

    return (
      <div className={cn("md:col-span-4 space-y-6", isCompactView && activeCompactSection !== 'combat-section' && "hidden")}>
        <Card id="combat-stats-card">
          <CardHeader className="flex flex-row items-center justify-between px-4 pt-2 pb-2"><CardTitle className="text-[10px] font-bold uppercase text-muted-foreground tracking-tight">{t('combatStats')}</CardTitle>{(showEditButtons || isCombatStatsEditing) && <EditSaveButton editing={isCombatStatsEditing} onEdit={() => setIsCombatStatsEditing(true)} onSave={handleSaveCombatStats} />}</CardHeader>
          <CardContent className="grid grid-cols-3 gap-4 p-4 pt-0 text-center">
            <div className="p-2 rounded-lg bg-background border"><Label className="text-[10px] text-muted-foreground uppercase font-bold">{t('armorClass')}</Label>{isCombatStatsEditing ? (<Input type="number" value={combatStats.armorClass} onChange={e => setCombatStats({ ...combatStats, armorClass: parseInt(e.target.value) || 10 })} className="h-9 w-full text-center" />) : (<div className="text-sm font-bold">{combatStats.armorClass}</div>)}</div>
            <div className="p-2 rounded-lg bg-background border"><Label className="text-[10px] text-muted-foreground uppercase font-bold">{t('initiative')}</Label><div className="text-sm font-bold">{dexMod >= 0 ? `+${dexMod}` : dexMod}</div></div>
            <div className="p-2 rounded-lg bg-background border"><Label className="text-[10px] text-muted-foreground uppercase font-bold">{t('speed')}</Label>{isCombatStatsEditing ? <Input type="number" value={combatStats.speed} onChange={e => setCombatStats({ ...combatStats, speed: parseInt(e.target.value) || 0 })} className="h-9 w-full text-center" /> : <div className="text-sm font-bold">{combatStats.speed}ft</div>}</div>
          </CardContent>
        </Card>

        <Card id="hit-points-card">
          <CardHeader className="flex flex-row items-center justify-between px-4 pt-2 pb-2">
              <div className="flex items-center gap-2">
                <CardTitle className="text-[10px] font-bold uppercase text-muted-foreground tracking-tight">Health</CardTitle>
                {!hideNotes && (
                  <Popover>
                    <PopoverTrigger asChild>
                      <Button variant={combatStats.hitPointsNotes ? 'secondary' : 'ghost'} size="icon" className="h-5 w-5 shrink-0" title="Health Notes">
                        <Info className="h-3 w-3" />
                      </Button>
                    </PopoverTrigger>
                    <PopoverContent className="w-64">
                      <Label className="text-xs mb-2 block">Health Notes</Label>
                      <Textarea
                        defaultValue={combatStats.hitPointsNotes || ''}
                        onBlur={(e) => {
                          const next = { ...combatStats, hitPointsNotes: e.target.value };
                          setCombatStats(next);
                          updateCharacter(characterId, { hitPointsNotes: e.target.value });
                        }}
                        placeholder="Add notes..."
                        className="mt-2 min-h-[100px] text-sm"
                      />
                    </PopoverContent>
                  </Popover>
                )}
              </div>
              {(showEditButtons || isHpEditing) && <EditSaveButton editing={isHpEditing} onEdit={() => setIsHpEditing(true)} onSave={handleSaveHp} />}
            </CardHeader>
          <CardContent className="p-4 pt-0 space-y-4">
            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-4">
                <div className="p-2 border rounded text-center">
                  <div className="text-[9px] italic text-muted-foreground mb-1">Base value: {baseMaxHp}</div>
                  <Label className="text-[10px] uppercase font-bold">Max</Label>
                    {isHpEditing ? (
                      <Input type="number" value={combatStats.hitPoints.max} onChange={e => setCombatStats({ ...combatStats, hitPoints: { ...combatStats.hitPoints, max: parseInt(e.target.value) || 0 } })} className="h-8 text-center" />
                    ) : (
                      <div className="text-base font-bold">{combatStats.hitPoints.max}</div>
                    )}
                  </div>
                <div className="p-2 border rounded text-center"><Label className="text-[10px] uppercase font-bold">Current</Label>{isHpEditing ? (<Input type="number" value={combatStats.hitPoints.current} onChange={e => setCombatStats({ ...combatStats, hitPoints: { ...combatStats.hitPoints, current: parseInt(e.target.value) || 0 } })} className="h-8 text-center" />) : (<div className="text-base font-bold text-primary">{combatStats.hitPoints.current}</div>)}</div>
              </div>
              <div className="space-y-4">
                <div className="p-2 border rounded text-center"><Label className="text-[10px] uppercase font-bold">Temp</Label>{isHpEditing ? (<Input type="number" value={combatStats.temporaryHitPoints} onChange={e => setCombatStats({ ...combatStats, temporaryHitPoints: parseInt(e.target.value) || 0 })} className="h-8 text-center" />) : (<div className="text-base font-bold">{combatStats.temporaryHitPoints || 0}</div>)}</div>
                <div className="flex flex-col gap-2">
                  <Input 
                    type="text" 
                    inputMode="numeric"
                    pattern="[0-9]*"
                    placeholder="+/-" 
                    value={hpDelta} 
                    onChange={e => {
                      const val = e.target.value.replace(/[^0-9]/g, '');
                      setHpDelta(val);
                    }} 
                    className="h-8 text-center" 
                  />
                <div className="grid grid-cols-2 gap-2">
                  <Button size="sm" variant="outline" onClick={() => handleHpMath('sub')}>Sub</Button>
                  <Button size="sm" variant="outline" onClick={() => handleHpMath('rec')}>Heal</Button>
                </div>
              </div>
            </div>
          </div>
  
          <div className="pt-4 border-t">
            <Label className="text-[10px] uppercase font-bold mb-2 block">HP Tracking</Label>
              <Textarea
                value={combatStats.hpTracking || ''}
                onChange={e => {
                  const next = { ...combatStats, hpTracking: e.target.value };
                  setCombatStats(next);
                  updateCharacter(characterId, { hpTracking: e.target.value });
                }}
                placeholder="Track conditions, temporary effects, etc..."
                className="min-h-[80px] text-xs resize-none"
              />
            </div>
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
                  <div className="flex gap-1">{[0, 1, 2].map(i => ( <div key={i} className={cn("w-4 h-4 rounded-full border-2", i < combatStats.deathSaves.successes ? "bg-green-500 border-green-500" : "border-muted-foreground/30")} /> ))}</div>
                  <Button size="icon" variant="outline" className="h-6 w-6" onClick={() => handleDeathSaveChange('successes', combatStats.deathSaves.successes + 1)}><Plus className="h-3 w-3" /></Button>
                </div>
              </div>
              <div className="space-y-2">
                <Label className="text-[10px] uppercase font-bold text-red-600">{t('failures')}</Label>
                <div className="flex items-center gap-2">
                  <Button size="icon" variant="outline" className="h-6 w-6" onClick={() => handleDeathSaveChange('failures', combatStats.deathSaves.failures - 1)}><Minus className="h-3 w-3" /></Button>
                  <div className="flex gap-1">{[0, 1, 2].map(i => ( <div key={i} className={cn("w-4 h-4 rounded-full border-2", i < combatStats.deathSaves.failures ? "bg-red-500 border-red-500" : "border-muted-foreground/30")} /> ))}</div>
                  <Button size="icon" variant="outline" className="h-6 w-6" onClick={() => handleDeathSaveChange('failures', combatStats.deathSaves.failures + 1)}><Plus className="h-3 w-3" /></Button>
                </div>
              </div>
            </div>
            <div className="pt-3 border-t">
              <div className="flex items-center justify-between mb-2">
                <Label className="text-[10px] uppercase font-bold">{t('exhaustion')}</Label>
                <div className="flex items-center gap-2">
                  <Button size="icon" variant="outline" className="h-6 w-6" onClick={() => handleExhaustionChange(-1)} disabled={exhaustion <= 0}><Minus className="h-3 w-3" /></Button>
                  <span className={cn("text-lg font-black w-6 text-center", exhaustion >= 5 ? "text-red-500" : exhaustion >= 3 ? "text-orange-500" : exhaustion >= 1 ? "text-yellow-500" : "text-green-500")}>{exhaustion}</span>
                  <Button size="icon" variant="outline" className="h-6 w-6" onClick={() => handleExhaustionChange(1)} disabled={exhaustion >= 6}><Plus className="h-3 w-3" /></Button>
                </div>
              </div>
              
              {exhaustion === 0 ? (
                <p className="text-[10px] text-center text-green-500 font-medium">No exhaustion effects</p>
              ) : (
                <ul className="space-y-1">
                  {EXHAUSTION_EFFECTS.slice(0, exhaustion).map((effect, index) => (
                    <li 
                      key={index} 
                      className={cn(
                        "text-[10px] flex items-start gap-1.5",
                        exhaustion >= 5 ? "text-red-500" : exhaustion >= 3 ? "text-orange-500" : "text-yellow-500"
                      )}
                    >
                      <span className="font-bold min-w-[12px]">{index + 1}.</span>
                      <span>{effect}</span>
                    </li>
                  ))}
                </ul>
              )}
            </div>
          </CardContent>
        </Card>

        <Card id="hit-dice-card">
          <CardHeader className="flex flex-row items-center justify-between px-4 pt-2 pb-2">
            <CardTitle className="text-[10px] font-bold uppercase text-muted-foreground tracking-tight">{t('hitDice')}</CardTitle>
            <Button variant="ghost" size="sm" className="h-6 text-[10px]" onClick={resetAllHitDice}>{t('longRest')}</Button>
          </CardHeader>
          <CardContent className="p-4 pt-0 space-y-3">
            {manualHitDice !== undefined ? (
              isHitDiceEditing ? (
                <Select 
                  value={manualHitDice || 'None'} 
                  onValueChange={(v) => {
                    onManualHitDiceChange?.(v === 'None' ? '' : v);
                    setIsHitDiceEditing(false);
                  }}
                  open={true}
                  onOpenChange={(isOpen) => {
                    if (!isOpen) setIsHitDiceEditing(false);
                  }}
                >
                  <SelectTrigger className="h-10 text-lg font-bold w-full">
                    <SelectValue placeholder="Select Hit Die" />
                  </SelectTrigger>
                  <SelectContent>
                    {['None', '1d6', '1d8', '1d10', '1d12'].map(option => (
                      <SelectItem key={option} value={option} className="text-lg font-bold">
                        {option}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              ) : (
                <div 
                  className="text-2xl font-black text-center py-2 cursor-pointer hover:bg-muted/50 rounded border border-transparent hover:border-border transition-colors"
                  onClick={() => setIsHitDiceEditing(true)}
                  title="Click to change Hit Die"
                >
                  {manualHitDice || 'None'}
                </div>
              )
            ) : (
              hitDiceEntries.map(entry => {
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
              })
            )}
          </CardContent>
        </Card>

        <Card id="attacks-and-spellcasting-box">
          <CardHeader className="flex flex-row items-center justify-between px-4 pt-2 pb-2">
            <CardTitle className="text-[10px] font-bold uppercase text-muted-foreground tracking-tight">{t('attacksAndSpellcasting')}</CardTitle>
            {(showEditButtons || isAttacksEditing || isSpellcastingEditing) && <EditSaveButton editing={isAttacksEditing || isSpellcastingEditing} onEdit={() => { setIsAttacksEditing(true); setIsSpellcastingEditing(true); }} onSave={() => { handleSaveAttacks(); handleSaveSpellcasting(); }} />}
          </CardHeader>
          <CardContent className="p-4 pt-0 space-y-4">
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

            <div className="border-t pt-4">
              <Label className="text-[10px] font-bold uppercase text-muted-foreground mb-2 block">Attacks</Label>
              {attacks.map(atk => (
            <div key={atk.id} className="grid grid-cols-12 gap-2 items-center p-2 bg-muted/10 rounded border border-muted/20 mb-2">
              <div className="col-span-2 w-full">
                <Label className="text-[9px] text-muted-foreground uppercase mb-1 block">Name</Label>
                {isAttacksEditing ? (
                  <Input value={atk.name} onChange={e => handleAttackFieldChange(atk.id, 'name', e.target.value)} className="h-8 text-xs" />
                ) : (
                  <span className="text-xs font-bold">{atk.name}</span>
                )}
              </div>
              <div className="col-span-2 w-full">
                <Label className="text-[9px] text-muted-foreground uppercase mb-1 block">Ability</Label>
                {isAttacksEditing ? (
                  <Select value={atk.ability || 'strength'} onValueChange={(v) => handleAttackFieldChange(atk.id, 'ability', v)}>
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
                    {!atk.ability || atk.ability === 'none' ? 'None' : atk.ability.charAt(0).toUpperCase() + atk.ability.slice(1)}
                  </span>
                )}
              </div>
              <div className="col-span-1 w-full">
                <Label className="text-[9px] text-muted-foreground uppercase mb-1 block">Prof</Label>
                <div className="flex justify-center">
                  {isAttacksEditing ? (
                    <Checkbox 
                      checked={atk.useProficiencyBonus} 
                      onCheckedChange={(v) => handleAttackFieldChange(atk.id, 'useProficiencyBonus', !!v)}
                      className="h-5 w-5"
                    />
                  ) : (
                    <span className="text-xs font-bold">{atk.useProficiencyBonus ? '✓' : '-'}</span>
                  )}
                </div>
              </div>
              <div className="col-span-2 w-full">
                <Label className="text-[9px] text-muted-foreground uppercase mb-1 block">ATK Bonus</Label>
                <span className="text-xs font-bold">{calculateAttackBonus(atk.ability || 'none', atk.useProficiencyBonus)}</span>
              </div>
              <div className="col-span-2 w-full">
                <Label className="text-[9px] text-muted-foreground uppercase mb-1 block">Dice</Label>
                {isAttacksEditing ? (
                  <Select value={atk.damageDice} onValueChange={(v) => handleAttackFieldChange(atk.id, 'damageDice', v)}>
                    <SelectTrigger className="h-8 text-xs"><SelectValue /></SelectTrigger>
                    <SelectContent>
                      {['1d4', '1d6', '1d8', '1d10', '1d12', '1d20', '2d6', '2d8', '2d10', '2d12', '2d20', '3d6', '4d6', '5d6', '6d6', '8d6', '10d6'].map(d => (
                        <SelectItem key={d} value={d}>{d}</SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                ) : (
                  <span className="text-xs font-bold">{atk.damageDice}</span>
                )}
              </div>
              <div className="col-span-2 w-full">
                <Label className="text-[9px] text-muted-foreground uppercase mb-1 block">Mod</Label>
                {isAttacksEditing ? (
                  <Input value={atk.damageModifier} onChange={e => handleAttackFieldChange(atk.id, 'damageModifier', e.target.value)} className="h-8 text-xs text-center" placeholder="+0" />
                ) : (
                  <span className="text-xs font-bold">{atk.damageModifier || '+0'}</span>
                )}
              </div>
              <div className="col-span-1 flex justify-end">
                {isAttacksEditing && (
                  <Button variant="ghost" size="icon" className="h-8 w-8 text-destructive shrink-0" onClick={() => removeAttack(atk.id)}>
                    <Trash2 className="h-3 w-3" />
                  </Button>
                )}
              </div>
            </div>
          ))}
              {isAttacksEditing && (
                <Button variant="outline" size="sm" className="w-full h-8 text-[10px] mt-2" onClick={addAttack}>
                  <Plus className="mr-1 h-3 w-3" /> Add Attack
                </Button>
              )}
            </div>
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