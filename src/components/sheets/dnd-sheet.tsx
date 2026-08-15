'use client';

import * as React from 'react';
import {
  type DnD5eCharacter,
  InventoryItem,
  DnDSavingThrow,
  DnDSkill,
  DnDAttack,
  Spell,
  AttunementItem,
  DnDCompanion,
  CombatResource,
} from '@/lib/types';
import { Card, CardContent, CardHeader, CardTitle } from '../ui/card';
import { Input } from '../ui/input';
import { Textarea } from '../ui/textarea';
import { Button } from '../ui/button';
import { Plus, Trash2, Edit, Save, Minus, Info } from 'lucide-react';
import { Checkbox } from '../ui/checkbox';
import { Label } from '@/components/ui/label';
import { cn } from '@/lib/utils';
import * as AccordionPrimitive from "@radix-ui/react-accordion";
import {
  Accordion,
  AccordionContent,
  AccordionItem,
  AccordionTrigger,
} from "@/components/ui/accordion";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@/components/ui/popover";
import { useCharacterContext } from '@/context/character-context';
import { useTranslation } from '@/context/language-context';
import { useToast } from '@/hooks/use-toast';

const DND_CLASSES = [
  "Artificer", "Barbarian", "Bard", "Cleric", "Druid", "Fighter", "Monk",
  "Paladin", "Ranger", "Rogue", "Sorcerer", "Warlock", "Wizard"
] as const;

type DndSheetProps = {
  character: DnD5eCharacter;
  isCompactView: boolean;
  activeCompactSection: string;
};

const CLASS_HIT_DICE: Record<string, number> = {
  "Artificer": 8, "Barbarian": 12, "Bard": 8, "Cleric": 8, "Druid": 8,
  "Fighter": 10, "Monk": 8, "Paladin": 10, "Ranger": 10, "Rogue": 8,
  "Sorcerer": 6, "Warlock": 8, "Wizard": 6,
};

const DEFAULT_SKILLS: DnDSkill[] = [
  { name: 'acrobatics', label: 'Acrobatics (Dex)', proficient: false, expertise: false, value: 0 },
  { name: 'animalHandling', label: 'Animal Handling (Wis)', proficient: false, expertise: false, value: 0 },
  { name: 'arcana', label: 'Arcana (Int)', proficient: false, expertise: false, value: 0 },
  { name: 'athletics', label: 'Athletics (Str)', proficient: false, expertise: false, value: 0 },
  { name: 'deception', label: 'Deception (Cha)', proficient: false, expertise: false, value: 0 },
  { name: 'history', label: 'History (Int)', proficient: false, expertise: false, value: 0 },
  { name: 'insight', label: 'Insight (Wis)', proficient: false, expertise: false, value: 0 },
  { name: 'intimidation', label: 'Intimidation (Cha)', proficient: false, expertise: false, value: 0 },
  { name: 'investigation', label: 'Investigation (Int)', proficient: false, expertise: false, value: 0 },
  { name: 'medicine', label: 'Medicine (Wis)', proficient: false, expertise: false, value: 0 },
  { name: 'nature', label: 'Nature (Int)', proficient: false, expertise: false, value: 0 },
  { name: 'perception', label: 'Perception (Wis)', proficient: false, expertise: false, value: 0 },
  { name: 'performance', label: 'Performance (Cha)', proficient: false, expertise: false, value: 0 },
  { name: 'persuasion', label: 'Persuasion (Cha)', proficient: false, expertise: false, value: 0 },
  { name: 'religion', label: 'Religion (Int)', proficient: false, expertise: false, value: 0 },
  { name: 'sleightOfHand', label: 'Sleight of Hand (Dex)', proficient: false, expertise: false, value: 0 },
  { name: 'stealth', label: 'Stealth (Dex)', proficient: false, expertise: false, value: 0 },
  { name: 'survival', label: 'Survival (Wis)', proficient: false, expertise: false, value: 0 },
];

const SKILL_STAT_MAP: Record<string, keyof DnD5eCharacter['stats']> = {
  acrobatics: 'dexterity', animalHandling: 'wisdom', arcana: 'intelligence', athletics: 'strength',
  deception: 'charisma', history: 'intelligence', insight: 'wisdom', intimidation: 'charisma',
  investigation: 'intelligence', medicine: 'wisdom', nature: 'intelligence', perception: 'wisdom',
  performance: 'charisma', persuasion: 'charisma', religion: 'intelligence', sleightOfHand: 'dexterity',
  stealth: 'dexterity', survival: 'wisdom',
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

const calculateLevelFromExp = (exp: number): number => {
  if (exp >= 355000) return 20; if (exp >= 305000) return 19; if (exp >= 265000) return 18;
  if (exp >= 225000) return 17; if (exp >= 195000) return 16; if (exp >= 165000) return 15;
  if (exp >= 140000) return 14; if (exp >= 120000) return 13; if (exp >= 100000) return 12;
  if (exp >= 85000) return 11; if (exp >= 64000) return 10; if (exp >= 48000) return 9;
  if (exp >= 34000) return 8; if (exp >= 23000) return 7; if (exp >= 14000) return 6;
  if (exp >= 6500) return 5; if (exp >= 2700) return 4; if (exp >= 900) return 3;
  if (exp >= 300) return 2; return 1;
};

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
  editing ? (
    <Button size="icon" variant="ghost" onClick={onSave} className="h-7 w-7"><Save className="h-4 w-4" /></Button>
  ) : (
    <Button size="icon" variant="outline" onClick={onEdit} className="h-7 w-7"><Edit className="h-4 w-4" /></Button>
  )
);

const DetailField = ({ label, value, editing, onChange }: { label: string; value: string | number; editing: boolean; onChange: (val: string) => void }) => (
  <div className="flex flex-col gap-1">
    <Label className="text-[10px] text-muted-foreground uppercase font-bold">{label}</Label>
    {editing ? (
      <Input value={value} onChange={(e) => onChange(e.target.value)} className="h-7 text-xs p-1" />
    ) : (
      <span className="text-sm font-semibold truncate">{value || '-'}</span>
    )}
  </div>
);

export const DndSheet = React.forwardRef<any, DndSheetProps>(
  ({ character, isCompactView, activeCompactSection }, ref) => {
    const { updateCharacter, setHasUnsavedChanges, showEditButtons, hideNotes } = useCharacterContext();
    const { t } = useTranslation();
    const { toast } = useToast();

    // UI States
    const [isHeaderEditing, setIsHeaderEditing] = React.useState(false);
    const [isProgressionEditing, setIsProgressionEditing] = React.useState(false);
    const [isStatsEditing, setIsStatsEditing] = React.useState(false);
    const [isSavesEditing, setIsSavesEditing] = React.useState(false);
    const [isSkillsEditing, setIsSkillsEditing] = React.useState(false);
    const [isHpEditing, setIsHpEditing] = React.useState(false);
    const [isCombatStatsEditing, setIsCombatStatsEditing] = React.useState(false);
    const [isAttacksEditing, setIsAttacksEditing] = React.useState(false);
    const [isAttunementEditing, setIsAttunementEditing] = React.useState(false);
    const [isItemsEditing, setIsItemsEditing] = React.useState(false);
    const [isInventoryEditing, setIsInventoryEditing] = React.useState(false);
    const [isMoneyEditing, setIsMoneyEditing] = React.useState(false);
    const [isTraitEditing, setIsTraitEditing] = React.useState(false);
    const [isIdealEditing, setIsIdealEditing] = React.useState(false);
    const [isBondEditing, setIsBondEditing] = React.useState(false);
    const [isFlawEditing, setIsFlawEditing] = React.useState(false);
    const [isFeaturesEditing, setIsFeaturesEditing] = React.useState(false);
    const [isOtherProficienciesEditing, setIsOtherProficienciesEditing] = React.useState(false);
    const [editingLevel, setEditingLevel] = React.useState<number | null>(null);

    // Data States
    const [name, setName] = React.useState(character.name);
    const [headerData, setHeaderData] = React.useState({ background: character.background, race: character.race, alignment: character.alignment || '', age: character.age || '', eyes: character.eyes || '', skin: character.skin || '', height: character.height || '', weight: character.weight || '', hair: character.hair || '', backstory: character.backstory || '', notes: character.notes || '' });
    const [progressionData, setProgressionData] = React.useState({ characterClass: character.characterClass, level: character.level, experiencePoints: character.experiencePoints || 0, isMulticlass: character.isMulticlass || false, multiclasses: character.multiclasses || [] });
    const [expToCount, setExpToCount] = React.useState(0);
    const [stats, setStats] = React.useState(character.stats);
    const [savingThrows, setSavingThrows] = React.useState((character.savingThrows && character.savingThrows.length > 0) ? character.savingThrows : []);
    const [skills, setSkills] = React.useState((character.skills && character.skills.length > 0) ? character.skills : DEFAULT_SKILLS);
    const [combatStats, setCombatStats] = React.useState({ armorClass: character.armorClass, speed: character.speed, hitPoints: character.hitPoints || { current: 10, max: 10 }, temporaryHitPoints: character.temporaryHitPoints || 0, deathSaves: character.deathSaves || { successes: 0, failures: 0 } });
    const [hpDelta, setHpDelta] = React.useState<string>('');
    const [exhaustion, setExhaustion] = React.useState(character.exhaustion || 0);
    const [hitDiceUsed, setHitDiceUsed] = React.useState<Record<string, number>>(character.hitDiceUsed || {});
    const [otherProficienciesAndLanguages, setOtherProficienciesAndLanguages] = React.useState<string[]>(character.otherProficienciesAndLanguages || []);
    const [attacks, setAttacks] = React.useState<DnDAttack[]>(character.attacks || []);
    const [attunementItems, setAttunementItems] = React.useState<AttunementItem[]>(character.attunementItems || []);
    const [narrativeData, setNarrativeData] = React.useState({ personalityTraits: character.personalityTraits || [], ideals: character.ideals || [], bonds: character.bonds || [], flaws: character.flaws || [], featuresAndTraits: character.featuresAndTraits || [] });
    const [equipment, setEquipment] = React.useState<InventoryItem[]>(character.equipment ?? []);
    const [inventoryItems, setInventoryItems] = React.useState<InventoryItem[]>(character.inventory ?? []);
    const [currency, setCurrency] = React.useState(character.currency || { cp: 0, sp: 0, ep: 0, gp: 150, pp: 5 });
    const [spells, setSpells] = React.useState(character.spells || []);
    const [spellSlots, setSpellSlots] = React.useState(character.spellSlots || { 1: { max: 0, current: 0 }, 2: { max: 0, current: 0 }, 3: { max: 0, current: 0 }, 4: { max: 0, current: 0 }, 5: { max: 0, current: 0 }, 6: { max: 0, current: 0 }, 7: { max: 0, current: 0 }, 8: { max: 0, current: 0 }, 9: { max: 0, current: 0 } });

    // New Items States
    const [newSpellName, setNewSpellName] = React.useState('');
    const [newEquipmentItem, setNewEquipmentItem] = React.useState('');
    const [newInventoryItem, setNewInventoryItem] = React.useState('');
    const [newFeatureItem, setNewFeatureItem] = React.useState('');
    const [newTraitItem, setNewTraitItem] = React.useState('');
    const [newIdealItem, setNewIdealItem] = React.useState('');
    const [newBondItem, setNewBondItem] = React.useState('');
    const [newFlawItem, setNewFlawItem] = React.useState('');
    const [newProfItem, setNewProfItem] = React.useState('');
    const [newAttunementItem, setNewAttunementItem] = React.useState('');
    const [companions, setCompanions] = React.useState<DnDCompanion[]>(character.companions || []);
    const [spellcastingData, setSpellcastingData] = React.useState({
    spellcastingAbility: character.spellcastingAbility || 'none',
    spellAttackBonus: character.spellAttackBonus || '',
    spellSaveDifficulty: character.spellSaveDifficulty || 0,
    });
    const [isSpellcastingEditing, setIsSpellcastingEditing] = React.useState(false);
    const [combatResources, setCombatResources] = React.useState<CombatResource[]>(character.combatResources || []);
    const [isResourcesEditing, setIsResourcesEditing] = React.useState(false);
    const [newResourceDesc, setNewResourceDesc] = React.useState('');
    const [newResourceMax, setNewResourceMax] = React.useState(1);

    // Derived values
    const proficiencyBonus = Math.floor((progressionData.level - 1) / 4) + 2;
    const dexMod = Math.floor((stats.dexterity - 10) / 2);

    const calculatedSkills = React.useMemo(() => {
      return skills.map(skill => {
        const statKey = SKILL_STAT_MAP[skill.name];
        if (!statKey || isSkillsEditing) return skill;
        const mod = Math.floor((stats[statKey] - 10) / 2);
        return { ...skill, value: mod + (skill.proficient ? proficiencyBonus : 0) + (skill.expertise ? proficiencyBonus : 0) };
      });
    }, [skills, stats, proficiencyBonus, isSkillsEditing]);

    const passivePerception = 10 + (calculatedSkills.find(s => s.name === 'perception')?.value || 0);

    const calculatedSavingThrows = React.useMemo(() => {
      return savingThrows.map(st => {
        const statKey = st.name.toLowerCase() as keyof typeof stats;
        const mod = Math.floor((stats[statKey] - 10) / 2);
        return { ...st, value: mod + (st.proficient ? proficiencyBonus : 0) };
      });
    }, [savingThrows, stats, proficiencyBonus]);

    // Hit Dice derived data
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

    // Save Handlers
    const handleSaveHeader = React.useCallback(() => { updateCharacter(character.id, { name, ...headerData }); setIsHeaderEditing(false); }, [character.id, name, headerData, updateCharacter]);
    const handleSaveProgression = React.useCallback(() => { updateCharacter(character.id, { ...progressionData }); setIsProgressionEditing(false); }, [character.id, progressionData, updateCharacter]);
    const handleSaveStats = React.useCallback(() => { updateCharacter(character.id, { stats }); setIsStatsEditing(false); }, [character.id, stats, updateCharacter]);
    const handleSaveSaves = React.useCallback(() => { updateCharacter(character.id, { savingThrows: calculatedSavingThrows }); setIsSavesEditing(false); }, [character.id, calculatedSavingThrows, updateCharacter]);
    const handleSaveSkills = React.useCallback(() => { updateCharacter(character.id, { skills: calculatedSkills }); setIsSkillsEditing(false); }, [character.id, calculatedSkills, updateCharacter]);
    const handleSaveCombatStats = React.useCallback(() => { updateCharacter(character.id, { armorClass: combatStats.armorClass, speed: combatStats.speed }); setIsCombatStatsEditing(false); }, [character.id, combatStats.armorClass, combatStats.speed, updateCharacter]);
    const handleSaveHp = React.useCallback(() => { updateCharacter(character.id, { hitPoints: combatStats.hitPoints, temporaryHitPoints: combatStats.temporaryHitPoints }); setIsHpEditing(false); }, [character.id, combatStats.hitPoints, combatStats.temporaryHitPoints, updateCharacter]);
    const handleSaveAttacks = React.useCallback(() => { updateCharacter(character.id, { attacks }); setIsAttacksEditing(false); }, [character.id, attacks, updateCharacter]);
    const handleSaveAttunement = React.useCallback(() => { updateCharacter(character.id, { attunementItems }); setIsAttunementEditing(false); }, [character.id, attunementItems, updateCharacter]);
    const handleSaveItems = React.useCallback(() => { updateCharacter(character.id, { equipment }); setIsItemsEditing(false); }, [character.id, equipment, updateCharacter]);
    const handleSaveInventory = React.useCallback(() => { updateCharacter(character.id, { inventory: inventoryItems }); setIsInventoryEditing(false); }, [character.id, inventoryItems, updateCharacter]);
    const handleSaveMoney = React.useCallback(() => { updateCharacter(character.id, { currency }); setIsMoneyEditing(false); }, [character.id, currency, updateCharacter]);
    const handleSaveTraits = React.useCallback(() => { updateCharacter(character.id, { personalityTraits: narrativeData.personalityTraits }); setIsTraitEditing(false); }, [character.id, narrativeData.personalityTraits, updateCharacter]);
    const handleSaveIdeals = React.useCallback(() => { updateCharacter(character.id, { ideals: narrativeData.ideals }); setIsIdealEditing(false); }, [character.id, narrativeData.ideals, updateCharacter]);
    const handleSaveBonds = React.useCallback(() => { updateCharacter(character.id, { bonds: narrativeData.bonds }); setIsBondEditing(false); }, [character.id, narrativeData.bonds, updateCharacter]);
    const handleSaveFlaws = React.useCallback(() => { updateCharacter(character.id, { flaws: narrativeData.flaws }); setIsFlawEditing(false); }, [character.id, narrativeData.flaws, updateCharacter]);
    const handleSaveFeatures = React.useCallback(() => { updateCharacter(character.id, { featuresAndTraits: narrativeData.featuresAndTraits }); setIsFeaturesEditing(false); }, [character.id, narrativeData.featuresAndTraits, updateCharacter]);
    const handleSaveOtherProf = React.useCallback(() => { updateCharacter(character.id, { otherProficienciesAndLanguages: otherProficienciesAndLanguages }); setIsOtherProficienciesEditing(false); }, [character.id, otherProficienciesAndLanguages, updateCharacter]);
    const handleSaveResources = React.useCallback(() => {
      updateCharacter(character.id, { combatResources });
      setIsResourcesEditing(false);
    }, [character.id, combatResources, updateCharacter]);
    const handleSaveSpellcasting = React.useCallback(() => {
      updateCharacter(character.id, {
        spellcastingAbility: spellcastingData.spellcastingAbility as any,
        spellAttackBonus: spellcastingData.spellAttackBonus,
        spellSaveDifficulty: spellcastingData.spellSaveDifficulty,
      });
      setIsSpellcastingEditing(false);
    }, [character.id, spellcastingData, updateCharacter]);
    const handleSaveAll = React.useCallback(() => {
      if (isHeaderEditing) handleSaveHeader(); if (isProgressionEditing) handleSaveProgression(); if (isStatsEditing) handleSaveStats();
      if (isSavesEditing) handleSaveSaves(); if (isSkillsEditing) handleSaveSkills(); if (isCombatStatsEditing) handleSaveCombatStats();
      if (isHpEditing) handleSaveHp(); if (isAttacksEditing) handleSaveAttacks(); if (isAttunementEditing) handleSaveAttunement(); if (isItemsEditing) handleSaveItems();
      if (isInventoryEditing) handleSaveInventory(); if (isMoneyEditing) handleSaveMoney(); if (isTraitEditing) handleSaveTraits();
      if (isIdealEditing) handleSaveIdeals(); if (isBondEditing) handleSaveBonds(); if (isFlawEditing) handleSaveFlaws();
      if (isFeaturesEditing) handleSaveFeatures(); if (isOtherProficienciesEditing) handleSaveOtherProf();
      if (isResourcesEditing) handleSaveResources();
      if (isSpellcastingEditing) handleSaveSpellcasting();
    }, [isHeaderEditing, isProgressionEditing, isStatsEditing, isSavesEditing, isSkillsEditing, isCombatStatsEditing, isHpEditing, isAttacksEditing, isAttunementEditing, isItemsEditing, isInventoryEditing, isMoneyEditing, isTraitEditing, isIdealEditing, isBondEditing, isFlawEditing, isFeaturesEditing, isOtherProficienciesEditing, isResourcesEditing, handleSaveResources, isSpellcastingEditing, handleSaveSpellcasting, handleSaveHeader, handleSaveProgression, handleSaveStats, handleSaveSaves, handleSaveSkills, handleSaveCombatStats, handleSaveHp, handleSaveAttacks, handleSaveAttunement, handleSaveItems, handleSaveInventory, handleSaveMoney, handleSaveTraits, handleSaveIdeals, handleSaveBonds, handleSaveFlaws, handleSaveFeatures, handleSaveOtherProf]);

    React.useImperativeHandle(ref, () => ({ saveAll: handleSaveAll }));

    const handleAddCompanion = () => {
      const n = [...companions, {
        id: `comp-${Date.now()}`, name: 'New Companion', type: '', size: '', armorClass: 10,
        initiative: 0, speed: '30ft', proficiencyBonus: '0',
        stats: { strength: 10, dexterity: 10, constitution: 10, intelligence: 10, wisdom: 10, charisma: 10 },
        skills: [], hitPoints: { current: 10, max: 10 }, actions: [], features: []
      }];
      setCompanions(n); updateCharacter(character.id, { companions: n });
    };

    const handleHpMath = (op: 'sub' | 'rec') => {
      const d = parseInt(hpDelta) || 0; if (d === 0) return;
      const n = { ...combatStats.hitPoints, current: op === 'sub' ? Math.max(0, combatStats.hitPoints.current - d) : Math.min(combatStats.hitPoints.max, combatStats.hitPoints.current + d) };
      setCombatStats({ ...combatStats, hitPoints: n }); setHpDelta('');
      if (!isHpEditing) updateCharacter(character.id, { hitPoints: n });
    };

    const handleAttunedChange = (id: string, attuned: boolean) => {
      if (attuned) {
        const count = attunementItems.filter(i => i.attuned).length;
        if (count >= 3) {
          toast({ variant: 'destructive', title: 'Limit Reached', description: 'You can only attune up to 3 items.' });
          return;
        }
      }
      const next = attunementItems.map(i => i.id === id ? { ...i, attuned } : i);
      setAttunementItems(next);
      if (!isAttunementEditing) updateCharacter(character.id, { attunementItems: next });
    };
    
    // Combat Resources handlers
    const handleResourceCurrentChange = (id: string, delta: number) => {
      const next = combatResources.map(r =>
        r.id === id ? { ...r, current: Math.max(0, Math.min(r.max, r.current + delta)) } : r
      );
      setCombatResources(next);
      updateCharacter(character.id, { combatResources: next });
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
        const next = [...combatResources, {
          id: `res-${Date.now()}`,
          description: newResourceDesc.trim(),
          current: newResourceMax,
          max: newResourceMax,
          notes: ''
        }];
        setCombatResources(next);
        setNewResourceDesc('');
        setNewResourceMax(1);
      }
    };

    const removeResource = (id: string) => {
      setCombatResources(combatResources.filter(r => r.id !== id));
    };


    
    // Death Saves handlers
    const handleDeathSaveChange = (type: 'successes' | 'failures', value: number) => {
      const clamped = Math.max(0, Math.min(3, value));
      const next = { ...combatStats.deathSaves, [type]: clamped };
      setCombatStats({ ...combatStats, deathSaves: next });
      updateCharacter(character.id, { deathSaves: next });
    };

    const resetDeathSaves = () => {
      const next = { successes: 0, failures: 0 };
      setCombatStats({ ...combatStats, deathSaves: next });
      updateCharacter(character.id, { deathSaves: next });
    };

    // Exhaustion handler
    const handleExhaustionChange = (delta: number) => {
      const next = Math.max(0, Math.min(6, exhaustion + delta));
      setExhaustion(next);
      updateCharacter(character.id, { exhaustion: next });
    };

    // Hit Dice handlers
    const handleHitDiceUse = (className: string, delta: number) => {
      const entry = hitDiceEntries.find(e => e.className === className);
      if (!entry) return;
      const currentUsed = hitDiceUsed[className] || 0;
      const nextUsed = Math.max(0, Math.min(entry.level, currentUsed + delta));
      const next = { ...hitDiceUsed, [className]: nextUsed };
      setHitDiceUsed(next);
      updateCharacter(character.id, { hitDiceUsed: next });
    };

    const resetAllHitDice = () => {
      const next: Record<string, number> = {};
      hitDiceEntries.forEach(e => { next[e.className] = 0; });
      setHitDiceUsed(next);
      updateCharacter(character.id, { hitDiceUsed: next });
    };

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
                    <Button size="icon" variant="outline" className="h-5 w-5" onClick={() => { const n = { ...spellSlots, [level]: { ...slots, max: Math.max(0, slots.max - 1) } }; setSpellSlots(n); updateCharacter(character.id, { spellSlots: n }); }}><Minus className="h-2 w-2" /></Button>
                    <span className="text-xs font-black w-4 text-center">{slots.max}</span>
                    <Button size="icon" variant="outline" className="h-5 w-5" onClick={() => { const n = { ...spellSlots, [level]: { ...slots, max: slots.max + 1 } }; setSpellSlots(n); updateCharacter(character.id, { spellSlots: n }); }}><Plus className="h-2 w-2" /></Button>
                  </div>
                </div>
              )}
              {(showEditButtons || isEditing) && <EditSaveButton editing={isEditing} onEdit={() => setEditingLevel(level)} onSave={() => { updateCharacter(character.id, { spells, spellSlots }); setEditingLevel(null); }} />}
            </div>
            {level > 0 && slots.max > 0 && (
              <div className="flex flex-wrap gap-1 mt-1">
                {Array.from({ length: slots.max }).map((_, i) => (
                  <Checkbox key={i} checked={slots.current > i} onCheckedChange={() => { const nextCurrent = slots.current === i + 1 ? i : i + 1; const n = { ...spellSlots, [level]: { ...slots, current: nextCurrent } }; setSpellSlots(n); updateCharacter(character.id, { spellSlots: n }); }} className="h-3 w-3" />
                ))}
              </div>
            )}
          </CardHeader>
          <CardContent className="p-3 flex-1 space-y-4">
            <ul className="space-y-1">
              {levelSpells.map(spell => (
                <li key={spell.id} className="group relative flex items-center gap-1">
                  {!hideNotes && (
                    <Popover>
                      <PopoverTrigger asChild>
                        <Button variant={spell.notes ? 'secondary' : 'ghost'} size="icon" className="h-5 w-5 shrink-0"><Info className="h-3 w-3" /></Button>
                      </PopoverTrigger>
                      <PopoverContent className="w-64">
                        <Label className="text-xs mb-2 block">Notes for {spell.name}</Label>
                        <Textarea defaultValue={spell.notes || ''} onBlur={(e) => setSpells(spells.map(s => s.id === spell.id ? { ...s, notes: e.target.value } : s))} placeholder="Add notes..." className="mt-2 min-h-[100px] text-sm" />
                      </PopoverContent>
                    </Popover>
                  )}
                  {isEditing ? (
                    <div className="flex gap-1 items-start bg-muted/30 p-1 rounded flex-1">
                      <Input value={spell.name} onChange={e => setSpells(spells.map(s => s.id === spell.id ? { ...s, name: e.target.value } : s))} className="h-7 text-xs flex-1" />
                      <Button variant="ghost" size="icon" className="h-7 w-7 text-destructive" onClick={() => setSpells(spells.filter(s => s.id !== spell.id))}><Trash2 className="h-3 w-3" /></Button>
                    </div>
                  ) : (
                    <div className="text-xs font-medium py-1 border-b border-muted/50 last:border-0 hover:bg-muted/20 transition-colors cursor-default flex-1">&bull; {spell.name}</div>
                  )}
                </li>
              ))}
            </ul>
            {isEditing && (
              <div className="pt-2 border-t space-y-2">
                <Input placeholder="Spell Name" value={newSpellName} onChange={e => setNewSpellName(e.target.value)} className="h-7 text-xs" />
                <Button size="sm" className="w-full h-7 text-[10px]" onClick={() => { if (newSpellName.trim()) { setSpells([...spells, { id: `spell-${Date.now()}`, name: newSpellName, level, notes: '' }]); setNewSpellName(''); } }}>
                  <Plus className="mr-1 h-3 w-3" /> {t('add')}
                </Button>
              </div>
            )}
          </CardContent>
        </Card>
      );
    };
    return (
      <div className="space-y-8 pb-12">
        {/* Compact View Sticky Stats Bar */}
        <div className={cn("bg-background/95 backdrop-blur-md -mt-4 md:-mt-6 -mx-4 px-4 py-3 border-b shadow-sm sticky top-0 z-30 space-y-3", !isCompactView && "hidden")}>
          <div className="grid grid-cols-6 gap-1">
            {['strength', 'dexterity', 'constitution', 'intelligence', 'wisdom', 'charisma'].map(key => {
              const val = stats[key as keyof typeof stats]; const mod = Math.floor((val - 10) / 2);
              return (
                <div key={key} className="flex flex-col items-center justify-center bg-card border rounded py-1 min-w-0">
                  <span className="text-[8px] font-bold text-muted-foreground uppercase truncate w-full text-center px-0.5">{key.slice(0, 3)}</span>
                  <span className="text-xs font-black">{mod >= 0 ? `+${mod}` : mod}</span>
                  <span className="text-[8px] text-muted-foreground/60">{val}</span>
                </div>
              );
            })}
          </div>
          <div className="grid grid-cols-2 gap-2">
            <div className="flex items-center justify-between px-2 py-1.5 bg-card border rounded min-w-0"><span className="text-[8px] font-bold uppercase text-muted-foreground truncate mr-1">{t('passivePerception')}</span><span className="text-xs font-black shrink-0">{passivePerception}</span></div>
            <div className="flex items-center justify-between px-2 py-1.5 bg-card border rounded min-w-0"><span className="text-[8px] font-bold uppercase text-muted-foreground truncate mr-1">{t('proficiencyBonus')}</span><span className="text-xs font-black shrink-0">+{proficiencyBonus}</span></div>
          </div>
        </div>

        {/* Progression & Character Info */}
        <div className={cn("flex flex-col md:flex-row gap-6 items-stretch", isCompactView && activeCompactSection !== 'info-section' && "hidden")}>
          <Accordion type="single" collapsible defaultValue="expanded" className="w-full md:max-w-xl">
            <AccordionItem value="expanded" className="border-0">
              <Card className="flex flex-col border-2 overflow-hidden shrink-0 h-full">
                <CardHeader className="px-4 pt-2 pb-2 flex flex-row items-center justify-between bg-muted/5">
                  <AccordionTrigger className="flex flex-1 items-center justify-between hover:no-underline py-0"><Label className="text-[10px] font-bold uppercase text-muted-foreground tracking-tight">{t('progression')}</Label></AccordionTrigger>
                  {(showEditButtons || isProgressionEditing) && <EditSaveButton editing={isProgressionEditing} onEdit={() => setIsProgressionEditing(true)} onSave={handleSaveProgression} />}
                </CardHeader>
                <AccordionContent>
                  <CardContent className="p-4 space-y-4">
                    <div className="grid grid-cols-2 gap-4">
                      <div className="flex flex-col gap-1">
                        <Label className="text-[10px] text-muted-foreground uppercase font-bold">{t('class')}</Label>
                        {isProgressionEditing ? (
                          <Select value={progressionData.characterClass} onValueChange={v => setProgressionData({ ...progressionData, characterClass: v })}>
                            <SelectTrigger className="h-8 text-xs"><SelectValue /></SelectTrigger>
                            <SelectContent>{DND_CLASSES.map(c => (<SelectItem key={c} value={c} disabled={progressionData.multiclasses.some(m => m.class === c)}>{c}</SelectItem>))}</SelectContent>
                          </Select>
                        ) : (<span className="text-base font-bold truncate">{progressionData.characterClass}</span>)}
                      </div>
                      <div className="flex flex-col gap-1"><Label className="text-[10px] text-muted-foreground uppercase font-bold">Total Lvl</Label><span className="text-base font-bold truncate">{progressionData.level}</span></div>
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
                                  <Input type="number" value={mc.level} onChange={e => { const n = [...progressionData.multiclasses]; n[idx].level = parseInt(e.target.value) || 1; setProgressionData({ ...progressionData, multiclasses: n }); }} className="h-8 w-12 text-center" />
                                  <Button variant="ghost" size="icon" className="h-8 w-8 text-destructive" onClick={() => setProgressionData({ ...progressionData, multiclasses: progressionData.multiclasses.filter((_, i) => i !== idx) })}><Trash2 className="h-4 w-4" /></Button>
                                </>
                              ) : (<span className="text-xs font-semibold">{mc.class} (Lvl {mc.level})</span>)}
                            </div>
                          ))}
                          {isProgressionEditing && (
                            <Button variant="outline" size="sm" className="w-full h-7 text-[10px]" onClick={() => { const used = [progressionData.characterClass, ...progressionData.multiclasses.map(m => m.class)]; const avail = DND_CLASSES.filter(c => !used.includes(c)); if (avail.length > 0) setProgressionData({ ...progressionData, multiclasses: [...progressionData.multiclasses, { class: avail[0], level: 1 }] }); }}>
                              <Plus className="h-3 w-3 mr-1" /> Add Class
                            </Button>
                          )}
                        </div>
                      )}
                    </div>
                    <div className="pt-2 border-t space-y-4">
                      <DetailField label={t('experiencePoints')} value={progressionData.experiencePoints} editing={isProgressionEditing} onChange={v => { const n = parseInt(v) || 0; setProgressionData({ ...progressionData, experiencePoints: n, level: calculateLevelFromExp(n) }); }} />
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
          <Accordion type="single" collapsible defaultValue="expanded" className="flex-1">
            <AccordionItem value="expanded" className="border-0">
              <Card className="flex flex-col border-2 overflow-hidden h-full">
                <CardHeader className="px-4 pt-2 pb-2 bg-muted/5 flex flex-row items-center justify-between">
                  <AccordionTrigger className="flex flex-1 items-center justify-between hover:no-underline py-0"><Label className="text-[10px] font-bold uppercase text-muted-foreground tracking-tight">{t('characterInfo')}</Label></AccordionTrigger>
                  {(showEditButtons || isHeaderEditing) && <EditSaveButton editing={isHeaderEditing} onEdit={() => setIsHeaderEditing(true)} onSave={handleSaveHeader} />}
                </CardHeader>
                <AccordionContent>
                  <CardContent className="p-4 grid grid-cols-2 md:grid-cols-3 gap-4">
                    <DetailField label={t('race')} value={headerData.race} editing={isHeaderEditing} onChange={v => setHeaderData({ ...headerData, race: v })} />
                    <DetailField label={t('background')} value={headerData.background} editing={isHeaderEditing} onChange={v => setHeaderData({ ...headerData, background: v })} />
                    <DetailField label={t('alignment')} value={headerData.alignment} editing={isHeaderEditing} onChange={v => setHeaderData({ ...headerData, alignment: v })} />
                    <DetailField label={t('age')} value={headerData.age} editing={isHeaderEditing} onChange={v => setHeaderData({ ...headerData, age: v })} />
                    <DetailField label={t('eyes')} value={headerData.eyes} editing={isHeaderEditing} onChange={v => setHeaderData({ ...headerData, eyes: v })} />
                    <DetailField label={t('skin')} value={headerData.skin} editing={isHeaderEditing} onChange={v => setHeaderData({ ...headerData, skin: v })} />
                    <DetailField label={t('height')} value={headerData.height} editing={isHeaderEditing} onChange={v => setHeaderData({ ...headerData, height: v })} />
                    <DetailField label={t('weight')} value={headerData.weight} editing={isHeaderEditing} onChange={v => setHeaderData({ ...headerData, weight: v })} />
                    <DetailField label={t('hairFur')} value={headerData.hair} editing={isHeaderEditing} onChange={v => setHeaderData({ ...headerData, hair: v })} />
                    <div className="col-span-2 md:col-span-3 mt-2 border-t pt-4">
                      <Accordion type="multiple" className="w-full">
                        <AccordionItem value="backstory" className="border-b-0">
                          <AccordionTrigger className="py-2 hover:no-underline font-semibold">{t('backstory')}</AccordionTrigger>
                          <AccordionContent className="pt-2">
                            {isHeaderEditing ? (
                              <Textarea value={headerData.backstory} onChange={e => setHeaderData({...headerData, backstory: e.target.value})} placeholder="Your character's backstory..." className="min-h-[150px] text-sm" />
                            ) : (
                              <p className="whitespace-pre-wrap text-sm text-muted-foreground">{headerData.backstory || '-'}</p>
                            )}
                          </AccordionContent>
                        </AccordionItem>
                        <AccordionItem value="notes" className="border-b-0">
                          <AccordionTrigger className="py-2 hover:no-underline font-semibold">{t('notes')}</AccordionTrigger>
                          <AccordionContent className="pt-2">
                            {isHeaderEditing ? (
                              <Textarea value={headerData.notes} onChange={e => setHeaderData({...headerData, notes: e.target.value})} placeholder="General notes about this character..." className="min-h-[100px] text-sm" />
                            ) : (
                              <p className="whitespace-pre-wrap text-sm text-muted-foreground">{headerData.notes || '-'}</p>
                            )}
                          </AccordionContent>
                        </AccordionItem>
                      </Accordion>
                    </div>
                  </CardContent>
                </AccordionContent>
              </Card>
            </AccordionItem>
          </Accordion>
        </div>

        {/* Stats, Saves, Skills, Combat */}
        <div className={cn("grid grid-cols-1 md:grid-cols-12 gap-6 items-start", isCompactView && activeCompactSection !== 'stats-section' && "hidden")}>
          <div className="md:col-span-2 space-y-4">
            <Card>
              <CardHeader className="flex flex-row items-center justify-between px-4 pt-2 pb-2"><CardTitle className="text-[10px] font-bold uppercase text-muted-foreground tracking-tight">{t('characteristics')}</CardTitle>{(showEditButtons || isStatsEditing) && <EditSaveButton editing={isStatsEditing} onEdit={() => setIsStatsEditing(true)} onSave={handleSaveStats} />}</CardHeader>
              <CardContent className="space-y-3 p-4 pt-0">
                {['strength', 'dexterity', 'constitution', 'intelligence', 'wisdom', 'charisma'].map(key => (
                  <StatBox key={key} label={key} value={stats[key as keyof typeof stats]} editing={isStatsEditing} onChange={e => setStats({ ...stats, [key]: parseInt(e.target.value) || 1 })} isCompactView={isCompactView} notes={character.statNotes?.[key as keyof typeof stats]} onNoteChange={v => updateCharacter(character.id, { statNotes: { ...(character.statNotes || {}), [key]: v } })} hideNotes={hideNotes} />
                ))}
              </CardContent>
            </Card>
            <Card>
              <CardHeader className="flex flex-row items-center justify-between px-4 pt-2 pb-2"><CardTitle className="text-[10px] font-bold uppercase text-muted-foreground tracking-tight">{t('otherProficienciesAndLanguages')}</CardTitle>{(showEditButtons || isOtherProficienciesEditing) && <EditSaveButton editing={isOtherProficienciesEditing} onEdit={() => setIsOtherProficienciesEditing(true)} onSave={handleSaveOtherProf} />}</CardHeader>
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

          <div className="md:col-span-3 space-y-4">
            <Card id="saving-throws-card">
              <CardHeader className="flex flex-row items-center justify-between px-4 pt-2 pb-2"><CardTitle className="text-[10px] font-bold uppercase text-muted-foreground tracking-tight">{t('savingThrows')}</CardTitle>{(showEditButtons || isSavesEditing) && <EditSaveButton editing={isSavesEditing} onEdit={() => setIsSavesEditing(true)} onSave={handleSaveSaves} />}</CardHeader>
              <CardContent className="p-4 pt-0 space-y-1">
                {calculatedSavingThrows.map((st, i) => (
                  <div key={st.name} className="flex items-center gap-2 py-1 border-b last:border-0 border-muted">
                    <Checkbox checked={st.proficient} disabled={!isSavesEditing} onCheckedChange={v => setSavingThrows(savingThrows.map((s, idx) => idx === i ? { ...s, proficient: !!v } : s))} />
                    <span className="font-bold text-sm w-8">{st.value >= 0 ? '+' : ''}{st.value}</span>
                    <span className="text-[10px] font-bold uppercase flex-1">{st.name}</span>
                  </div>
                ))}
              </CardContent>
            </Card>
            <Card id="skills-card">
              <CardHeader className="flex flex-row items-center justify-between px-4 pt-2 pb-2"><CardTitle className="text-[10px] font-bold uppercase text-muted-foreground tracking-tight">{t('skills')}</CardTitle>{(showEditButtons || isSkillsEditing) && <EditSaveButton editing={isSkillsEditing} onEdit={() => setIsSkillsEditing(true)} onSave={handleSaveSkills} />}</CardHeader>
              <CardContent className="p-4 pt-0 space-y-1">
                {calculatedSkills.map((sk, i) => (
                  <div key={sk.name} className="flex items-center gap-2 py-1 border-b last:border-0 border-muted">
                    <Checkbox checked={sk.proficient} disabled={!isSkillsEditing} onCheckedChange={v => setSkills(skills.map((s, idx) => idx === i ? { ...s, proficient: !!v } : s))} />
                    <div className="w-8 text-center">
                      {isSkillsEditing ? (
                        <Input type="number" value={sk.value} onChange={e => { const n = [...skills]; n[i] = { ...sk, value: parseInt(e.target.value) || 0 }; setSkills(n); }} className="h-6 w-8 text-[10px] p-0 text-center font-bold" />
                      ) : (<span className="font-black text-sm">{sk.value >= 0 ? '+' : ''}{sk.value}</span>)}
                    </div>
                    <span className="text-xs font-semibold flex-1">{sk.label}</span>
                  </div>
                ))}
              </CardContent>
            </Card>
          </div>

          <div className="md:col-span-4 space-y-6">
            <Card id="combat-stats-card">
              <CardHeader className="flex flex-row items-center justify-between px-4 pt-2 pb-2"><CardTitle className="text-[10px] font-bold uppercase text-muted-foreground tracking-tight">{t('combatStats')}</CardTitle>{(showEditButtons || isCombatStatsEditing) && <EditSaveButton editing={isCombatStatsEditing} onEdit={() => setIsCombatStatsEditing(true)} onSave={handleSaveCombatStats} />}</CardHeader>
              <CardContent className="grid grid-cols-3 gap-4 p-4 pt-0 text-center">
                <div className="p-2 rounded-lg bg-background border"><Label className="text-[10px] text-muted-foreground uppercase font-bold">{t('armorClass')}</Label>{isCombatStatsEditing ? (<Input type="number" value={combatStats.armorClass} onChange={e => setCombatStats({ ...combatStats, armorClass: parseInt(e.target.value) || 10 })} className="h-9 w-full text-center" />) : (<div className="text-sm font-bold">{combatStats.armorClass}</div>)}</div>
                <div className="p-2 rounded-lg bg-background border"><Label className="text-[10px] text-muted-foreground uppercase font-bold">{t('initiative')}</Label><div className="text-sm font-bold">+{dexMod}</div></div>
                <div className="p-2 rounded-lg bg-background border"><Label className="text-[10px] text-muted-foreground uppercase font-bold">{t('speed')}</Label>{isCombatStatsEditing ? <Input type="number" value={combatStats.speed} onChange={e => setCombatStats({ ...combatStats, speed: parseInt(e.target.value) || 0 })} className="h-9 w-full text-center" /> : <div className="text-sm font-bold">{combatStats.speed}ft</div>}</div>
              </CardContent>
            </Card>

            <Card id="hit-points-card">
              <CardHeader className="flex flex-row items-center justify-between px-4 pt-2 pb-2"><CardTitle className="text-[10px] font-bold uppercase text-muted-foreground tracking-tight">Health</CardTitle>{(showEditButtons || isHpEditing) && <EditSaveButton editing={isHpEditing} onEdit={() => setIsHpEditing(true)} onSave={handleSaveHp} />}</CardHeader>
              <CardContent className="p-4 pt-0 space-y-4">
                <div className="grid grid-cols-2 gap-4">
                  <div className="space-y-4">
                    <div className="p-2 border rounded text-center"><Label className="text-[10px] uppercase font-bold">Max</Label>{isHpEditing ? (<Input type="number" value={combatStats.hitPoints.max} onChange={e => setCombatStats({ ...combatStats, hitPoints: { ...combatStats.hitPoints, max: parseInt(e.target.value) || 0 } })} className="h-8 text-center" />) : (<div className="text-base font-bold">{combatStats.hitPoints.max}</div>)}</div>
                    <div className="p-2 border rounded text-center"><Label className="text-[10px] uppercase font-bold">Current</Label>{isHpEditing ? (<Input type="number" value={combatStats.hitPoints.current} onChange={e => setCombatStats({ ...combatStats, hitPoints: { ...combatStats.hitPoints, current: parseInt(e.target.value) || 0 } })} className="h-8 text-center" />) : (<div className="text-base font-bold text-primary">{combatStats.hitPoints.current}</div>)}</div>
                  </div>
                  <div className="space-y-4">
                    <div className="p-2 border rounded text-center"><Label className="text-[10px] uppercase font-bold">Temp</Label>{isHpEditing ? (<Input type="number" value={combatStats.temporaryHitPoints} onChange={e => setCombatStats({ ...combatStats, temporaryHitPoints: parseInt(e.target.value) || 0 })} className="h-8 text-center" />) : (<div className="text-base font-bold">{combatStats.temporaryHitPoints || 0}</div>)}</div>
                    <div className="flex flex-col gap-2">
                      <Input type="number" placeholder="+/-" value={hpDelta} onChange={e => setHpDelta(e.target.value)} className="h-8 text-center" />
                      <div className="grid grid-cols-2 gap-2">
                        <Button size="sm" variant="outline" onClick={() => handleHpMath('sub')}>Sub</Button>
                        <Button size="sm" variant="outline" onClick={() => handleHpMath('rec')}>Heal</Button>
                      </div>
                    </div>
                  </div>
                </div>
              </CardContent>
            </Card>

            {/* DEATH SAVES & EXHAUSTION COMBINED CARD */}
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
                        {[0, 1, 2].map(i => (
                          <div key={i} className={cn("w-4 h-4 rounded-full border-2", i < combatStats.deathSaves.successes ? "bg-green-500 border-green-500" : "border-muted-foreground/30")} />
                        ))}
                      </div>
                      <Button size="icon" variant="outline" className="h-6 w-6" onClick={() => handleDeathSaveChange('successes', combatStats.deathSaves.successes + 1)}><Plus className="h-3 w-3" /></Button>
                    </div>
                  </div>
                  <div className="space-y-2">
                    <Label className="text-[10px] uppercase font-bold text-red-600">{t('failures')}</Label>
                    <div className="flex items-center gap-2">
                      <Button size="icon" variant="outline" className="h-6 w-6" onClick={() => handleDeathSaveChange('failures', combatStats.deathSaves.failures - 1)}><Minus className="h-3 w-3" /></Button>
                      <div className="flex gap-1">
                        {[0, 1, 2].map(i => (
                          <div key={i} className={cn("w-4 h-4 rounded-full border-2", i < combatStats.deathSaves.failures ? "bg-red-500 border-red-500" : "border-muted-foreground/30")} />
                        ))}
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

            {/* HIT DICE CARD (Multiclass-aware) */}
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
            {/* COMBAT RESOURCES CARD */}
            <Card id="combat-resources-card">
              <CardHeader className="flex flex-row items-center justify-between px-4 pt-2 pb-2">
                <CardTitle className="text-[10px] font-bold uppercase text-muted-foreground tracking-tight">{t('combatResources')}</CardTitle>
                {(showEditButtons || isResourcesEditing) && <EditSaveButton editing={isResourcesEditing} onEdit={() => setIsResourcesEditing(true)} onSave={handleSaveResources} />}
              </CardHeader>
              <CardContent className="p-4 pt-0 space-y-2">
                {combatResources.length === 0 && !isResourcesEditing && (
                  <p className="text-xs text-muted-foreground italic text-center py-2 border border-dashed rounded-lg">
                    {t('noResources')}
                  </p>
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
                              <PopoverTrigger asChild>
                                <Button variant={res.notes ? 'secondary' : 'ghost'} size="icon" className="h-6 w-6 shrink-0"><Info className="h-3 w-3" /></Button>
                              </PopoverTrigger>
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
                            <PopoverTrigger asChild>
                              <Button variant={res.notes ? 'secondary' : 'ghost'} size="icon" className="h-5 w-5 shrink-0"><Info className="h-3 w-3" /></Button>
                            </PopoverTrigger>
                            <PopoverContent className="w-64">
                              <Label className="text-xs mb-2 block">Notes for {res.description}</Label>
                              <Textarea defaultValue={res.notes || ''} onBlur={e => { const next = combatResources.map(r => r.id === res.id ? { ...r, notes: e.target.value } : r); setCombatResources(next); updateCharacter(character.id, { combatResources: next }); }} placeholder="Add notes..." className="mt-2 min-h-[100px] text-sm" />
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
                      {isResourcesEditing && (
                        <Button variant="ghost" size="icon" className="h-6 w-6 text-destructive" onClick={() => removeResource(res.id)}><Trash2 className="h-3 w-3" /></Button>
                      )}
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

          <div className="md:col-span-3 space-y-6">
            <Card><CardHeader className="flex flex-row items-center justify-between px-4 pt-2 pb-2"><CardTitle className="text-[10px] font-bold uppercase text-muted-foreground">{t('personalityTraits')}</CardTitle>{(showEditButtons || isTraitEditing) && <EditSaveButton editing={isTraitEditing} onEdit={() => setIsTraitEditing(true)} onSave={handleSaveTraits} />}</CardHeader>
              <CardContent className="p-4 pt-0 space-y-2">
                {narrativeData.personalityTraits.map((it, i) => (
                  <div key={i} className="text-[10px] p-1.5 rounded bg-muted/10 flex justify-between">
                    {isTraitEditing ? (<Input value={it} onChange={e => { const n = [...narrativeData.personalityTraits]; n[i] = e.target.value; setNarrativeData({ ...narrativeData, personalityTraits: n }); }} className="h-6 text-[10px] flex-1 mr-2" />) : (<span className="break-words font-medium">&bull; {it}</span>)}
                    {isTraitEditing && (<Button variant="ghost" size="icon" className="h-5 w-5 text-destructive" onClick={() => setNarrativeData({ ...narrativeData, personalityTraits: narrativeData.personalityTraits.filter((_, idx) => idx !== i) })}><Trash2 className="h-3 w-3" /></Button>)}
                  </div>
                ))}
                {isTraitEditing && (<div className="flex gap-2 pt-2 border-t"><Input placeholder="New..." value={newTraitItem} onChange={e => setNewTraitItem(e.target.value)} className="h-7 text-[10px]" /><Button size="sm" className="h-7" onClick={() => { if (newTraitItem.trim()) { setNarrativeData({ ...narrativeData, personalityTraits: [...narrativeData.personalityTraits, newTraitItem.trim()] }); setNewTraitItem(''); } }}><Plus className="h-3 w-3" /></Button></div>)}
              </CardContent>
            </Card>
            <Card><CardHeader className="flex flex-row items-center justify-between px-4 pt-2 pb-2"><CardTitle className="text-[10px] font-bold uppercase text-muted-foreground">{t('ideals')}</CardTitle>{(showEditButtons || isIdealEditing) && <EditSaveButton editing={isIdealEditing} onEdit={() => setIsIdealEditing(true)} onSave={handleSaveIdeals} />}</CardHeader>
              <CardContent className="p-4 pt-0 space-y-2">
                {narrativeData.ideals.map((it, i) => (
                  <div key={i} className="text-[10px] p-1.5 rounded bg-muted/10 flex justify-between">
                    {isIdealEditing ? (<Input value={it} onChange={e => { const n = [...narrativeData.ideals]; n[i] = e.target.value; setNarrativeData({ ...narrativeData, ideals: n }); }} className="h-6 text-[10px] flex-1 mr-2" />) : (<span className="break-words font-medium">&bull; {it}</span>)}
                    {isIdealEditing && (<Button variant="ghost" size="icon" className="h-5 w-5 text-destructive" onClick={() => setNarrativeData({ ...narrativeData, ideals: narrativeData.ideals.filter((_, idx) => idx !== i) })}><Trash2 className="h-3 w-3" /></Button>)}
                  </div>
                ))}
                {isIdealEditing && (<div className="flex gap-2 pt-2 border-t"><Input placeholder="New..." value={newIdealItem} onChange={e => setNewIdealItem(e.target.value)} className="h-7 text-[10px]" /><Button size="sm" className="h-7" onClick={() => { if (newIdealItem.trim()) { setNarrativeData({ ...narrativeData, ideals: [...narrativeData.ideals, newIdealItem.trim()] }); setNewIdealItem(''); } }}><Plus className="h-3 w-3" /></Button></div>)}
              </CardContent>
            </Card>
            <Card><CardHeader className="flex flex-row items-center justify-between px-4 pt-2 pb-2"><CardTitle className="text-[10px] font-bold uppercase text-muted-foreground">{t('bonds')}</CardTitle>{(showEditButtons || isBondEditing) && <EditSaveButton editing={isBondEditing} onEdit={() => setIsBondEditing(true)} onSave={handleSaveBonds} />}</CardHeader>
              <CardContent className="p-4 pt-0 space-y-2">
                {narrativeData.bonds.map((it, i) => (
                  <div key={i} className="text-[10px] p-1.5 rounded bg-muted/10 flex justify-between">
                    {isBondEditing ? (<Input value={it} onChange={e => { const n = [...narrativeData.bonds]; n[i] = e.target.value; setNarrativeData({ ...narrativeData, bonds: n }); }} className="h-6 text-[10px] flex-1 mr-2" />) : (<span className="break-words font-medium">&bull; {it}</span>)}
                    {isBondEditing && (<Button variant="ghost" size="icon" className="h-5 w-5 text-destructive" onClick={() => setNarrativeData({ ...narrativeData, bonds: narrativeData.bonds.filter((_, idx) => idx !== i) })}><Trash2 className="h-3 w-3" /></Button>)}
                  </div>
                ))}
                {isBondEditing && (<div className="flex gap-2 pt-2 border-t"><Input placeholder="New..." value={newBondItem} onChange={e => setNewBondItem(e.target.value)} className="h-7 text-[10px]" /><Button size="sm" className="h-7" onClick={() => { if (newBondItem.trim()) { setNarrativeData({ ...narrativeData, bonds: [...narrativeData.bonds, newBondItem.trim()] }); setNewBondItem(''); } }}><Plus className="h-3 w-3" /></Button></div>)}
              </CardContent>
            </Card>
            <Card><CardHeader className="flex flex-row items-center justify-between px-4 pt-2 pb-2"><CardTitle className="text-[10px] font-bold uppercase text-muted-foreground">{t('flaws')}</CardTitle>{(showEditButtons || isFlawEditing) && <EditSaveButton editing={isFlawEditing} onEdit={() => setIsFlawEditing(true)} onSave={handleSaveFlaws} />}</CardHeader>
              <CardContent className="p-4 pt-0 space-y-2">
                {narrativeData.flaws.map((it, i) => (
                  <div key={i} className="text-[10px] p-1.5 rounded bg-muted/10 flex justify-between">
                    {isFlawEditing ? (<Input value={it} onChange={e => { const n = [...narrativeData.flaws]; n[i] = e.target.value; setNarrativeData({ ...narrativeData, flaws: n }); }} className="h-6 text-[10px] flex-1 mr-2" />) : (<span className="break-words font-medium">&bull; {it}</span>)}
                    {isFlawEditing && (<Button variant="ghost" size="icon" className="h-5 w-5 text-destructive" onClick={() => setNarrativeData({ ...narrativeData, flaws: narrativeData.flaws.filter((_, idx) => idx !== i) })}><Trash2 className="h-3 w-3" /></Button>)}
                  </div>
                ))}
                {isFlawEditing && (<div className="flex gap-2 pt-2 border-t"><Input placeholder="New..." value={newFlawItem} onChange={e => setNewFlawItem(e.target.value)} className="h-7 text-[10px]" /><Button size="sm" className="h-7" onClick={() => { if (newFlawItem.trim()) { setNarrativeData({ ...narrativeData, flaws: [...narrativeData.flaws, newFlawItem.trim()] }); setNewFlawItem(''); } }}><Plus className="h-3 w-3" /></Button></div>)}
              </CardContent>
            </Card>
            <Card><CardHeader className="flex flex-row items-center justify-between px-4 pt-2 pb-2"><CardTitle className="text-[10px] font-bold uppercase text-muted-foreground">{t('featuresAndTraits')}</CardTitle>{(showEditButtons || isFeaturesEditing) && <EditSaveButton editing={isFeaturesEditing} onEdit={() => setIsFeaturesEditing(true)} onSave={handleSaveFeatures} />}</CardHeader>
              <CardContent className="p-4 pt-0 space-y-2">
                {narrativeData.featuresAndTraits.map((it, i) => (
                  <div key={i} className="text-[10px] p-1.5 rounded bg-muted/10 flex justify-between">
                    {isFeaturesEditing ? (<Input value={it} onChange={e => { const n = [...narrativeData.featuresAndTraits]; n[i] = e.target.value; setNarrativeData({ ...narrativeData, featuresAndTraits: n }); }} className="h-6 text-[10px] flex-1 mr-2" />) : (<span className="break-words font-medium">&bull; {it}</span>)}
                    {isFeaturesEditing && (<Button variant="ghost" size="icon" className="h-5 w-5 text-destructive" onClick={() => setNarrativeData({ ...narrativeData, featuresAndTraits: narrativeData.featuresAndTraits.filter((_, idx) => idx !== i) })}><Trash2 className="h-3 w-3" /></Button>)}
                  </div>
                ))}
                {isFeaturesEditing && (<div className="flex gap-2 pt-2 border-t"><Input placeholder="New..." value={newFeatureItem} onChange={e => setNewFeatureItem(e.target.value)} className="h-7 text-[10px]" /><Button size="sm" className="h-7" onClick={() => { if (newFeatureItem.trim()) { setNarrativeData({ ...narrativeData, featuresAndTraits: [...narrativeData.featuresAndTraits, newFeatureItem.trim()] }); setNewFeatureItem(''); } }}><Plus className="h-3 w-3" /></Button></div>)}
              </CardContent>
            </Card>
            <Card id="attunement-card">
              <CardHeader className="flex flex-row items-center justify-between px-4 pt-2 pb-2"><CardTitle className="text-[10px] font-bold uppercase text-muted-foreground tracking-tight">{t('attunement')}</CardTitle>{(showEditButtons || isAttunementEditing) && <EditSaveButton editing={isAttunementEditing} onEdit={() => setIsAttunementEditing(true)} onSave={handleSaveAttunement} />}</CardHeader>
              <CardContent className="p-4 pt-0 space-y-2">
                {attunementItems.map((it, i) => (
                  <div key={it.id} className="text-[10px] p-1.5 rounded bg-muted/10 flex items-center justify-between group">
                    <div className="flex items-center gap-2 flex-1">
                      <Checkbox checked={it.attuned} onCheckedChange={v => handleAttunedChange(it.id, !!v)} />
                      {isAttunementEditing ? (
                        <Input value={it.description} onChange={e => setAttunementItems(attunementItems.map(item => item.id === it.id ? { ...item, description: e.target.value } : item))} className="h-6 text-[10px] flex-1" />
                      ) : (
                        <span className={cn("font-medium", !it.attuned && "opacity-50")}>{it.description} {it.attuned && <span className="text-[8px] font-black uppercase text-primary ml-1">(Attuned)</span>}</span>
                      )}
                      {isAttunementEditing && (<Button variant="ghost" size="icon" className="h-5 w-5 text-destructive ml-2" onClick={() => setAttunementItems(attunementItems.filter(item => item.id !== it.id))}><Trash2 className="h-3 w-3" /></Button>)}
                    </div>
                  </div>
                ))}
                {isAttunementEditing && (<div className="flex gap-2 pt-2 border-t"><Input placeholder="New..." value={newAttunementItem} onChange={e => setNewAttunementItem(e.target.value)} className="h-7 text-[10px]" /><Button size="sm" className="h-7" onClick={() => { if (newAttunementItem.trim()) { setAttunementItems([...attunementItems, { id: `att-${Date.now()}`, description: newAttunementItem.trim(), attuned: false }]); setNewAttunementItem(''); } }}><Plus className="h-3 w-3" /></Button></div>)}
              </CardContent>
            </Card>
            <Card id="inventory-box">
              <CardHeader className="px-4 pt-2 pb-2"><CardTitle className="text-[10px] font-bold uppercase text-muted-foreground tracking-tight">{t('inventory')}</CardTitle></CardHeader>
              <CardContent className="p-4 pt-0 space-y-6">
                <div className="border rounded-lg p-3 bg-muted/30">
                  <div className="flex items-center justify-between mb-3 border-b pb-1"><Label className="text-[10px] uppercase font-bold">{t('money')}</Label>{(showEditButtons || isMoneyEditing) && <EditSaveButton editing={isMoneyEditing} onEdit={() => setIsMoneyEditing(true)} onSave={handleSaveMoney} />}</div>
                  <div className="grid grid-cols-5 gap-2">
                    {['cp', 'sp', 'ep', 'gp', 'pp'].map(c => (
                      <div key={c} className="flex flex-col items-center">
                        <span className="text-[8px] font-bold uppercase">{c}</span>
                        {isMoneyEditing ? (<Input type="number" value={currency[c as keyof typeof currency]} onChange={e => setCurrency({ ...currency, [c]: parseInt(e.target.value) || 0 })} className="h-6 p-0 text-center text-[10px]" />) : (<div className="text-sm font-bold">{currency[c as keyof typeof currency]}</div>)}
                      </div>
                    ))}
                  </div>
                </div>
                <div className="space-y-2">
                  <div className="flex items-center justify-between"><Label className="text-[10px] uppercase font-bold">{t('items')}</Label>{(showEditButtons || isItemsEditing) && <EditSaveButton editing={isItemsEditing} onEdit={() => setIsItemsEditing(true)} onSave={handleSaveItems} />}</div>
                  <ul className="space-y-1 text-xs">
                    {equipment.map(it => (
                      <li key={it.id} className="flex items-center justify-between group">
                        {isItemsEditing ? (
                          <div className="flex items-center gap-2 flex-1">
                            <Checkbox checked={it.status === 'lost'} onCheckedChange={v => setEquipment(equipment.map(i => i.id === it.id ? { ...i, status: v ? 'lost' : 'default' } : i))} />
                            <Input value={it.name} onChange={e => setEquipment(equipment.map(i => i.id === it.id ? { ...i, name: e.target.value } : i))} className="h-7 text-xs flex-1" />
                            <Button variant="ghost" size="icon" className="h-6 w-6 text-destructive" onClick={() => setEquipment(equipment.filter(i => i.id !== it.id))}><Trash2 className="h-3 w-3" /></Button>
                          </div>
                        ) : (<span className={cn(it.status === 'lost' && "line-through")}>&bull; {it.name}</span>)}
                      </li>
                    ))}
                    {isItemsEditing && (<div className="flex gap-2 pt-2 border-t"><Input placeholder="New..." value={newEquipmentItem} onChange={e => setNewEquipmentItem(e.target.value)} className="h-8 text-xs" /><Button size="sm" onClick={() => { if (newEquipmentItem.trim()) { setEquipment([...equipment, { id: `eq-${Date.now()}`, name: newEquipmentItem.trim(), status: 'default' }]); setNewEquipmentItem(''); } }}><Plus className="h-4 w-4" /></Button></div>)}
                  </ul>
                </div>
              </CardContent>
            </Card>
          </div>
        </div>

        {/* Spells */}
        <div className={cn("space-y-6", isCompactView && activeCompactSection !== 'spells-section' && "hidden")}>
          {/* SPELLCASTING STATS */}
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

        {/* Companions */}
        <div className={cn("space-y-6", isCompactView && activeCompactSection !== 'companion-section' && "hidden")}>
          <div className="flex justify-between items-center mb-4"><h2 className="text-2xl font-headline font-bold">{t('companions')}</h2>{showEditButtons && <Button size="sm" variant="outline" onClick={handleAddCompanion}><Plus className="h-4 w-4 mr-2" /> Add</Button>}</div>
          {companions.map(comp => (
            <Card key={comp.id} className="p-4 border-2">
              <CardHeader className="flex flex-row items-center justify-between p-0 mb-4">
                {showEditButtons ? (
                  <Input value={comp.name} onChange={e => { const n = companions.map(c => c.id === comp.id ? { ...c, name: e.target.value } : c); setCompanions(n); updateCharacter(character.id, { companions: n }); }} className="h-8 text-lg font-bold w-full mr-2" />
                ) : (
                  <CardTitle className="text-lg font-bold">{comp.name}</CardTitle>
                )}
                <Button variant="ghost" size="icon" className="text-destructive" onClick={() => { const n = companions.filter(c => c.id !== comp.id); setCompanions(n); updateCharacter(character.id, { companions: n }); }}><Trash2 className="h-4 w-4" /></Button>
              </CardHeader>
              <CardContent className="p-0 space-y-4">
                
                {/* Basic Info Row 1 */}
                <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                  <DetailField label="Type" value={comp.type} editing={showEditButtons} onChange={v => { const n = companions.map(c => c.id === comp.id ? { ...c, type: v } : c); setCompanions(n); updateCharacter(character.id, { companions: n }); }} />
                  <DetailField label="Size" value={comp.size} editing={showEditButtons} onChange={v => { const n = companions.map(c => c.id === comp.id ? { ...c, size: v } : c); setCompanions(n); updateCharacter(character.id, { companions: n }); }} />
                  <DetailField label="Armor Class" value={comp.armorClass} editing={showEditButtons} onChange={v => { const n = companions.map(c => c.id === comp.id ? { ...c, armorClass: parseInt(v) || 10 } : c); setCompanions(n); updateCharacter(character.id, { companions: n }); }} />
                  <DetailField label="Speed" value={comp.speed} editing={showEditButtons} onChange={v => { const n = companions.map(c => c.id === comp.id ? { ...c, speed: v } : c); setCompanions(n); updateCharacter(character.id, { companions: n }); }} />
                </div>
                
               {/* Basic Info Row 2 + HP */}
                <div className="grid grid-cols-2 md:grid-cols-4 gap-4 items-center">
                  <DetailField label="Initiative" value={comp.initiative} editing={showEditButtons} onChange={v => { const n = companions.map(c => c.id === comp.id ? { ...c, initiative: parseInt(v) || 0 } : c); setCompanions(n); updateCharacter(character.id, { companions: n }); }} />
                  <DetailField label="Prof Bonus" value={comp.proficiencyBonus} editing={showEditButtons} onChange={v => { const n = companions.map(c => c.id === comp.id ? { ...c, proficiencyBonus: v } : c); setCompanions(n); updateCharacter(character.id, { companions: n }); }} />
                  <div className="col-span-2 p-2 border rounded bg-muted/5 text-center">
                    <Label className="text-[10px] uppercase font-bold">HP</Label>
                    <div className="flex justify-center items-center gap-2">
                      {showEditButtons ? (
                        <>
                          <Input type="number" value={comp.hitPoints.current} onChange={e => { const n = companions.map(c => c.id === comp.id ? { ...c, hitPoints: {...c.hitPoints, current: parseInt(e.target.value) || 0} } : c); setCompanions(n); updateCharacter(character.id, { companions: n }); }} className="h-7 w-12 text-center" />
                          <span>/</span>
                          <Input type="number" value={comp.hitPoints.max} onChange={e => { const n = companions.map(c => c.id === comp.id ? { ...c, hitPoints: {...c.hitPoints, max: parseInt(e.target.value) || 0} } : c); setCompanions(n); updateCharacter(character.id, { companions: n }); }} className="h-7 w-12 text-center" />
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
                              setCompanions(n); updateCharacter(character.id, { companions: n });
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
                              setCompanions(n); updateCharacter(character.id, { companions: n });
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
                                setCompanions(n); updateCharacter(character.id, { companions: n });
                              }} className="h-6 text-xs flex-1 mr-2" />
                            ) : (
                              <span className="font-semibold flex-1">&bull; {act.name}</span>
                            )}
                            {showEditButtons && <Button variant="ghost" size="icon" className="h-5 w-5 text-destructive" onClick={() => {
                              const n = companions.map(c => c.id === comp.id ? { ...c, actions: c.actions.filter((_, idx) => idx !== i) } : c);
                              setCompanions(n); updateCharacter(character.id, { companions: n });
                            }}><Trash2 className="h-3 w-3" /></Button>}
                          </div>
                        ))}
                        {showEditButtons && <Button size="sm" variant="outline" className="w-full h-7 text-[10px]" onClick={() => {
                          const n = companions.map(c => c.id === comp.id ? { ...c, actions: [...c.actions, { id: `act-${Date.now()}`, name: 'New Action', notes: '' }] } : c);
                          setCompanions(n); updateCharacter(character.id, { companions: n });
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
                                setCompanions(n); updateCharacter(character.id, { companions: n });
                              }} className="h-6 text-xs flex-1 mr-2" />
                            ) : (
                              <span className="font-semibold flex-1">&bull; {feat.name}</span>
                            )}
                            {showEditButtons && <Button variant="ghost" size="icon" className="h-5 w-5 text-destructive" onClick={() => {
                              const n = companions.map(c => c.id === comp.id ? { ...c, features: c.features.filter((_, idx) => idx !== i) } : c);
                              setCompanions(n); updateCharacter(character.id, { companions: n });
                            }}><Trash2 className="h-3 w-3" /></Button>}
                          </div>
                        ))}
                        {showEditButtons && <Button size="sm" variant="outline" className="w-full h-7 text-[10px]" onClick={() => {
                          const n = companions.map(c => c.id === comp.id ? { ...c, features: [...c.features, { id: `feat-${Date.now()}`, name: 'New Feature', notes: '' }] } : c);
                          setCompanions(n); updateCharacter(character.id, { companions: n });
                        }}><Plus className="h-3 w-3 mr-1" /> Add Feature</Button>}
                      </div>
                    </AccordionContent>
                  </AccordionItem>
                </Accordion>
              </CardContent>
            </Card>
          ))}
        </div>
      </div>
    );
  }
);

DndSheet.displayName = 'DndSheet';