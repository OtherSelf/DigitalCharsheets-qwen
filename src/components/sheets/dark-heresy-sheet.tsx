'use client';
import * as React from 'react';
import { type DarkHeresyCharacter, BodyPart, Skill, MeleeWeapon, RangedWeapon, ArmorPiece, DarkHeresyCareerPath } from '@/lib/types';
import { Card, CardContent, CardHeader, CardTitle } from '../ui/card';
import { Input } from '../ui/input';
import { Textarea } from '../ui/textarea';
import { Button } from '../ui/button';
import { Plus, Trash2, Edit, Save, Info, Minus, ChevronDown, Info as InfoIcon, ChevronRight, ChevronLeft } from 'lucide-react';
import { Label } from '@/components/ui/label';
import { Checkbox } from '../ui/checkbox';
import * as AccordionPrimitive from "@radix-ui/react-accordion";
import {
  Accordion,
  AccordionContent,
  AccordionItem,
} from "@/components/ui/accordion";
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from "@/components/ui/collapsible"
import {
    Table,
    TableBody,
    TableCell,
    TableHead,
    TableHeader,
    TableRow,
} from "@/components/ui/table";
import { useCharacterContext } from '@/context/character-context';
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';
import { ADVANCED_RANK_THRESHOLD, RanksByCareer, AdvancedPathsByCareer, AdvancedPath, calculateRank } from '@/lib/dark-heresy-ranks';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from '../ui/dialog';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { cn } from '@/lib/utils';
import { Separator } from '../ui/separator';
import { WORLD_VARIANTS_BY_HOMEWORLD, WORLD_VARIANT_LABELS } from '@/lib/dark-heresy-data';
import { useTranslation } from '@/context/language-context';

const DetailField = ({label, value, editing, type = "text", onChange, onBlur, isCompactView}: {label:string, value:string|number, editing:boolean, type?:string, onChange?: (e: React.ChangeEvent<HTMLInputElement>) => void, onBlur?: (e: React.FocusEvent<HTMLInputElement>) => void, isCompactView: boolean}) => (
  <div className="space-y-1">
    <Label className={cn("text-xs text-muted-foreground", isCompactView && "text-[10px]")}>{label}</Label>
    {editing ? (
      <Input defaultValue={value} type={type} onChange={onChange} onBlur={onBlur} className="h-8"/>
    ) : (
      <p className={cn("text-sm font-medium break-words", isCompactView && "text-xs")}>{value || '-'}</p>
    )}
  </div>
);

const CharacteristicStat = ({
    label,
    fullName,
    value,
    upgrades,
    editing,
    onValueChange,
    onUpgradeChange,
    notes,
    onNoteChange,
    isCompactView,
    hideNotes
}: {
    label: string;
    fullName: string;
    value: number;
    upgrades: boolean[];
    editing: boolean;
    onValueChange: (e: React.ChangeEvent<HTMLInputElement>) => void;
    onUpgradeChange: (index: number, checked: boolean) => void;
    notes?: string;
    onNoteChange: (note: string) => void;
    isCompactView: boolean;
    hideNotes: boolean;
}) => {
    const currentUpgrades = (
        Array.isArray(upgrades) ? [...upgrades, ...Array(4 - upgrades.length).fill(false)] : [false, false, false, false]
    ).slice(0, 4) as [boolean, boolean, boolean, boolean];

    const bonus = currentUpgrades.filter(Boolean).length * 5;
    const displayValue = value + bonus;
    
    const isCheckboxDisabled = (index: number) => {
        if (editing) return true;
        if (!currentUpgrades[index] && index > 0 && !currentUpgrades[index - 1]) {
            return true;
        }
        return false;
    };

    return (
    <div className="py-1 rounded-lg bg-background border text-center relative px-0.5 h-full flex flex-col justify-between min-h-[80px]">
        <div className="text-[10px] font-semibold text-muted-foreground uppercase tracking-wide px-1">{isCompactView ? label : fullName}</div>
        {!hideNotes && (
            <Popover>
                <PopoverTrigger asChild>
                    <Button variant={notes ? 'secondary' : 'ghost'} size="icon" className="h-5 w-5 absolute top-0.5 right-0.5"><Info className="h-3 w-3" /></Button>
                </PopoverTrigger>
                <PopoverContent className="w-64">
                    <Label className="text-xs mb-2 block">Notes for {fullName}</Label>
                    <Textarea defaultValue={notes || ''} onBlur={(e) => onNoteChange(e.target.value)} placeholder="Add notes..." className="min-h-[100px] text-sm" />
                </PopoverContent>
            </Popover>
        )}
        <div className="flex items-center justify-center gap-1 mb-1">
            {editing ? (
                <Input type="number" value={value} onChange={onValueChange} className="text-base font-bold h-8 w-14 text-center"/>
            ) : (
                <div className="text-base font-bold text-primary w-10 text-center">{displayValue}</div>
            )}
            <div className="flex flex-col gap-1 pr-1">
                {currentUpgrades.map((checked, index) => (
                    <Checkbox
                        key={index}
                        checked={checked}
                        disabled={isCheckboxDisabled(index)}
                        onCheckedChange={(c) => onUpgradeChange(index, !!c)}
                        className="h-3 w-3"
                    />
                ))}
            </div>
        </div>
    </div>
)};

const EditSaveButton = ({ editing, onEdit, onSave }: { editing: boolean, onEdit: () => void, onSave: () => void }) => {
    return editing ? (
        <Button size="icon" onClick={onSave} className="h-7 w-7"><Save className="h-3.5 w-3.5" /></Button>
    ) : (
        <Button size="icon" variant="outline" onClick={onEdit} className="h-7 w-7"><Edit className="h-3.5 w-3.5" /></Button>
    );
};

const MetricBox = ({
  title,
  notes,
  onNoteChange,
  isCompactView,
  editing,
  onEdit,
  onSave,
  hideNotes,
  showEditButtons,
  children,
}: {
  title: string;
  notes?: string;
  onNoteChange: (val: string) => void;
  isCompactView: boolean;
  editing: boolean;
  onEdit: () => void;
  onSave: () => void;
  hideNotes: boolean;
  showEditButtons: boolean;
  children: React.ReactNode;
}) => (
  <div className="flex flex-col h-full">
    <div className="flex items-center justify-between h-9 px-1 shrink-0">
      <div className="flex items-center gap-1 overflow-hidden">
        <h4 className="text-[10px] sm:text-xs font-semibold text-muted-foreground truncate uppercase">{title}</h4>
        {!hideNotes && (
          <Popover>
            <PopoverTrigger asChild>
              <Button variant={notes ? 'secondary' : 'ghost'} size="icon" className="h-6 w-6 shrink-0"><Info className="h-3 w-3" /></Button>
            </PopoverTrigger>
            <PopoverContent className="w-64">
              <Label className="text-xs mb-2 block">Notes for {title}</Label>
              <Textarea defaultValue={notes || ''} onBlur={(e) => onNoteChange(e.target.value)} placeholder="Add notes..." className="min-h-[100px] text-sm" />
            </PopoverContent>
          </Popover>
        )}
      </div>
      <div className="shrink-0 ml-1">
        {(showEditButtons || editing) && <EditSaveButton editing={editing} onEdit={onEdit} onSave={onSave} />}
      </div>
    </div>
    <div className={cn(
      "flex items-center justify-center rounded-lg border bg-background overflow-hidden",
      isCompactView ? "h-14" : "h-20"
    )}>
      {children}
    </div>
  </div>
);

const defaultEquipment = {
  armor: { 'Head': null, 'Right arm': null, 'Body': null, 'Left arm': null, 'Right leg': null, 'Left leg': null },
  weapons: { melee: [], ranged: [] }
};

const defaultStatUpgrades = {
    weaponSkill: [false, false, false, false], ballisticSkill: [false, false, false, false],
    strength: [false, false, false, false], toughness: [false, false, false, false],
    agility: [false, false, false, false], intelligence: [false, false, false, false],
    perception: [false, false, false, false], willpower: [false, false, false, false],
    fellowship: [false, false, false, false], influence: [false, false, false, false],
};

const ARMOR_TYPES = ["Primitive", "Advanced", "Flack", "Mesh", "Carapace", "Power", "Force"];

const ArmorDisplay = ({ character, isCompactView }: { character: DarkHeresyCharacter; isCompactView: boolean; }) => {
    const armor = character.equipment?.armor ?? defaultEquipment.armor;
    const bodyPartLocations: Record<BodyPart, string> = {
        'Head': '1-10', 'Right arm': '11-20', 'Left arm': '21-30', 'Body': '31-70', 'Right leg': '71-85', 'Left leg': '86-00',
    };

    const ArmorBox = ({ part, location }: { part: BodyPart, location: string }) => {
        const armorPiece = armor[part];
        const title = part.replace(' arm', ' Arm').replace(' leg', ' Leg');
        return (
            <div className={cn("border bg-card text-card-foreground rounded-md shadow-md w-full min-0 flex flex-col items-center", isCompactView ? "p-1" : "p-2")}>
                <h4 className={cn("font-bold text-center truncate w-full px-1", isCompactView ? "text-[10px]" : "text-xs")}>{title}</h4>
                <div className="text-[10px] text-muted-foreground mb-1">({location})</div>
                <div className={cn("space-y-0.5 w-full", isCompactView ? "text-[9px]" : "text-[10px] text-center")}>
                    <p className="truncate"><strong className="text-muted-foreground">AP:</strong> {armorPiece?.ap ?? '—'}</p>
                    <p className="truncate"><strong className="text-muted-foreground">Type:</strong> {armorPiece?.type ?? '—'}</p>
                </div>
            </div>
        );
    };

    return (
        <div className="grid grid-cols-3 gap-x-2 gap-y-4 pt-8 w-full max-w-full overflow-hidden">
            <div /> <div className="flex justify-center items-start"><ArmorBox part="Head" location={bodyPartLocations['Head']} /></div> <div />
            <div className="flex flex-col justify-start mt-2"><ArmorBox part="Left arm" location={bodyPartLocations['Left arm']} /></div>
            <div className="mt-8"><ArmorBox part="Body" location={bodyPartLocations['Body']} /></div>
            <div className="flex flex-col justify-start mt-2"><ArmorBox part="Right arm" location={bodyPartLocations['Right arm']} /></div>
            <div className="-mt-2"><ArmorBox part="Left leg" location={bodyPartLocations['Left leg']} /></div> <div />
            <div className="-mt-2"><ArmorBox part="Right leg" location={bodyPartLocations['Right leg']} /></div>
        </div>
    );
};

export const DarkHeresySheet = React.forwardRef<any, { character: DarkHeresyCharacter, isCompactView: boolean, activeCompactSection: string }>(
  ({ character, isCompactView, activeCompactSection }, ref) => {
    const { updateCharacter, setHasUnsavedChanges, hideNotes, showEditButtons } = useCharacterContext();
    const { t } = useTranslation();

    const [isInfoProgressionEditing, setIsInfoProgressionEditing] = React.useState(false);
    const [isCharacteristicsEditing, setIsCharacteristicsEditing] = React.useState(false);
    const [isSkillsEditing, setIsSkillsEditing] = React.useState(false);
    const [isTalentsEditing, setIsTalentsEditing] = React.useState(false);
    const [isWealthEditing, setIsWealthEditing] = React.useState(false);
    const [isMovementEditing, setIsMovementEditing] = React.useState(false);
    const [isArmorEditing, setIsArmorEditing] = React.useState(false);
    const [isMeleeWeaponsEditing, setIsMeleeWeaponsEditing] = React.useState(false);
    const [isRangedWeaponsEditing, setIsRangedWeaponsEditing] = React.useState(false);
    const [isInventoryEditing, setIsInventoryEditing] = React.useState(false);
    const [isPointsEditing, setIsPointsEditing] = React.useState(false);

    const [isSkillsPanelCollapsed, setIsSkillsPanelCollapsed] = React.useState(false);
    const [isEquipmentPanelCollapsed, setIsEquipmentPanelCollapsed] = React.useState(false);
    const [isEquipmentSectionOpen, setIsEquipmentSectionOpen] = React.useState(true);
    const [isInventorySectionOpen, setIsInventorySectionOpen] = React.useState(true);
    const [isArmorExpanded, setIsArmorExpanded] = React.useState(false);
    
    const [editableStats, setEditableStats] = React.useState(character.stats);
    const [editableStatUpgrades, setEditableStatUpgrades] = React.useState(character.statUpgrades ?? defaultStatUpgrades);
    const [editableExperience, setEditableExperience] = React.useState(character.experience);
    const [editableTotalExpSpent, setEditableTotalExpSpent] = React.useState(character.totalExpSpent);
    const [editableAdvancedPath, setEditableAdvancedPath] = React.useState(character.advancedPath ?? null);
    const [editableAlternatePath, setEditableAlternatePath] = React.useState(character.alternatePath ?? null);
    const [amountToSpend, setAmountToSpend] = React.useState(0);
    const [isAdvancedPathModalOpen, setIsAdvancedPathModalOpen] = React.useState(false);
    const [isAlternateRankModalOpen, setIsAlternateRankModalOpen] = React.useState(false);
    const [editableWealth, setEditableWealth] = React.useState({
        throneGelt: character.wealth?.throneGelt ?? 0, monthlyIncome: character.wealth?.monthlyIncome ?? 0,
    });
    const [editableMovement, setEditableMovement] = React.useState(character.movement ?? { walkHalf: 0, walkFull: 0, charge: 0, run: 0 });

    const getPointsObject = (p: any) => {
        if (typeof p === 'object' && p !== null && 'max' in p && 'current' in p) return { current: p.current, max: p.max, notes: p.notes || '' };
        return { current: 0, max: 0, notes: '' };
    };
    const getSimplePointsObject = (p: any) => {
        if (typeof p === 'object' && p !== null && 'total' in p) return { total: p.total, notes: p.notes || '' };
        return { total: 0, notes: '' };
    };

    const [editablePoints, setEditablePoints] = React.useState({
        wounds: getPointsObject(character.wounds),
        fatePoints: getPointsObject(character.fatePoints),
        insanityPoints: getSimplePointsObject(character.insanityPoints),
        corruptionPoints: getSimplePointsObject(character.corruptionPoints),
    });

    const [editableSkills, setEditableSkills] = React.useState(character.skills ?? []);
    const [newBasicSkillName, setNewBasicSkillName] = React.useState('');
    const [newAdvancedSkillName, setNewAdvancedSkillName] = React.useState('');
    const [editableTalents, setEditableTalents] = React.useState(character.talents ?? []);
    const [newTalentName, setNewTalentName] = React.useState('');
    const [editableEquipment, setEditableEquipment] = React.useState(character.equipment ?? defaultEquipment);
    const [editableInventory, setEditableInventory] = React.useState(character.inventory ?? []);
    const [newInventoryItem, setNewInventoryItem] = React.useState('');

    const isAnyEditing = isInfoProgressionEditing || isCharacteristicsEditing || isSkillsEditing || isTalentsEditing || isWealthEditing || isMovementEditing || isArmorEditing || isMeleeWeaponsEditing || isRangedWeaponsEditing || isInventoryEditing || isPointsEditing;

    React.useEffect(() => { setHasUnsavedChanges(isAnyEditing); }, [isAnyEditing, setHasUnsavedChanges]);

    const handleSaveCharacteristics = React.useCallback(() => { 
        updateCharacter(character.id, { stats: editableStats, statUpgrades: editableStatUpgrades }); 
        setIsCharacteristicsEditing(false); 
    }, [character.id, editableStats, editableStatUpgrades, updateCharacter]);

    const handleSaveSkills = React.useCallback(() => { updateCharacter(character.id, { skills: editableSkills }); setIsSkillsEditing(false); }, [character.id, editableSkills, updateCharacter]);
    const handleSaveTalents = React.useCallback(() => { updateCharacter(character.id, { talents: editableTalents }); setIsTalentsEditing(false); }, [character.id, editableTalents, updateCharacter]);
    const handleSaveWealth = React.useCallback(() => { updateCharacter(character.id, { wealth: editableWealth }); setIsWealthEditing(false); }, [character.id, editableWealth, updateCharacter]);
    const handleSaveMovement = React.useCallback(() => { updateCharacter(character.id, { movement: editableMovement }); setIsMovementEditing(false); }, [character.id, editableMovement, updateCharacter]);
    const handleSaveArmor = React.useCallback(() => { updateCharacter(character.id, { equipment: {...editableEquipment, armor: editableEquipment.armor} }); setIsArmorEditing(false); }, [character.id, editableEquipment, updateCharacter]);
    const handleSaveMeleeWeapons = React.useCallback(() => { updateCharacter(character.id, { equipment: editableEquipment }); setIsMeleeWeaponsEditing(false); }, [character.id, editableEquipment, updateCharacter]);
    const handleSaveRangedWeapons = React.useCallback(() => { updateCharacter(character.id, { equipment: editableEquipment }); setIsRangedWeaponsEditing(false); }, [character.id, editableEquipment, updateCharacter]);    const handleSaveInventory = React.useCallback(() => { updateCharacter(character.id, { inventory: editableInventory }); setIsInventoryEditing(false); }, [character.id, editableInventory, updateCharacter]);
    const handleSavePoints = React.useCallback(() => { updateCharacter(character.id, { wounds: editablePoints.wounds, fatePoints: editablePoints.fatePoints, insanityPoints: editablePoints.insanityPoints, corruptionPoints: editablePoints.corruptionPoints }); setIsPointsEditing(false); }, [character.id, editablePoints, updateCharacter]);

    const handleSaveAll = React.useCallback(() => {
      if (isInfoProgressionEditing) setIsInfoProgressionEditing(false);
      if (isCharacteristicsEditing) handleSaveCharacteristics();
      if (isSkillsEditing) handleSaveSkills();
      if (isTalentsEditing) handleSaveTalents();
      if (isWealthEditing) handleSaveWealth();
      if (isMovementEditing) handleSaveMovement();
      if (isArmorEditing) handleSaveArmor();
      if (isMeleeWeaponsEditing) handleSaveMeleeWeapons();
      if (isRangedWeaponsEditing) handleSaveRangedWeapons();
      if (isInventoryEditing) handleSaveInventory();
      if (isPointsEditing) handleSavePoints();
    }, [isInfoProgressionEditing, isCharacteristicsEditing, handleSaveCharacteristics, isSkillsEditing, handleSaveSkills, isTalentsEditing, handleSaveTalents, isWealthEditing, handleSaveWealth, isMovementEditing, handleSaveMovement, isArmorEditing, handleSaveArmor, isMeleeWeaponsEditing, handleSaveMeleeWeapons, isRangedWeaponsEditing, handleSaveRangedWeapons, isInventoryEditing, handleSaveInventory, isPointsEditing, handleSavePoints]);

    React.useImperativeHandle(ref, () => ({ saveAll: handleSaveAll }));

    const worldVariantLabel = React.useMemo(() => {
        if (!character.homeWorld) return t('waitingHomeWorld');
        const key = WORLD_VARIANT_LABELS[character.homeWorld];
        if (key === 'Tribal Taboos') return t('tribalTaboos');
        if (key === 'Hive Class') return t('hiveClass');
        if (key === 'Birth Planet') return t('birthPlanet');
        if (key === 'Ship Tradition') return t('shipTradition');
        return t('worldVariant');
    }, [character.homeWorld, t]);

    React.useEffect(() => {
        setEditableStats(character.stats); setEditableStatUpgrades(character.statUpgrades ?? defaultStatUpgrades);
        setEditableExperience(character.experience); setEditableTotalExpSpent(character.totalExpSpent);
        setEditableAdvancedPath(character.advancedPath ?? null); setEditableAlternatePath(character.alternatePath ?? null);
        setEditableWealth({ throneGelt: character.wealth?.throneGelt ?? 0, monthlyIncome: character.wealth?.monthlyIncome ?? 0 });
        setEditableMovement(character.movement ?? { walkHalf: 0, walkFull: 0, charge: 0, run: 0 });
        setEditablePoints({
            wounds: getPointsObject(character.wounds), fatePoints: getPointsObject(character.fatePoints),
            insanityPoints: getSimplePointsObject(character.insanityPoints), corruptionPoints: getSimplePointsObject(character.corruptionPoints),
        });
        setEditableSkills(character.skills ?? []); setEditableTalents(character.talents ?? []);
        setEditableEquipment(character.equipment ?? defaultEquipment); setEditableInventory(character.inventory ?? []);
    }, [character.id, character.stats, character.statUpgrades, character.experience, character.totalExpSpent, character.advancedPath, character.alternatePath, character.wealth, character.movement, character.wounds, character.fatePoints, character.insanityPoints, character.corruptionPoints, character.skills, character.talents, character.equipment, character.inventory]);

    const advancedPathThreshold = character.careerPath === 'Tech-Priest' ? 3000 : character.careerPath === 'Imperial Psyker' ? 2000 : ADVANCED_RANK_THRESHOLD;

    const handleTotalExpChange = (e: React.ChangeEvent<HTMLInputElement>) => {
        const newTotalExp = parseInt(e.target.value, 10) || 0;
        setEditableTotalExpSpent(newTotalExp);
        if (newTotalExp < advancedPathThreshold) setEditableAdvancedPath(null);
        if (newTotalExp < 2000 && (editableAlternatePath ?? character.alternatePath) === 'Chirurgeon') setEditableAlternatePath(null);
    };
    
    const handleSaveTotalExp = () => {
        if (editableTotalExpSpent !== character.totalExpSpent || (editableAdvancedPath ?? null) !== (character.advancedPath ?? null) || (editableAlternatePath ?? null) !== (character.alternatePath ?? null)) {
          updateCharacter(character.id, { totalExpSpent: editableTotalExpSpent, advancedPath: editableAdvancedPath ?? null, alternatePath: editableAlternatePath ?? null });
        }
    }

    const handlePointChange = (pointType: 'wounds' | 'fatePoints' | 'insanityPoints' | 'corruptionPoints', delta: number) => {
        let dataToUpdate: Partial<DarkHeresyCharacter> = {};
        if (pointType === 'wounds' || pointType === 'fatePoints') {
            const currentPoints = getPointsObject(character[pointType]);
            const newVal = Math.max(0, currentPoints.current + delta);
            dataToUpdate[pointType] = { ...currentPoints, current: Math.min(newVal, currentPoints.max) };
        } else {
            const currentPoints = getSimplePointsObject(character[pointType]);
            dataToUpdate[pointType] = { ...currentPoints, total: Math.min(Math.max(currentPoints.total + delta, 0), 100) };
        }
        updateCharacter(character.id, dataToUpdate);
    };

    const handleSpendExp = () => {
        if (amountToSpend > 0 && amountToSpend <= editableExperience) {
            const newCurrentExp = editableExperience - amountToSpend;
            const newTotalExp = editableTotalExpSpent + amountToSpend;
            setEditableExperience(newCurrentExp); setEditableTotalExpSpent(newTotalExp);
            if (newTotalExp < advancedPathThreshold) setEditableAdvancedPath(null);
            updateCharacter(character.id, { experience: newCurrentExp, totalExpSpent: newTotalExp, advancedPath: newTotalExp < advancedPathThreshold ? (editableAdvancedPath ?? null) : (character.advancedPath ?? null), alternatePath: character.alternatePath });
            setAmountToSpend(0);
        }
    };
    
    const handleSelectAdvancedPath = (pathName: string) => { updateCharacter(character.id, { advancedPath: pathName }); setEditableAdvancedPath(pathName); setIsAdvancedPathModalOpen(false); };
    const handleSelectAlternateRank = (pathName: string | null) => { updateCharacter(character.id, { alternatePath: pathName }); setEditableAlternatePath(pathName); setIsAlternateRankModalOpen(false); };
    
    const handleNestedPointsChange = (pointType: 'wounds' | 'fatePoints', field: 'current' | 'max', value: string) => {
        setEditablePoints(prev => ({ ...prev, [pointType]: { ...prev[pointType], [field]: parseInt(value, 10) || 0 } }));
    };
    const handleSimplePointsChange = (point: 'insanityPoints' | 'corruptionPoints', field: 'total' | 'notes', value: string) => {
        if (field === 'total') {
            const numValue = parseInt(value, 10) || 0;
            setEditablePoints(prev => ({ ...prev, [point]: { ...prev[point], total: Math.min(Math.max(numValue, 0), 100) } }));
        } else {
            setEditablePoints(prev => ({ ...prev, [point]: { ...prev[point], notes: value } }));
        }
    };

    const handleArmorChange = (part: BodyPart, field: keyof ArmorPiece, value: string) => {
        setEditableEquipment(prev => {
            const newArmor = { ...prev.armor };
            const currentPiece = newArmor[part] ? { ...newArmor[part]! } : { ap: 0, type: '', mods: '', quality: 'Common' };
            if (field === 'ap') currentPiece.ap = parseInt(value, 10) || 0; else (currentPiece as any)[field] = value;
            newArmor[part] = currentPiece;
            return { ...prev, armor: newArmor };
        });
    };

    const handleMeleeWeaponChange = (weaponId: string, field: keyof Omit<MeleeWeapon, 'id'>, value: string | boolean) => {
        setEditableEquipment(prev => ({ ...prev, weapons: { ...prev.weapons, melee: (prev.weapons.melee ?? []).map(w => w.id === weaponId ? { ...w, [field]: value } : w) } }));
    };
    const addMeleeWeapon = () => {
        const newWeapon: MeleeWeapon = { id: `melee-${Date.now()}`, name: 'New Melee Weapon', type: '', range: '', penetration: '', damage: '', traits: '', notes: '', equipped: false };
        setEditableEquipment(prev => ({ ...prev, weapons: { ...prev.weapons, melee: [...(prev.weapons.melee ?? []), newWeapon] } }));
    };
    const removeMeleeWeapon = (weaponId: string) => {
        setEditableEquipment(prev => ({ ...prev, weapons: { ...prev.weapons, melee: (prev.weapons.melee ?? []).filter(w => w.id !== weaponId) } }));
    };

    const handleRangedWeaponChange = (weaponId: string, field: keyof Omit<RangedWeapon, 'id'>, value: string | number | boolean) => {
        setEditableEquipment(prev => ({ ...prev, weapons: { ...prev.weapons, ranged: (prev.weapons.ranged ?? []).map(w => {
            if (w.id === weaponId) {
                const updated = {...w}; if (field === 'clip' || field === 'clipSize') (updated as any)[field] = parseInt(value as string, 10) || 0; else (updated as any)[field] = value;
                return updated;
            } return w;
        })}}));
    };
    const addRangedWeapon = () => {
        const newWeapon: RangedWeapon = { id: `ranged-${Date.now()}`, name: 'New Ranged Weapon', type: '', range: '', rof: '', damage: '', clip: 0, clipSize: 0, reload: '', traits: '', notes: '', equipped: false };
        setEditableEquipment(prev => ({ ...prev, weapons: { ...prev.weapons, ranged: [...(prev.weapons.ranged ?? []), newWeapon] } }));
    };
    const removeRangedWeapon = (weaponId: string) => {
        setEditableEquipment(prev => ({ ...prev, weapons: { ...prev.weapons, ranged: (prev.weapons.ranged ?? []).filter(w => w.id !== weaponId) } }));
    };

    const bodyParts: BodyPart[] = ['Head', 'Right arm', 'Left arm', 'Body', 'Right leg', 'Left leg'];
    const bodyPartLocations: Record<BodyPart, string> = { 'Head': '1-10', 'Right arm': '11-20', 'Left arm': '21-30', 'Body': '31-70', 'Right leg': '71-85', 'Left leg': '86-00' };
    const characteristics = [
        { key: 'weaponSkill', label: 'WS', fullName: 'Weapon Skill' }, { key: 'ballisticSkill', label: 'BS', fullName: 'Ballistic Skill' },
        { key: 'strength', label: 'S', fullName: 'Strength' }, { key: 'toughness', label: 'T', fullName: 'Toughness' },
        { key: 'agility', label: 'Ag', fullName: 'Agility' }, { key: 'intelligence', label: 'Int', fullName: 'Intelligence' },
        { key: 'perception', label: 'Per', fullName: 'Perception' }, { key: 'willpower', label: 'WP', fullName: 'Willpower' },
        { key: 'fellowship', label: 'Fel', fullName: 'Fellowship' }, { key: 'influence', label: 'Inf', fullName: 'Influence' },
    ] as const;

    const currentSkills = isSkillsEditing ? editableSkills : (character.skills ?? []);
    const basicSkills = currentSkills.filter(s => s.type === 'basic');
    const advancedSkills = currentSkills.filter(s => s.type === 'advanced');

    const addInventoryItem = () => { if (newInventoryItem.trim() !== '') { setEditableInventory([...editableInventory, { id: `new-inv-${Date.now()}`, name: newInventoryItem, status: 'default', notes: '' }]); setNewInventoryItem(''); } };
    const addBasicSkill = () => { if (newBasicSkillName.trim() !== '') { setEditableSkills([...editableSkills, { id: `new-skill-${Date.now()}`, name: newBasicSkillName, notes: '', type: 'basic', training: { skilled: false, plus10: false, plus20: false } }]); setNewBasicSkillName(''); } };
    const addAdvancedSkill = () => { if (newAdvancedSkillName.trim() !== '') { setEditableSkills([...editableSkills, { id: `new-skill-${Date.now()}`, name: newAdvancedSkillName, notes: '', type: 'advanced', training: { skilled: false, plus10: false, plus20: false } }]); setNewAdvancedSkillName(''); } };
    const addTalent = () => { if (newTalentName.trim() !== '') { setEditableTalents([...editableTalents, { id: `new-talent-${Date.now()}`, name: newTalentName, notes: '' }]); setNewTalentName(''); } };
    
    const handleUpgradeChange = (statKey: keyof typeof defaultStatUpgrades, index: number, isChecked: boolean) => {
        if (isCharacteristicsEditing) {
            setEditableStatUpgrades(prev => { 
                const next = { ...prev }; 
                const specific = [...(next[statKey] || [false, false, false, false])]; 
                specific[index] = isChecked; 
                if (!isChecked) for (let i = index + 1; i < specific.length; i++) specific[i] = false; 
                next[statKey] = specific as [boolean, boolean, boolean, boolean]; 
                return next; 
            });
        } else {
            const next = { ...character.statUpgrades }; 
            const specific = [...(next[statKey] || [false, false, false, false])]; 
            specific[index] = isChecked; 
            if (!isChecked) for (let i = index + 1; i < specific.length; i++) specific[i] = false; 
            next[statKey] = specific as [boolean, boolean, boolean, boolean]; 
            updateCharacter(character.id, { statUpgrades: next });
        }
    };

    const handleSkillTrainingUpdate = (skillId: string, trainingKey: keyof Skill['training'], isChecked: boolean) => {
        const skillsToUpdate = isSkillsEditing ? editableSkills : (character.skills ?? []);
        const nextSkills = skillsToUpdate.map(s => { if (s.id === skillId) { const next = { ...s.training, [trainingKey]: isChecked }; if (trainingKey === 'skilled' && !isChecked) { next.plus10 = false; next.plus20 = false; } if (trainingKey === 'plus10' && !isChecked) next.plus20 = false; return { ...s, training: next }; } return s; });
        if (isSkillsEditing) setEditableSkills(nextSkills); else updateCharacter(character.id, { skills: nextSkills });
    };
    
    const currentEquipment = isArmorEditing || isMeleeWeaponsEditing || isRangedWeaponsEditing ? editableEquipment : (character.equipment ?? defaultEquipment);
    const currentInventory = isInventoryEditing ? editableInventory : (character.inventory ?? []);
    const equippedMeleeWeapons = (currentEquipment.weapons?.melee ?? []).filter(w => w.equipped);
    const unequippedMeleeWeapons = (currentEquipment.weapons?.melee ?? []).filter(w => !w.equipped);
    const equippedRangedWeapons = (currentEquipment.weapons?.ranged ?? []).filter(w => w.equipped);
    const unequippedRangedWeapons = (currentEquipment.weapons?.ranged ?? []).filter(w => w.equipped === false || w.equipped === undefined);

    const careerProgression = character.careerPath ? RanksByCareer[character.careerPath as DarkHeresyCareerPath] : null;
    const possibleAdvancedPaths = character.careerPath ? AdvancedPathsByCareer[character.careerPath as DarkHeresyCareerPath] : null;
    let chosenAdvancedPathData: AdvancedPath | null = null;
    if ((editableAdvancedPath ?? character.advancedPath) && possibleAdvancedPaths) {
      const paths = Object.values(possibleAdvancedPaths) as AdvancedPath[];
      chosenAdvancedPathData = paths.find(p => p.name === (editableAdvancedPath ?? character.advancedPath)) || null;
    }
    const currentRankName = careerProgression ? calculateRank(careerProgression, editableTotalExpSpent, chosenAdvancedPathData, editableAlternatePath ?? character.alternatePath) : 'N/A';
    const canChooseAlternateRank = character.careerPath === 'Adept' && editableTotalExpSpent >= 2000 && editableTotalExpSpent < 3000;

    return (
        <div className="space-y-6">
            {isCompactView && (
                <div className="bg-card px-4 py-3 border-b shadow-sm space-y-3">
                    <div className="grid grid-cols-1 md:grid-cols-5 gap-1 items-start">
                        <div className="md:col-span-3">
                            <div className="flex-row items-center justify-between flex">
                                <div className="flex-1 justify-start p-0 h-auto hover:bg-transparent flex items-center"><CardTitle className="font-headline text-base">{t('characteristics')}</CardTitle></div>
                                {(showEditButtons || isCharacteristicsEditing) && <EditSaveButton editing={isCharacteristicsEditing} onEdit={() => setIsCharacteristicsEditing(true)} onSave={handleSaveCharacteristics} />}
                            </div>
                            <div className="grid grid-cols-5 gap-0.5 mt-2">
                                {characteristics.map(char => (
                                    <CharacteristicStat key={char.key} label={char.label} fullName={char.fullName} value={isCharacteristicsEditing ? editableStats[char.key] : character.stats[char.key]} upgrades={isCharacteristicsEditing ? editableStatUpgrades[char.key] : (character.statUpgrades ? character.statUpgrades[char.key] : [false, false, false, false])} editing={isCharacteristicsEditing} onValueChange={e => setEditableStats(prev => ({ ...prev, [char.key]: parseInt(e.target.value, 10) || 0 }))} onUpgradeChange={(index, checked) => handleUpgradeChange(char.key, index, checked)} notes={character.statNotes?.[char.key]} onNoteChange={(note) => { const next = { ...(character.statNotes || {}), [char.key]: note }; updateCharacter(character.id, { statNotes: next }); }} isCompactView={isCompactView} hideNotes={hideNotes} />
                                ))}
                            </div>
                        </div>
                        <div className="md:col-span-2 grid grid-cols-2 gap-1 px-1 mt-1">
                            <MetricBox title={t('wounds')} notes={getPointsObject(character.wounds).notes} onNoteChange={(val) => updateCharacter(character.id, { wounds: { ...getPointsObject(character.wounds), notes: val } })} editing={isPointsEditing} onEdit={() => setIsPointsEditing(true)} onSave={handleSavePoints} isCompactView={isCompactView} hideNotes={hideNotes} showEditButtons={showEditButtons}>
                              <div className="flex items-center justify-center gap-1">
                                {isPointsEditing ? (
                                  <><Input type="number" value={editablePoints.wounds.current} onChange={e => handleNestedPointsChange('wounds', 'current', e.target.value)} className="h-6 w-10 text-xs px-1 text-center"/><span className="text-[10px] text-muted-foreground">/</span><Input type="number" value={editablePoints.wounds.max} onChange={e => handleNestedPointsChange('wounds', 'max', e.target.value)} className="h-6 w-10 text-xs px-1 text-center"/></>
                                ) : (
                                  <div className="flex items-center justify-center gap-1">
                                    <Button size="icon" variant="outline" className="h-5 w-5" onClick={() => handlePointChange('wounds', -1)}><Minus className="h-3 w-3" /></Button>
                                    <span className="font-bold text-sm min-w-[1.2rem] text-center">{getPointsObject(character.wounds).current}</span>
                                    <Button size="icon" variant="outline" className="h-5 w-5" onClick={() => handlePointChange('wounds', 1)}><Plus className="h-3 w-3" /></Button>
                                    <span className="text-[10px] text-muted-foreground mx-0.5">/</span>
                                    <span className="text-sm">{getPointsObject(character.wounds).max}</span>
                                  </div>
                                )}
                              </div>
                            </MetricBox>
                            <MetricBox title={t('fate')} notes={getPointsObject(character.fatePoints).notes} onNoteChange={(val) => updateCharacter(character.id, { fatePoints: { ...getPointsObject(character.fatePoints), notes: val } })} editing={isPointsEditing} onEdit={() => setIsPointsEditing(true)} onSave={handleSavePoints} isCompactView={isCompactView} hideNotes={hideNotes} showEditButtons={showEditButtons}>
                              <div className="flex items-center justify-center gap-1">
                                {isPointsEditing ? (
                                  <><Input type="number" value={editablePoints.fatePoints.current} onChange={e => handleNestedPointsChange('fatePoints', 'current', e.target.value)} className="h-6 w-10 text-xs px-1 text-center"/><span className="text-[10px] text-muted-foreground">/</span><Input type="number" value={editablePoints.fatePoints.max} onChange={e => handleNestedPointsChange('fatePoints', 'max', e.target.value)} className="h-6 w-10 text-xs px-1 text-center"/></>
                                ) : (
                                  <div className="flex items-center justify-center gap-1">
                                    <Button size="icon" variant="outline" className="h-5 w-5" onClick={() => handlePointChange('fatePoints', -1)}><Minus className="h-3 w-3" /></Button>
                                    <span className="font-bold text-sm min-w-[1.2rem] text-center">{getPointsObject(character.fatePoints).current}</span>
                                    <Button size="icon" variant="outline" className="h-5 w-5" onClick={() => handlePointChange('fatePoints', 1)}><Plus className="h-3 w-3" /></Button>
                                    <span className="text-[10px] text-muted-foreground mx-0.5">/</span>
                                    <span className="text-sm">{getPointsObject(character.fatePoints).max}</span>
                                  </div>
                                )}
                              </div>
                            </MetricBox>
                            <MetricBox title={t('insanity')} notes={getSimplePointsObject(character.insanityPoints).notes} onNoteChange={(val) => updateCharacter(character.id, { insanityPoints: { ...getSimplePointsObject(character.insanityPoints), notes: val } })} editing={isPointsEditing} onEdit={() => setIsPointsEditing(true)} onSave={handleSavePoints} isCompactView={isCompactView} hideNotes={hideNotes} showEditButtons={showEditButtons}>
                              <div className="flex items-center justify-center gap-1">
                                {isPointsEditing ? ( 
                                  <Input type="number" value={editablePoints.insanityPoints.total} onChange={e => handleSimplePointsChange('insanityPoints', 'total', e.target.value)} className="h-6 w-12 text-xs px-1 text-center mx-auto"/> 
                                ) : ( 
                                  <div className="flex items-center justify-center gap-1">
                                    <Button size="icon" variant="outline" className="h-5 w-5" onClick={() => handlePointChange('insanityPoints', -1)}><Minus className="h-3 w-3" /></Button>
                                    <span className="font-bold text-sm min-w-[1.2rem] text-center">{getSimplePointsObject(character.insanityPoints).total}</span>
                                    <Button size="icon" variant="outline" className="h-5 w-5" onClick={() => handlePointChange('insanityPoints', 1)}><Plus className="h-3 w-3" /></Button>
                                  </div>
                                )}
                              </div>
                            </MetricBox>
                            <MetricBox title={t('corruption')} notes={getSimplePointsObject(character.corruptionPoints).notes} onNoteChange={(val) => updateCharacter(character.id, { corruptionPoints: { ...getSimplePointsObject(character.corruptionPoints), notes: val } })} editing={isPointsEditing} onEdit={() => setIsPointsEditing(true)} onSave={handleSavePoints} isCompactView={isCompactView} hideNotes={hideNotes} showEditButtons={showEditButtons}>
                              <div className="flex items-center justify-center gap-1">
                                {isPointsEditing ? ( 
                                  <Input type="number" value={editablePoints.corruptionPoints.total} onChange={e => handleSimplePointsChange('corruptionPoints', 'total', e.target.value)} className="h-6 w-12 text-xs px-1 text-center mx-auto"/> 
                                ) : ( 
                                  <div className="flex items-center justify-center gap-1">
                                    <Button size="icon" variant="outline" className="h-5 w-5" onClick={() => handlePointChange('corruptionPoints', -1)}><Minus className="h-3 w-3" /></Button>
                                    <span className="font-bold text-sm min-w-[1.2rem] text-center">{getSimplePointsObject(character.corruptionPoints).total}</span>
                                    <Button size="icon" variant="outline" className="h-5 w-5" onClick={() => handlePointChange('corruptionPoints', 1)}><Plus className="h-3 w-3" /></Button>
                                  </div>
                                )}
                              </div>
                            </MetricBox>
                        </div>
                    </div>
                </div>
            )}
            <div className={cn("grid grid-cols-1 lg:grid-cols-12 gap-6", isCompactView && !['info-section', 'progression-section'].includes(activeCompactSection) && 'hidden')}>
                 <div className={cn("lg:col-span-7", isCompactView && activeCompactSection !== 'info-section' && 'hidden')}>
                    <Card id="info-section">
                        <Accordion type="single" collapsible className="w-full" defaultValue="info">
                            <AccordionItem value="info" className="border-b-0">
                                <AccordionPrimitive.Header className={cn("flex w-full items-center justify-between pb-4", isCompactView ? "px-4 pt-2" : "px-6 pt-3")}>
                                    <AccordionPrimitive.Trigger className="flex flex-1 items-center justify-between font-medium transition-all hover:no-underline [&[data-state=open]>svg]:rotate-180"><CardTitle className={cn("font-headline", isCompactView ? "text-lg" : "text-2xl")}>{t('info')}</CardTitle><ChevronDown className="h-4 w-4 shrink-0 transition-transform duration-200" /></AccordionPrimitive.Trigger>
                                    <div className="ml-4">{(showEditButtons || isInfoProgressionEditing) && <EditSaveButton editing={isInfoProgressionEditing} onEdit={() => setIsInfoProgressionEditing(true)} onSave={() => setIsInfoProgressionEditing(false)} />}</div>
                                </AccordionPrimitive.Header>
                                <AccordionContent className={cn("pt-0", isCompactView ? "px-4 pb-4" : "px-6 pb-6")}>
                                    <div className="grid grid-cols-2 md:grid-cols-3 3xl:grid-cols-4 gap-x-4 gap-y-4">
                                        <DetailField label="Character Name" value={character.name} editing={isInfoProgressionEditing} onBlur={(e) => updateCharacter(character.id, { name: e.target.value })} isCompactView={isCompactView} />
                                        <div className="space-y-1"><Label className={cn("text-xs text-muted-foreground", isCompactView && "text-[10px]")}>{t('homeWorld')}</Label><p className={cn("text-sm font-medium break-words", isCompactView && "text-xs")}>{character.homeWorld || '-'}</p></div>
                                        <div className="space-y-1"><Label className={cn("text-xs text-muted-foreground", isCompactView && "text-[10px]")}>{worldVariantLabel}</Label>{isInfoProgressionEditing ? ( <Select defaultValue={character.worldVariant} onValueChange={(value) => updateCharacter(character.id, { worldVariant: value })}><SelectTrigger className="h-8 text-xs"><SelectValue placeholder="Select variant..." /></SelectTrigger><SelectContent>{(character.homeWorld ? WORLD_VARIANTS_BY_HOMEWORLD[character.homeWorld] || [] : []).map(v => ( <SelectItem key={v} value={v}>{v}</SelectItem> ))}</SelectContent></Select> ) : ( <p className={cn("text-sm font-medium break-words", isCompactView && "text-xs")}>{character.worldVariant || '-'}</p> )}</div>
                                        <div className="space-y-1"><Label className={cn("text-xs text-muted-foreground", isCompactView && "text-[10px]")}>{t('careerPath')}</Label><p className={cn("text-sm font-medium break-words", isCompactView && "text-xs")}>{character.careerPath || '-'}</p></div>
                                        <div className="space-y-1"><Label className={cn("text-xs text-muted-foreground", isCompactView && "text-[10px]")}>{t('characterClass')}</Label><p className={cn("text-sm font-medium break-words", isCompactView && "text-xs")}>{character.characterClass || '-'}</p></div>
                                        <div className="space-y-1"><Label className={cn("text-xs text-muted-foreground", isCompactView && "text-[10px]")}>{t('rank')}</Label><div className="flex items-center gap-2"><p className={cn("text-sm font-medium break-words", isCompactView && "text-xs")}>{currentRankName}</p>{editableTotalExpSpent >= advancedPathThreshold && !(editableAdvancedPath ?? character.advancedPath) && ( <Button size="sm" variant="outline" onClick={() => setIsAdvancedPathModalOpen(true)}>Select Path</Button> )}{canChooseAlternateRank && ( <Button size="sm" variant="outline" onClick={() => setIsAlternateRankModalOpen(true)}>Select Rank</Button> )}</div></div>
                                        <DetailField label={t('divination')} value={character.divination} editing={isInfoProgressionEditing} onBlur={(e) => updateCharacter(character.id, { divination: e.target.value })} isCompactView={isCompactView} />
                                        <DetailField label={t('divinationEffect')} value={character.divinationEffect} editing={false} isCompactView={isCompactView} />
                                        <DetailField label={t('quirk')} value={character.quirk} editing={isInfoProgressionEditing} onBlur={(e) => updateCharacter(character.id, { quirk: e.target.value })} isCompactView={isCompactView} />
                                        <DetailField label={t('height')} value={character.height} editing={isInfoProgressionEditing} onBlur={(e) => updateCharacter(character.id, { height: e.target.value })} isCompactView={isCompactView} />
                                        <DetailField label={t('weight')} value={character.weight} editing={isInfoProgressionEditing} onBlur={(e) => updateCharacter(character.id, { weight: e.target.value })} isCompactView={isCompactView} />
                                        <DetailField label={t('age')} value={character.age} editing={isInfoProgressionEditing} onBlur={(e) => updateCharacter(character.id, { age: e.target.value })} isCompactView={isCompactView} />
                                        <DetailField label={t('skinColor')} value={character.skinColor} editing={isInfoProgressionEditing} onBlur={(e) => updateCharacter(character.id, { skinColor: e.target.value })} isCompactView={isCompactView} />
                                        <DetailField label={t('hairColor')} value={character.hairColor} editing={isInfoProgressionEditing} onBlur={(e) => updateCharacter(character.id, { hairColor: e.target.value })} isCompactView={isCompactView} />
                                        <DetailField label={t('eyeColor')} value={character.eyeColor} editing={isInfoProgressionEditing} onBlur={(e) => updateCharacter(character.id, { eyeColor: e.target.value })} isCompactView={isCompactView} />
                                    </div>
                                    <Accordion type="multiple" className="w-full mt-4 -mx-6 px-6 border-t pt-4">
                                        <AccordionItem value="backstory" className="border-b-0"><AccordionPrimitive.Trigger className="py-2 hover:no-underline font-semibold flex flex-1 items-center justify-between"><span>{t('backstory')}</span><ChevronDown className="h-4 w-4 shrink-0 transition-transform duration-200" /></AccordionPrimitive.Trigger><AccordionContent className="pt-2">{isInfoProgressionEditing ? ( <Textarea defaultValue={character.backstory} onBlur={(e) => updateCharacter(character.id, { backstory: e.target.value })} className={cn("min-h-[150px]", isCompactView ? "text-xs" : "text-sm")} /> ) : (<p className={cn("whitespace-pre-wrap", isCompactView ? "text-xs" : "text-sm text-muted-foreground")}>{character.backstory}</p>)}</AccordionContent></AccordionItem>
                                        <AccordionItem value="notes" className="border-b-0"><AccordionPrimitive.Trigger className="py-2 hover:no-underline font-semibold flex flex-1 items-center justify-between"><span>{t('notes')}</span><ChevronDown className="h-4 w-4 shrink-0 transition-transform duration-200" /></AccordionPrimitive.Trigger><AccordionContent className="pt-2">{isInfoProgressionEditing ? ( <Textarea defaultValue={character.notes} onBlur={(e) => updateCharacter(character.id, { notes: e.target.value })} placeholder="General notes about this character..." className={cn("min-h-[100px]", isCompactView ? "text-xs" : "text-sm")} /> ) : (<p className={cn("whitespace-pre-wrap", isCompactView ? "text-xs" : "text-sm text-muted-foreground")}>{character.notes || '-'}</p>)}</AccordionContent></AccordionItem>
                                    </Accordion>
                                </AccordionContent>
                            </AccordionItem>
                        </Accordion>
                    </Card>
                </div>
                 <div className={cn("lg:col-span-2", isCompactView && activeCompactSection !== 'progression-section' && 'hidden')}>
                    <Card id="progression-section">
                        <Accordion type="single" collapsible className="w-full" defaultValue="progression">
                            <AccordionItem value="progression" className="border-b-0">
                                <AccordionPrimitive.Trigger className={cn("hover:no-underline flex flex-1 items-center justify-between pb-4", isCompactView ? "px-4 pt-2" : "px-6 pt-3")}><CardTitle className={cn("font-headline", isCompactView ? "text-lg" : "text-2xl")}>{t('progression')}</CardTitle><ChevronDown className="h-4 w-4 shrink-0 transition-transform duration-200" /></AccordionPrimitive.Trigger>
                                <AccordionContent className={cn("pt-0", isCompactView ? "px-4 pb-4" : "px-6 pb-6")}>
                                    <div className="flex flex-col space-y-4">
                                        <div className="space-y-1"><Label htmlFor="current-exp-edit" className="text-xs text-muted-foreground">{t('currentExp')}</Label><Input id="current-exp-edit" type="number" value={editableExperience} onChange={(e) => setEditableExperience(parseInt(e.target.value, 10) || 0)} onBlur={() => { if (editableExperience !== character.experience) updateCharacter(character.id, { experience: editableExperience }); }} className="h-9"/></div>
                                        <div className="space-y-2"><Label htmlFor="spend-exp-amount">{t('spendExp')}</Label><div className="flex items-center gap-2"><Button size="icon" variant="outline" className="h-9 w-9 shrink-0" onClick={() => setAmountToSpend(Math.max(0, amountToSpend - 50))}><Minus className="h-4 w-4" /></Button><Input id="spend-exp-amount" type="number" value={amountToSpend} onChange={(e) => setAmountToSpend(Math.max(0, parseInt(e.target.value, 10) || 0))} className="h-9 text-center" /><Button size="icon" variant="outline" className="h-9 w-9 shrink-0" onClick={() => setAmountToSpend(amountToSpend + 50)}><Plus className="h-4 w-4" /></Button></div></div>
                                        <Button onClick={handleSpendExp} disabled={amountToSpend <= 0 || amountToSpend > editableExperience} className="w-full">{t('spendExp')}</Button>
                                        <div className="space-y-1"><Label htmlFor="total-exp-edit" className="text-xs text-muted-foreground">{t('totalExpSpent')}</Label><Input id="total-exp-edit" type="number" value={editableTotalExpSpent} onChange={handleTotalExpChange} onBlur={handleSaveTotalExp} className="h-9"/></div>
                                    </div>
                                </AccordionContent>
                            </AccordionItem>
                        </Accordion>
                    </Card>
                </div>
                {!isCompactView && ( <div className="hidden lg:block lg:col-span-3 overflow-hidden"><ArmorDisplay character={character} isCompactView={isCompactView} /></div> )}
            </div>
      
            <div className={cn("flex flex-row items-stretch gap-2 md:gap-6", isCompactView && !['skills-section', 'talents-section', 'equipment-section', 'inventory-section'].includes(activeCompactSection) && 'hidden' )}>
                 <div className={cn("transition-all duration-300 ease-in-out", isCompactView ? ( !['skills-section', 'talents-section'].includes(activeCompactSection) ? 'hidden' : 'flex-1' ) : (isSkillsPanelCollapsed ? "w-12 flex-shrink-0" : "flex-1 min-w-0"))}>
                    {isSkillsPanelCollapsed && !isCompactView ? ( <Card className="flex items-center justify-center h-full"><Button variant="ghost" className="h-full w-full py-4" onClick={() => setIsSkillsPanelCollapsed(false)}><span className="[writing-mode:vertical-rl] transform rotate-180 whitespace-nowrap text-center text-sm font-semibold tracking-widest uppercase text-muted-foreground">{t('skills')}, {t('talentsAndTraits')}, {t('wounds')} &amp; {t('fate')}</span></Button></Card> ) : (
                        <Card>
                            <CardHeader className="flex-row items-center justify-between px-6 pt-3 pb-6"><CardTitle className="font-headline">{t('skills')}, {t('talentsAndTraits')}, {t('wounds')} &amp; {t('fate')}</CardTitle><Button variant="ghost" size="icon" onClick={() => setIsSkillsPanelCollapsed(true)} aria-label="Collapse Panel" className={cn(isCompactView && 'hidden')}><ChevronLeft className="h-5 w-5" /></Button></CardHeader>
                            <CardContent className="pt-0 space-y-8">
                                <div id="skills-section" className={cn(isCompactView && activeCompactSection !== 'skills-section' && 'hidden')}>
                                    <div className="flex flex-row items-center justify-between mb-4"><h3 className="font-headline text-lg font-semibold">{t('skills')}</h3>{(showEditButtons || isSkillsEditing) && <EditSaveButton editing={isSkillsEditing} onEdit={() => setIsSkillsEditing(true)} onSave={handleSaveSkills} />}</div>
                                    <div className="grid grid-cols-1 md:grid-cols-2 gap-x-8">
                                        <div className="mb-6 md:mb-0">
                                            <h4 className="font-semibold mb-2 text-muted-foreground">{t('basic')}</h4>
                                            <div className="border rounded-lg overflow-hidden">
                                                <Table>
                                                    <TableHeader>
                                                        <TableRow>
                                                            <TableHead className={cn("w-[40px]", isCompactView && "p-1")}>{t('notes')}</TableHead>
                                                            <TableHead className={cn("w-2/5", isCompactView && "text-xs p-2")}>{t('name')}</TableHead>
                                                            <TableHead className={cn("text-center px-1 w-[60px]", isCompactView && "text-xs p-1")}>{t('skilled')}</TableHead>
                                                            <TableHead className={cn("text-center px-1 w-[60px]", isCompactView && "text-xs p-1")}>+10</TableHead>
                                                            <TableHead className={cn("text-center px-1 w-[60px]", isCompactView && "text-xs p-1")}>+20</TableHead>
                                                            {isSkillsEditing && <TableHead className={cn(isCompactView && "p-1")}></TableHead>}
                                                        </TableRow>
                                                    </TableHeader>
                                                    <TableBody>
                                                        {basicSkills.map((skill) => ( 
                                                            <TableRow key={skill.id}>
                                                                <TableCell className={cn(isCompactView && "p-1")}>
                                                                    {!hideNotes && (
                                                                        <Popover>
                                                                            <PopoverTrigger asChild>
                                                                                <Button variant={skill.notes ? 'secondary' : 'ghost'} size="icon" className="h-7 w-7"><InfoIcon className="h-4 w-4" /></Button>
                                                                            </PopoverTrigger>
                                                                            <PopoverContent className="w-64">
                                                                                <Label className="text-xs mb-2 block">Notes for {skill.name}</Label>
                                                                                <Textarea defaultValue={skill.notes || ''} onBlur={(e) => updateCharacter(character.id, { skills: (character.skills || []).map(s => s.id === skill.id ? {...s, notes: e.target.value} : s) })} placeholder="Add notes..." className="mt-2 min-h-[100px] text-sm" />
                                                                            </PopoverContent>
                                                                        </Popover>
                                                                    )}
                                                                </TableCell>
                                                                <TableCell className={cn(isCompactView && "p-2")}>
                                                                    {isSkillsEditing ? ( 
                                                                        <Input defaultValue={skill.name} onChange={(e) => setEditableSkills(editableSkills.map(s => s.id === skill.id ? {...s, name: e.target.value} : s))} className="h-8 text-xs"/> 
                                                                    ) : ( 
                                                                        <p className={cn("font-medium whitespace-normal break-words", isCompactView && "text-xs")}>{skill.name}</p> 
                                                                    )}
                                                                </TableCell>
                                                                <TableCell className={cn("text-center", isCompactView && "p-1")}><Checkbox checked={skill.training.skilled} disabled={!isSkillsEditing} onCheckedChange={(c) => handleSkillTrainingUpdate(skill.id, 'skilled', !!c)} /></TableCell>
                                                                <TableCell className={cn("text-center", isCompactView && "p-1")}><Checkbox checked={skill.training.plus10} disabled={!isSkillsEditing || !skill.training.skilled} onCheckedChange={(c) => handleSkillTrainingUpdate(skill.id, 'plus10', !!c)} /></TableCell>
                                                                <TableCell className={cn("text-center", isCompactView && "p-1")}><Checkbox checked={skill.training.plus20} disabled={!isSkillsEditing || !skill.training.plus10} onCheckedChange={(c) => handleSkillTrainingUpdate(skill.id, 'plus20', !!c)} /></TableCell>
                                                                {isSkillsEditing && ( <TableCell className={cn(isCompactView && "p-1")}><Button variant="ghost" size="icon" className="h-7 w-7" onClick={() => setEditableSkills(editableSkills.filter((s) => s.id !== skill.id))}><Trash2 className="h-4 w-4 text-destructive" /></Button></TableCell> )}
                                                            </TableRow> 
                                                        ))}
                                                    </TableBody>
                                                </Table>
                                            </div>
                                            {isSkillsEditing && <div className="flex gap-2 mt-4"><Input placeholder="New basic skill" value={newBasicSkillName} onChange={(e) => setNewBasicSkillName(e.target.value)} /><Button onClick={addBasicSkill} size="sm"><Plus className="mr-2 h-4 w-4" /> {t('add')}</Button></div>}
                                        </div>
                                        <div>
                                            <h4 className="font-semibold mb-2 text-muted-foreground">{t('advanced')}</h4>
                                            <div className="border rounded-lg overflow-hidden">
                                                <Table>
                                                    <TableHeader>
                                                        <TableRow>
                                                            <TableHead className={cn("w-[40px]", isCompactView && "p-1")}>{t('notes')}</TableHead>
                                                            <TableHead className={cn("w-2/5", isCompactView && "text-xs p-2")}>{t('name')}</TableHead>
                                                            <TableHead className={cn("text-center px-1 w-[60px]", isCompactView && "text-xs p-1")}>{t('skilled')}</TableHead>
                                                            <TableHead className={cn("text-center px-1 w-[60px]", isCompactView && "text-xs p-1")}>+10</TableHead>
                                                            <TableHead className={cn("text-center px-1 w-[60px]", isCompactView && "text-xs p-1")}>+20</TableHead>
                                                            {isSkillsEditing && <TableHead className={cn(isCompactView && "p-1")}></TableHead>}
                                                        </TableRow>
                                                    </TableHeader>
                                                    <TableBody>
                                                        {advancedSkills.map((skill) => ( 
                                                            <TableRow key={skill.id}>
                                                                <TableCell className={cn(isCompactView && "p-1")}>
                                                                    {!hideNotes && (
                                                                        <Popover>
                                                                            <PopoverTrigger asChild>
                                                                                <Button variant={skill.notes ? 'secondary' : 'ghost'} size="icon" className="h-7 w-7"><InfoIcon className="h-4 w-4" /></Button>
                                                                            </PopoverTrigger>
                                                                            <PopoverContent className="w-64">
                                                                                <Label className="text-xs mb-2 block">Notes for {skill.name}</Label>
                                                                                <Textarea defaultValue={skill.notes || ''} onBlur={(e) => updateCharacter(character.id, { skills: (character.skills || []).map(s => s.id === skill.id ? {...s, notes: e.target.value} : s) })} placeholder="Add notes..." className="mt-2 min-h-[100px] text-sm" />
                                                                            </PopoverContent>
                                                                        </Popover>
                                                                    )}
                                                                </TableCell>
                                                                <TableCell className={cn(isCompactView && "p-2")}>
                                                                    {isSkillsEditing ? ( 
                                                                        <Input defaultValue={skill.name} onChange={(e) => setEditableSkills(editableSkills.map(s => s.id === skill.id ? {...s, name: e.target.value} : s))} className="h-8 text-xs"/> 
                                                                    ) : ( 
                                                                        <p className={cn("font-medium whitespace-normal break-words", isCompactView && "text-xs")}>{skill.name}</p> 
                                                                    )}
                                                                </TableCell>
                                                                <TableCell className={cn("text-center", isCompactView && "p-1")}><Checkbox checked={skill.training.skilled} disabled={!isSkillsEditing} onCheckedChange={(c) => handleSkillTrainingUpdate(skill.id, 'skilled', !!c)} /></TableCell>
                                                                <TableCell className={cn("text-center", isCompactView && "p-1")}><Checkbox checked={skill.training.plus10} disabled={!isSkillsEditing || !skill.training.skilled} onCheckedChange={(c) => handleSkillTrainingUpdate(skill.id, 'plus10', !!c)} /></TableCell>
                                                                <TableCell className={cn("text-center", isCompactView && "p-1")}><Checkbox checked={skill.training.plus20} disabled={!isSkillsEditing || !skill.training.plus10} onCheckedChange={(c) => handleSkillTrainingUpdate(skill.id, 'plus20', !!c)} /></TableCell>
                                                                {isSkillsEditing && ( <TableCell className={cn(isCompactView && "p-1")}><Button variant="ghost" size="icon" className="h-7 w-7" onClick={() => setEditableSkills(editableSkills.filter((s) => s.id !== skill.id))}><Trash2 className="h-4 w-4 text-destructive" /></Button></TableCell> )}
                                                            </TableRow> 
                                                        ))}
                                                    </TableBody>
                                                </Table>
                                            </div>
                                            {isSkillsEditing && <div className="flex gap-2 mt-4"><Input placeholder="New advanced skill" value={newAdvancedSkillName} onChange={(e) => setNewAdvancedSkillName(e.target.value)} /><Button onClick={addAdvancedSkill} size="sm"><Plus className="mr-2 h-4 w-4" /> {t('add')}</Button></div>}
                                        </div>
                                    </div>
                                </div>
                                <Separator className={cn(isCompactView && 'hidden')} />
                                <div id="talents-section" className={cn(isCompactView && activeCompactSection !== 'talents-section' && 'hidden')}>
                                    <div className="flex flex-row items-center justify-between mb-4"><h3 className="font-headline text-lg font-semibold">{t('talentsAndTraits')}</h3>{(showEditButtons || isTalentsEditing) && <EditSaveButton editing={isTalentsEditing} onEdit={() => setIsTalentsEditing(true)} onSave={handleSaveTalents} />}</div>
                                    {isTalentsEditing ? (
                                        <div className="space-y-4">
                                            <ul className="space-y-2">{(editableTalents ?? []).map(talent => ( 
                                                <li key={talent.id} className="flex items-center gap-2">
                                                    {!hideNotes && (
                                                        <Popover>
                                                            <PopoverTrigger asChild><Button variant={talent.notes ? 'secondary' : 'ghost'} size="icon" className="h-9 w-9 shrink-0"><InfoIcon className="h-4 w-4" /></Button></PopoverTrigger>
                                                            <PopoverContent className="w-64"><Label className="text-xs mb-2 block">Notes for {talent.name}</Label><Textarea defaultValue={talent.notes || ''} onBlur={(e) => setEditableTalents(editableTalents.map(t => t.id === talent.id ? {...t, notes: e.target.value} : t))} placeholder="Add notes..." className="mt-2 min-h-[100px] text-sm" /></PopoverContent>
                                                        </Popover>
                                                    )}
                                                    <Input defaultValue={talent.name} onChange={e => setEditableTalents(editableTalents.map(t => t.id === talent.id ? {...t, name: e.target.value} : t))} className="h-9"/>
                                                    <Button variant="ghost" size="icon" className="h-7 w-7 shrink-0" onClick={() => setEditableTalents(editableTalents.filter((t) => t.id !== talent.id))}><Trash2 className="h-4 w-4 text-destructive" /></Button>
                                                </li> 
                                            ))}</ul>
                                            <div className="flex gap-2"><Input placeholder="New talent/trait" value={newTalentName} onChange={(e) => setNewTalentName(e.target.value)} /><Button onClick={addTalent}><Plus className="mr-2 h-4 w-4" /> {t('add')}</Button></div>
                                        </div>
                                    ) : (
                                        <div className="space-y-2">{(character.talents ?? []).length > 0 ? character.talents.map(talent => ( 
                                            <div key={talent.id} className={cn("flex items-center gap-2", isCompactView ? "text-xs" : "text-sm")}>
                                                {!hideNotes && (
                                                    <Popover>
                                                        <PopoverTrigger asChild><Button variant={talent.notes ? 'secondary' : 'ghost'} size="icon" className="h-6 w-6 shrink-0"><InfoIcon className="h-4 w-4" /></Button></PopoverTrigger>
                                                        <PopoverContent className="w-64"><Label className="text-xs mb-2 block">Notes for {talent.name}</Label><Textarea defaultValue={talent.notes || ''} onBlur={(e) => updateCharacter(character.id, { talents: (character.talents || []).map(t => t.id === talent.id ? {...t, notes: e.target.value} : t)})} placeholder="Add notes..." className="mt-2 min-h-[100px] text-sm" /></PopoverContent>
                                                    </Popover>
                                                )}
                                                <p className="text-muted-foreground flex-grow break-words">&bull; {talent.name}</p>
                                            </div> 
                                        )) : <p className={cn("text-muted-foreground", isCompactView ? "text-xs" : "text-sm")}>No talents or traits.</p>}</div>
                                    )}
                                </div>
                                <Separator className={cn(isCompactView && 'hidden')} />
                                <div id="movement-section" className={cn(isCompactView && activeCompactSection !== 'talents-section' && 'hidden')}>
                                    <div className="flex flex-row items-center justify-between mb-4"><h3 className="font-headline text-lg font-semibold">{t('movement')}</h3>{(showEditButtons || isMovementEditing) && <EditSaveButton editing={isMovementEditing} onEdit={() => setIsMovementEditing(true)} onSave={handleSaveMovement} />}</div>
                                    <div className="grid grid-cols-2 md:grid-cols-4 gap-2">{[{ label: 'Walk (1/2 Action)', key: 'walkHalf' }, { label: 'Walk (Full Action)', key: 'walkFull' }, { label: 'Charge', key: 'charge' }, { label: 'Run', key: 'run' }].map((field) => ( <div key={field.key} className="flex flex-col items-center p-2 rounded-lg bg-background border"><div className="text-[10px] sm:text-xs text-muted-foreground text-center">{field.label}</div>{isMovementEditing ? ( <Input type="number" value={editableMovement[field.key as keyof typeof editableMovement]} onChange={(e) => setEditableMovement({ ...editableMovement, [field.key]: parseInt(e.target.value, 10) || 0 })} className="h-8 w-16 text-center mt-1"/> ) : ( <div className="text-xl font-bold">{character.movement?.[field.key as keyof typeof editableMovement] ?? 0}m</div> )}</div> ))}</div>
                                </div>
                                <Separator className={cn(isCompactView && 'hidden')} />
                                {!isCompactView && ( <div className="grid grid-cols-2 gap-4">
                                      <MetricBox title={t('wounds')} notes={getPointsObject(character.wounds).notes} onNoteChange={(val) => updateCharacter(character.id, { wounds: { ...getPointsObject(character.wounds), notes: val } })} editing={isPointsEditing} onEdit={() => setIsPointsEditing(true)} onSave={handleSavePoints} isCompactView={isCompactView} hideNotes={hideNotes} showEditButtons={showEditButtons}><div className="text-center flex flex-col justify-center items-center h-full">{isPointsEditing ? ( <div className="flex items-center justify-center gap-2"><Input type="number" value={editablePoints.wounds.current} onChange={e => handleNestedPointsChange('wounds', 'current', e.target.value)} className="text-lg font-bold h-8 w-16 text-center"/><span className="text-muted-foreground">/</span><Input type="number" value={editablePoints.wounds.max} onChange={e => handleNestedPointsChange('wounds', 'max', e.target.value)} className="text-lg font-bold h-8 w-16 text-center"/></div> ) : ( <div className="flex items-center justify-center gap-2"><Button size="icon" variant="outline" className="h-6 w-6" onClick={() => handlePointChange('wounds', -1)}><Minus className="h-4 w-4" /></Button><p className="text-2xl font-bold text-primary w-12 text-center">{getPointsObject(character.wounds).current}</p><Button size="icon" variant="outline" className="h-6 w-6" onClick={() => handlePointChange('wounds', 1)}><Plus className="h-4 w-4" /></Button><p className="text-xl font-medium text-muted-foreground ml-2">/ {getPointsObject(character.wounds).max}</p></div> )}</div></MetricBox>
                                      <MetricBox title={t('fate')} notes={getPointsObject(character.fatePoints).notes} onNoteChange={(val) => updateCharacter(character.id, { fatePoints: { ...getPointsObject(character.fatePoints), notes: val } })} editing={isPointsEditing} onEdit={() => setIsPointsEditing(true)} onSave={handleSavePoints} isCompactView={isCompactView} hideNotes={hideNotes} showEditButtons={showEditButtons}><div className="text-center flex flex-col justify-center items-center h-full">{isPointsEditing ? ( <div className="flex items-center justify-center gap-2"><Input type="number" value={editablePoints.fatePoints.current} onChange={e => handleNestedPointsChange('fatePoints', 'current', e.target.value)} className="text-lg font-bold h-8 w-16 text-center"/><span className="text-muted-foreground">/</span><Input type="number" value={editablePoints.fatePoints.max} onChange={e => handleNestedPointsChange('fatePoints', 'max', e.target.value)} className="text-lg font-bold h-8 w-16 text-center"/></div> ) : ( <div className="flex items-center justify-center gap-2"><Button size="icon" variant="outline" className="h-6 w-6" onClick={() => handlePointChange('fatePoints', -1)}><Minus className="h-4 w-4" /></Button><p className="text-2xl font-bold text-primary w-12 text-center">{getPointsObject(character.fatePoints).current}</p><Button size="icon" variant="outline" className="h-6 w-6" onClick={() => handlePointChange('fatePoints', 1)}><Plus className="h-4 w-4" /></Button><p className="text-xl font-medium text-muted-foreground ml-2">/ {getPointsObject(character.fatePoints).max}</p></div> )}</div></MetricBox>
                                  </div> )}
                            </CardContent>
                        </Card>
                    )}
                </div>

                {!isCompactView && (
                <div className={cn("transition-all duration-300 ease-in-out flex-shrink-0", (isSkillsPanelCollapsed && isEquipmentPanelCollapsed) ? "flex-1" : "w-auto")}>
                    <Card><CardHeader className="flex flex-row items-center justify-between px-6 pt-3 pb-6"><CardTitle className="font-headline">{t('characteristics')}</CardTitle>{(showEditButtons || isCharacteristicsEditing) && <EditSaveButton editing={isCharacteristicsEditing} onEdit={() => setIsCharacteristicsEditing(true)} onSave={handleSaveCharacteristics} />}</CardHeader><CardContent className={cn("space-y-2", (isSkillsPanelCollapsed && isEquipmentPanelCollapsed) ? "grid grid-cols-2 sm:grid-cols-3 md:grid-cols-5 gap-2 !space-y-0" : "grid grid-cols-1 gap-2")}>{characteristics.map(char => ( <CharacteristicStat key={char.key} label={char.label} fullName={char.fullName} value={isCharacteristicsEditing ? editableStats[char.key] : character.stats[char.key]} upgrades={isCharacteristicsEditing ? editableStatUpgrades[char.key] : (character.statUpgrades ? character.statUpgrades[char.key] : [false, false, false, false])} editing={isCharacteristicsEditing} onValueChange={e => setEditableStats(prev => ({ ...prev, [char.key]: parseInt(e.target.value, 10) || 0 }))} onUpgradeChange={(index, checked) => handleUpgradeChange(char.key, index, checked)} notes={character.statNotes?.[char.key]} onNoteChange={(note) => { const next = { ...(character.statNotes || {}), [char.key]: note }; updateCharacter(character.id, { statNotes: next }); }} isCompactView={isCompactView} hideNotes={hideNotes} /> ))}</CardContent></Card>
                </div>
                )}
                
                <div className={cn("transition-all duration-300 ease-in-out", isCompactView ? ( !['equipment-section', 'inventory-section'].includes(activeCompactSection) ? 'hidden' : 'flex-1' ) : (isEquipmentPanelCollapsed ? "w-12 flex-shrink-0" : "flex-1 min-w-0"))}>
                    {isEquipmentPanelCollapsed && !isCompactView ? ( <Card className="flex items-center justify-center h-full"><Button variant="ghost" className="h-full w-full py-4" onClick={() => setIsEquipmentPanelCollapsed(false)}><span className="[writing-mode:vertical-rl] transform rotate-180 whitespace-nowrap text-center text-sm font-semibold tracking-widest uppercase text-muted-foreground">{t('equipment')}, {t('inventory')} &amp; {t('corruption')}</span></Button></Card> ) : (
                        <Card>
                             <CardHeader className={cn("flex-row items-center justify-between px-6 pt-3 pb-6", isCompactView && "hidden")}><CardTitle className="font-headline">{t('equipment')}, {t('inventory')} &amp; {t('corruption')}</CardTitle><Button variant="ghost" size="icon" onClick={() => setIsEquipmentPanelCollapsed(true)} aria-label="Collapse Panel"><ChevronRight className="h-5 w-5" /></Button></CardHeader>
                            <CardContent className="pt-0 space-y-8">
                                <div className={cn(isCompactView && activeCompactSection !== 'equipment-section' && 'hidden')}>
                                    <Collapsible id="equipment-section" open={isEquipmentSectionOpen} onOpenChange={setIsEquipmentSectionOpen} className="border rounded-lg overflow-hidden">
                                        <div className="flex items-center pr-4 border-b"><h3 className="flex-1 px-6 py-4 text-lg font-semibold leading-none tracking-tight font-headline">{t('equipment')}</h3><CollapsibleTrigger asChild><Button size="icon" variant="ghost"><ChevronRight className={cn("h-4 w-4 transition-transform", isEquipmentSectionOpen && "rotate-90")} /><span className="sr-only">Toggle Equipment</span></Button></CollapsibleTrigger></div>
                                        <CollapsibleContent>
                                            <div className="p-6 space-y-6">
                                                <div>
                                                    <Collapsible open={!isCompactView || isArmorExpanded} onOpenChange={setIsArmorExpanded}>
                                                        <div className="flex items-center justify-between mb-2">
                                                            <CollapsibleTrigger asChild disabled={!isCompactView}>
                                                                <div className={cn("flex items-center gap-2", isCompactView && "cursor-pointer")}>
                                                                    <h4 className="font-semibold text-lg">{t('armor')}</h4>
                                                                    {isCompactView && <ChevronDown className={cn("h-4 w-4 transition-transform", isArmorExpanded && "rotate-180")} />}
                                                                </div>
                                                            </CollapsibleTrigger>
                                                            {(showEditButtons || isArmorEditing) && <EditSaveButton editing={isArmorEditing} onEdit={() => setIsArmorEditing(true)} onSave={handleSaveArmor} />}
                                                        </div>
                                                        <CollapsibleContent forceMount={!isCompactView}>
                                                            {isCompactView ? ( 
                                                                <div className="space-y-2">{bodyParts.map(part => { const armorPiece = currentEquipment.armor[part]; const title = part.replace(' arm', ' Arm').replace(' leg', ' Leg'); return ( <div key={part} className="border rounded-lg p-3 space-y-2 bg-background/50"><h5 className="font-semibold">{title} ({bodyPartLocations[part]})</h5><div className="grid grid-cols-2 gap-x-4 gap-y-2 text-xs">{isArmorEditing ? ( <><div className="space-y-1"><Label>AP</Label><Input type="number" className="h-7 text-xs" value={armorPiece?.ap ?? ''} onChange={e => handleArmorChange(part, 'ap', e.target.value)} /></div><div className="space-y-1"><Label>Type</Label><Select value={armorPiece?.type ?? ''} onValueChange={(value) => handleArmorChange(part, 'type', value)}><SelectTrigger className="h-7 text-xs"><SelectValue placeholder="Type..." /></SelectTrigger><SelectContent>{ARMOR_TYPES.map((type) => ( <SelectItem key={type} value={type}>{type}</SelectItem> ))}</SelectContent></Select></div><div className="col-span-2 space-y-1"><Label>Mods</Label><Input className="h-7 text-xs" value={armorPiece?.mods ?? ''} onChange={e => handleArmorChange(part, 'mods', e.target.value)} /></div><div className="col-span-2 space-y-1"><Label>Quality</Label><Input className="h-7 text-xs" value={armorPiece?.quality ?? ''} onChange={e => handleArmorChange(part, 'quality', e.target.value)} /></div></> ) : ( <><div><strong className="text-muted-foreground">AP:</strong> {armorPiece?.ap ?? '-'}</div><div><strong className="text-muted-foreground">Type:</strong> {armorPiece?.type ?? '-'}</div><div className="col-span-2"><strong className="text-muted-foreground">Mods:</strong> {armorPiece?.mods ?? '-'}</div><div className="col-span-2"><strong className="text-muted-foreground">Quality:</strong> {armorPiece?.quality ?? '-'}</div></> )}</div></div> ) })}</div> 
                                                            ) : ( 
                                                                <div className="border rounded-lg p-2"><Table><TableHeader><TableRow><TableHead>Location</TableHead><TableHead>AP</TableHead><TableHead>Type</TableHead><TableHead>Mods</TableHead><TableHead>Quality</TableHead></TableRow></TableHeader><TableBody>{bodyParts.map(part => { const armorPiece = currentEquipment.armor[part]; return ( <TableRow key={part}><TableCell className="font-medium">{part}</TableCell>{isArmorEditing ? ( <><TableCell><Input type="number" className="h-8 w-16" value={armorPiece?.ap ?? ''} onChange={e => handleArmorChange(part, 'ap', e.target.value)}/></TableCell><TableCell><Select value={armorPiece?.type ?? ''} onValueChange={(value) => handleArmorChange(part, 'type', value)}><SelectTrigger className="h-8"><SelectValue placeholder="Select type..." /></SelectTrigger><SelectContent>{ARMOR_TYPES.map((type) => ( <SelectItem key={type} value={type}>{type}</SelectItem> ))}</SelectContent></Select></TableCell><TableCell><Input className="h-8" value={armorPiece?.mods ?? ''} onChange={e => handleArmorChange(part, 'mods', e.target.value)} /></TableCell><TableCell><Input className="h-8" value={armorPiece?.quality ?? ''} onChange={e => handleArmorChange(part, 'quality', e.target.value)}/></TableCell></> ) : ( <><TableCell>{armorPiece?.ap ?? '-'}</TableCell><TableCell>{armorPiece?.type ?? '-'}</TableCell><TableCell>{armorPiece?.mods ?? '-'}</TableCell><TableCell>{armorPiece?.quality ?? '-'}</TableCell></> )}</TableRow> ); })}</TableBody></Table></div> 
                                                            )}
                                                        </CollapsibleContent>
                                                    </Collapsible>
                                                </div>
                                                <div className="space-y-4">
                                                    <div>
                                                        <div className="flex items-center justify-between mb-2"><h4 className="font-semibold text-lg">{t('meleeWeapons')}</h4>{(showEditButtons || isMeleeWeaponsEditing) && <EditSaveButton editing={isMeleeWeaponsEditing} onEdit={() => setIsMeleeWeaponsEditing(true)} onSave={handleSaveMeleeWeapons} />}</div>
                                                        <div className="space-y-2">
                                                            {equippedMeleeWeapons.map(weapon => ( 
                                                                <div key={weapon.id} className="border rounded-lg p-3 space-y-2 bg-background/50">
                                                                    <div className="flex justify-between items-start">
                                                                        {isMeleeWeaponsEditing ? ( <Input defaultValue={weapon.name} onChange={(e) => handleMeleeWeaponChange(weapon.id, 'name', e.target.value)} className="h-8 font-semibold text-sm"/> ) : ( <h5 className="font-semibold break-words text-sm">{weapon.name}</h5> )}
                                                                        <div className="flex items-center gap-1 flex-shrink-0 ml-2">
                                                                            {!hideNotes && (
                                                                                <Popover>
                                                                                    <PopoverTrigger asChild>
                                                                                        <Button variant={weapon.notes ? 'secondary' : 'ghost'} size="icon" className="h-7 w-7"><InfoIcon className="h-4 w-4" /></Button>
                                                                                    </PopoverTrigger>
                                                                                    <PopoverContent className="w-64">
                                                                                        <Label className="text-xs mb-2 block">Notes for {weapon.name}</Label>
                                                                                        <Textarea defaultValue={weapon.notes || ''} {...(isMeleeWeaponsEditing ? {onChange: (e) => handleMeleeWeaponChange(weapon.id, 'notes', e.target.value)} : {onBlur: (e) => updateCharacter(character.id, { equipment: {...character.equipment, weapons: {...character.equipment.weapons, melee: (character.equipment.weapons.melee ?? []).map(w => w.id === weapon.id ? {...w, notes: e.target.value} : w) } }})})} placeholder="Add notes..." className="mt-2 min-h-[100px] text-sm" />
                                                                                    </PopoverContent>
                                                                                </Popover>
                                                                            )}
                                                                            {isMeleeWeaponsEditing && ( <Button variant="ghost" size="icon" className="h-7 w-7" onClick={() => removeMeleeWeapon(weapon.id)}><Trash2 className="h-4 w-4 text-destructive" /></Button> )}
                                                                        </div>
                                                                    </div>
                                                                    <div className="grid grid-cols-2 gap-x-4 gap-y-1 text-xs">
                                                                        {isMeleeWeaponsEditing ? ( 
                                                                            <><div className="space-y-1"> <Label>Type</Label> <Input defaultValue={weapon.type} onChange={e => handleMeleeWeaponChange(weapon.id, 'type', e.target.value)} className="h-7 text-xs"/> </div><div className="space-y-1"> <Label>Range</Label> <Input defaultValue={weapon.range} onChange={e => handleMeleeWeaponChange(weapon.id, 'range', e.target.value)} className="h-7 text-xs"/> </div><div className="space-y-1"> <Label>Damage</Label> <Input defaultValue={weapon.damage} onChange={e => handleMeleeWeaponChange(weapon.id, 'damage', e.target.value)} className="h-7 text-xs"/> </div><div className="space-y-1"> <Label>Penetration</Label> <Input defaultValue={weapon.penetration} onChange={e => handleMeleeWeaponChange(weapon.id, 'penetration', e.target.value)} className="h-7 text-xs"/> </div><div className="col-span-2 space-y-1"> <Label>Traits</Label> <Input defaultValue={weapon.traits} onChange={e => handleMeleeWeaponChange(weapon.id, 'traits', e.target.value)} className="h-7 text-xs"/> </div></> 
                                                                        ) : ( 
                                                                            <><div><strong className="text-muted-foreground">Type:</strong> {weapon.type || '-'}</div><div><strong className="text-muted-foreground">Range:</strong> {weapon.range || '-'}</div><div><strong className="text-muted-foreground">Dmg:</strong> {weapon.damage || '-'}</div><div><strong className="text-muted-foreground">Pen:</strong> {weapon.penetration || '-'}</div><div className="col-span-2"><strong className="text-muted-foreground">Traits:</strong> <span className="break-words">{weapon.traits || '-'}</span></div></> 
                                                                        )}
                                                                    </div>
                                                                    <div className="flex items-center space-x-2 pt-2">
                                                                        <Checkbox checked={!!weapon.equipped} onCheckedChange={(c) => isMeleeWeaponsEditing ? handleMeleeWeaponChange(weapon.id, 'equipped', !!c) : updateCharacter(character.id, { equipment: {...character.equipment, weapons: {...character.equipment.weapons, melee: (character.equipment.weapons.melee ?? []).map(w => w.id === weapon.id ? {...w, equipped: !!c} : w) } }})} />
                                                                        <Label className="text-xs">{t('equipped')}</Label>
                                                                    </div>
                                                                </div> 
                                                            ))}
                                                        </div>
                                                    </div>
                                                    <Accordion type="single" collapsible className="w-full">
                                                        <AccordionItem value="unequipped-melee" className="border-b-0">
                                                            <AccordionPrimitive.Trigger className="flex flex-1 items-center justify-between py-2 text-sm font-medium"><span>{t('notEquipped')}</span><ChevronDown className="h-4 w-4 shrink-0 transition-transform duration-200" /></AccordionPrimitive.Trigger>
                                                            <AccordionContent>
                                                                <div className="space-y-2">
                                                                    {unequippedMeleeWeapons.map(weapon => ( 
                                                                        <div key={weapon.id} className="border rounded-lg p-3 space-y-2 bg-background/50">
                                                                            <div className="flex justify-between items-start">
                                                                                {isMeleeWeaponsEditing ? ( <Input defaultValue={weapon.name} onChange={(e) => handleMeleeWeaponChange(weapon.id, 'name', e.target.value)} className="h-8 font-semibold text-sm"/> ) : ( <h5 className="font-semibold break-words text-sm">{weapon.name}</h5> )}
                                                                                <div className="flex items-center gap-1 flex-shrink-0 ml-2">
                                                                                    {!hideNotes && (
                                                                                        <Popover>
                                                                                            <PopoverTrigger asChild>
                                                                                                <Button variant={weapon.notes ? 'secondary' : 'ghost'} size="icon" className="h-7 w-7"><InfoIcon className="h-4 w-4" /></Button>
                                                                                            </PopoverTrigger>
                                                                                            <PopoverContent className="w-64">
                                                                                                <Label className="text-xs mb-2 block">Notes for {weapon.name}</Label>
                                                                                                <Textarea defaultValue={weapon.notes || ''} {...(isMeleeWeaponsEditing ? {onChange: (e) => handleMeleeWeaponChange(weapon.id, 'notes', e.target.value)} : {onBlur: (e) => updateCharacter(character.id, { equipment: {...character.equipment, weapons: {...character.equipment.weapons, melee: (character.equipment.weapons.melee ?? []).map(w => w.id === weapon.id ? {...w, notes: e.target.value} : w) } }})})} placeholder="Add notes..." className="mt-2 min-h-[100px] text-sm" />
                                                                                            </PopoverContent>
                                                                                        </Popover>
                                                                                    )}
                                                                                    {isMeleeWeaponsEditing && ( <Button variant="ghost" size="icon" className="h-7 w-7" onClick={() => removeMeleeWeapon(weapon.id)}><Trash2 className="h-4 w-4 text-destructive" /></Button> )}
                                                                                </div>
                                                                            </div>
                                                                            <div className="grid grid-cols-2 gap-x-4 gap-y-1 text-xs">
                                                                                {isMeleeWeaponsEditing ? ( 
                                                                                    <><div className="space-y-1"> <Label>Type</Label> <Input defaultValue={weapon.type} onChange={e => handleMeleeWeaponChange(weapon.id, 'type', e.target.value)} className="h-7 text-xs"/> </div><div className="space-y-1"> <Label>Range</Label> <Input defaultValue={weapon.range} onChange={e => handleMeleeWeaponChange(weapon.id, 'range', e.target.value)} className="h-7 text-xs"/> </div><div className="space-y-1"> <Label>Damage</Label> <Input defaultValue={weapon.damage} onChange={e => handleMeleeWeaponChange(weapon.id, 'damage', e.target.value)} className="h-7 text-xs"/> </div><div className="space-y-1"> <Label>Penetration</Label> <Input defaultValue={weapon.penetration} onChange={e => handleMeleeWeaponChange(weapon.id, 'penetration', e.target.value)} className="h-7 text-xs"/> </div><div className="col-span-2 space-y-1"> <Label>Traits</Label> <Input defaultValue={weapon.traits} onChange={e => handleMeleeWeaponChange(weapon.id, 'traits', e.target.value)} className="h-7 text-xs"/> </div></> 
                                                                                ) : ( 
                                                                                    <><div><strong className="text-muted-foreground">Type:</strong> {weapon.type || '-'}</div><div><strong className="text-muted-foreground">Range:</strong> {weapon.range || '-'}</div><div><strong className="text-muted-foreground">Dmg:</strong> {weapon.damage || '-'}</div><div><strong className="text-muted-foreground">Pen:</strong> {weapon.penetration || '-'}</div><div className="col-span-2"><strong className="text-muted-foreground">Traits:</strong> <span className="break-words">{weapon.traits || '-'}</span></div></> 
                                                                                )}
                                                                            </div>
                                                                            <div className="flex items-center space-x-2 pt-2">
                                                                                <Checkbox checked={!!weapon.equipped} onCheckedChange={(c) => isMeleeWeaponsEditing ? handleMeleeWeaponChange(weapon.id, 'equipped', !!c) : updateCharacter(character.id, { equipment: {...character.equipment, weapons: {...character.equipment.weapons, melee: (character.equipment.weapons.melee ?? []).map(w => w.id === weapon.id ? {...w, equipped: !!c} : w) } }})} />
                                                                                <Label className="text-xs">{t('equipped')}</Label>
                                                                            </div>
                                                                        </div> 
                                                                    ))}
                                                                </div>
                                                                {isMeleeWeaponsEditing && ( <div className="p-2 pt-4"><Button onClick={addMeleeWeapon} size="sm" className="w-full"><Plus className="mr-2 h-4 w-4"/> {t('add')} {t('meleeWeapons')}</Button></div> )}
                                                            </AccordionContent>
                                                        </AccordionItem>
                                                    </Accordion>
                                                </div>
                                                <div className="space-y-4">
                                                    <div>
                                                        <div className="flex items-center justify-between mb-2"><h4 className="font-semibold text-lg">{t('rangedWeapons')}</h4>{(showEditButtons || isRangedWeaponsEditing) && <EditSaveButton editing={isRangedWeaponsEditing} onEdit={() => setIsRangedWeaponsEditing(true)} onSave={handleSaveRangedWeapons} />}</div>
                                                        <div className="space-y-2">
                                                            {equippedRangedWeapons.map(weapon => ( 
                                                                <div key={weapon.id} className="border rounded-lg p-3 space-y-2 bg-background/50">
                                                                    <div className="flex justify-between items-start">
                                                                        {isRangedWeaponsEditing ? ( <Input defaultValue={weapon.name} onChange={(e) => handleRangedWeaponChange(weapon.id, 'name', e.target.value)} className="h-8 font-semibold text-sm"/> ) : ( <h5 className="font-semibold break-words text-sm">{weapon.name}</h5> )}
                                                                        <div className="flex items-center gap-1 flex-shrink-0 ml-2">
                                                                            {!hideNotes && (
                                                                                <Popover>
                                                                                    <PopoverTrigger asChild>
                                                                                        <Button variant={weapon.notes ? 'secondary' : 'ghost'} size="icon" className="h-7 w-7"><InfoIcon className="h-4 w-4" /></Button>
                                                                                    </PopoverTrigger>
                                                                                    <PopoverContent className="w-64">
                                                                                        <Label className="text-xs mb-2 block">Notes for {weapon.name}</Label>
                                                                                        <Textarea defaultValue={weapon.notes || ''} {...(isRangedWeaponsEditing ? {onChange: (e) => handleRangedWeaponChange(weapon.id, 'notes', e.target.value)} : {onBlur: (e) => updateCharacter(character.id, { equipment: {...character.equipment, weapons: {...character.equipment.weapons, ranged: (character.equipment.weapons.ranged ?? []).map(w => w.id === weapon.id ? {...w, notes: e.target.value} : w) } }})})} placeholder="Add notes..." className="mt-2 min-h-[100px] text-sm" />
                                                                                    </PopoverContent>
                                                                                </Popover>
                                                                            )}
                                                                            {isRangedWeaponsEditing && ( <Button variant="ghost" size="icon" className="h-7 w-7" onClick={() => removeRangedWeapon(weapon.id)}><Trash2 className="h-4 w-4 text-destructive" /></Button> )}
                                                                        </div>
                                                                    </div>
                                                                    <div className="grid grid-cols-2 gap-x-4 gap-y-1 text-xs">
                                                                        {isRangedWeaponsEditing ? ( 
                                                                            <><div className="space-y-1"> <Label>Type</Label> <Input defaultValue={weapon.type} onChange={e => handleRangedWeaponChange(weapon.id, 'type', e.target.value)} className="h-7 text-xs"/> </div><div className="space-y-1"> <Label>Range</Label> <Input defaultValue={weapon.range} onChange={e => handleRangedWeaponChange(weapon.id, 'range', e.target.value)} className="h-7 text-xs"/> </div><div className="space-y-1"> <Label>RoF</Label> <Input defaultValue={weapon.rof} onChange={e => handleRangedWeaponChange(weapon.id, 'rof', e.target.value)} className="h-7 text-xs"/> </div><div className="space-y-1"> <Label>Damage</Label> <Input defaultValue={weapon.damage} onChange={e => handleRangedWeaponChange(weapon.id, 'damage', e.target.value)} className="h-7 text-xs"/> </div><div className="space-y-1"> <Label>Clip</Label> <Input type="number" defaultValue={weapon.clip} onChange={e => handleRangedWeaponChange(weapon.id, 'clip', e.target.value)} className="h-7 text-xs"/> </div><div className="space-y-1"> <Label>Clip Size</Label> <Input type="number" defaultValue={weapon.clipSize} onChange={e => handleRangedWeaponChange(weapon.id, 'clipSize', e.target.value)} className="h-7 text-xs"/> </div><div className="col-span-2 space-y-1"> <Label>Reload</Label> <Input defaultValue={weapon.reload} onChange={e => handleRangedWeaponChange(weapon.id, 'reload', e.target.value)} className="h-7 text-xs"/> </div><div className="col-span-2 space-y-1"> <Label>Traits</Label> <Input defaultValue={weapon.traits} onChange={e => handleRangedWeaponChange(weapon.id, 'traits', e.target.value)} className="h-7 text-xs"/> </div></> 
                                                                        ) : ( 
                                                                            <><div><strong className="text-muted-foreground">Type:</strong> {weapon.type || '-'}</div><div><strong className="text-muted-foreground">Range:</strong> {weapon.range || '-'}</div><div><strong className="text-muted-foreground">RoF:</strong> {weapon.rof || '-'}</div><div><strong className="text-muted-foreground">Dmg:</strong> {weapon.damage || '-'}</div><div><strong className="text-muted-foreground">Clip:</strong> {weapon.clip} / {weapon.clipSize}</div><div><strong className="text-muted-foreground">Reload:</strong> {weapon.reload || '-'}</div><div className="col-span-2"><strong className="text-muted-foreground">Traits:</strong> <span className="break-words">{weapon.traits || '-'}</span></div></> 
                                                                        )}
                                                                    </div>
                                                                    <div className="flex items-center space-x-2 pt-2">
                                                                        <Checkbox checked={!!weapon.equipped} onCheckedChange={(c) => isRangedWeaponsEditing ? handleRangedWeaponChange(weapon.id, 'equipped', !!c) : updateCharacter(character.id, { equipment: {...character.equipment, weapons: {...character.equipment.weapons, ranged: (character.equipment.weapons.ranged ?? []).map(w => w.id === weapon.id ? {...w, equipped: !!c} : w) } }})} /><Label className="text-xs">{t('equipped')}</Label>
                                                                    </div>
                                                                </div> 
                                                            ))}
                                                        </div>
                                                    </div>
                                                    <Accordion type="single" collapsible className="w-full">
                                                        <AccordionItem value="unequipped-ranged" className="border-b-0">
                                                            <AccordionPrimitive.Trigger className="flex flex-1 items-center justify-between py-2 text-sm font-medium"><span>{t('notEquipped')}</span><ChevronDown className="h-4 w-4 shrink-0 transition-transform duration-200" /></AccordionPrimitive.Trigger>
                                                            <AccordionContent>
                                                                <div className="space-y-2">
                                                                    {unequippedRangedWeapons.map(weapon => ( 
                                                                        <div key={weapon.id} className="border rounded-lg p-3 space-y-2 bg-background/50">
                                                                            <div className="flex justify-between items-start">
                                                                                {isRangedWeaponsEditing ? ( <Input defaultValue={weapon.name} onChange={(e) => handleRangedWeaponChange(weapon.id, 'name', e.target.value)} className="h-8 font-semibold text-sm"/> ) : ( <h5 className="font-semibold break-words text-sm">{weapon.name}</h5> )}
                                                                                <div className="flex items-center gap-1 flex-shrink-0 ml-2">
                                                                                    {!hideNotes && (
                                                                                        <Popover>
                                                                                            <PopoverTrigger asChild>
                                                                                                <Button variant={weapon.notes ? 'secondary' : 'ghost'} size="icon" className="h-7 w-7"><InfoIcon className="h-4 w-4" /></Button>
                                                                                            </PopoverTrigger>
                                                                                            <PopoverContent className="w-64">
                                                                                                <Label className="text-xs mb-2 block">Notes for {weapon.name}</Label>
                                                                                                <Textarea defaultValue={weapon.notes || ''} {...(isRangedWeaponsEditing ? {onChange: (e) => handleRangedWeaponChange(weapon.id, 'notes', e.target.value)} : {onBlur: (e) => updateCharacter(character.id, { equipment: {...character.equipment, weapons: {...character.equipment.weapons, ranged: (character.equipment.weapons.ranged ?? []).map(w => w.id === weapon.id ? {...w, notes: e.target.value} : w) } }})})} placeholder="Add notes..." className="mt-2 min-h-[100px] text-sm" />
                                                                                            </PopoverContent>
                                                                                        </Popover>
                                                                                    )}
                                                                                    {isRangedWeaponsEditing && ( <Button variant="ghost" size="icon" className="h-7 w-7" onClick={() => removeRangedWeapon(weapon.id)}><Trash2 className="h-4 w-4 text-destructive" /></Button> )}
                                                                                </div>
                                                                            </div>
                                                                            <div className="grid grid-cols-2 gap-x-4 gap-y-1 text-xs">
                                                                                {isRangedWeaponsEditing ? ( 
                                                                                    <><div className="space-y-1"> <Label>Type</Label> <Input defaultValue={weapon.type} onChange={e => handleRangedWeaponChange(weapon.id, 'type', e.target.value)} className="h-7 text-xs"/> </div><div className="space-y-1"> <Label>Range</Label> <Input defaultValue={weapon.range} onChange={e => handleRangedWeaponChange(weapon.id, 'range', e.target.value)} className="h-7 text-xs"/> </div><div className="space-y-1"> <Label>RoF</Label> <Input defaultValue={weapon.rof} onChange={e => handleRangedWeaponChange(weapon.id, 'rof', e.target.value)} className="h-7 text-xs"/> </div><div className="space-y-1"> <Label>Damage</Label> <Input defaultValue={weapon.damage} onChange={e => handleRangedWeaponChange(weapon.id, 'damage', e.target.value)} className="h-7 text-xs"/> </div><div className="space-y-1"> <Label>Clip</Label> <Input type="number" defaultValue={weapon.clip} onChange={e => handleRangedWeaponChange(weapon.id, 'clip', e.target.value)} className="h-7 text-xs"/> </div><div className="space-y-1"> <Label>Clip Size</Label> <Input type="number" defaultValue={weapon.clipSize} onChange={e => handleRangedWeaponChange(weapon.id, 'clipSize', e.target.value)} className="h-7 text-xs"/> </div><div className="col-span-2 space-y-1"> <Label>Reload</Label> <Input defaultValue={weapon.reload} onChange={e => handleRangedWeaponChange(weapon.id, 'reload', e.target.value)} className="h-7 text-xs"/> </div><div className="col-span-2 space-y-1"> <Label>Traits</Label> <Input defaultValue={weapon.traits} onChange={e => handleRangedWeaponChange(weapon.id, 'traits', e.target.value)} className="h-7 text-xs"/> </div></> 
                                                                                ) : ( 
                                                                                    <><div><strong className="text-muted-foreground">Type:</strong> {weapon.type || '-'}</div><div><strong className="text-muted-foreground">Range:</strong> {weapon.range || '-'}</div><div><strong className="text-muted-foreground">RoF:</strong> {weapon.rof || '-'}</div><div><strong className="text-muted-foreground">Dmg:</strong> {weapon.damage || '-'}</div><div><strong className="text-muted-foreground">Clip:</strong> {weapon.clip} / {weapon.clipSize}</div><div><strong className="text-muted-foreground">Reload:</strong> {weapon.reload || '-'}</div><div className="col-span-2"><strong className="text-muted-foreground">Traits:</strong> <span className="break-words">{weapon.traits || '-'}</span></div></> 
                                                                                )}
                                                                            </div>
                                                                            <div className="flex items-center space-x-2 pt-2">
                                                                                <Checkbox checked={!!weapon.equipped} onCheckedChange={(c) => isRangedWeaponsEditing ? handleRangedWeaponChange(weapon.id, 'equipped', !!c) : updateCharacter(character.id, { equipment: {...character.equipment, weapons: {...character.equipment.weapons, ranged: (character.equipment.weapons.ranged ?? []).map(w => w.id === weapon.id ? {...w, equipped: !!c} : w) } }})} />
                                                                                <Label className="text-xs">{t('equipped')}</Label>
                                                                            </div>
                                                                        </div> 
                                                                    ))}
                                                                </div>
                                                                {isRangedWeaponsEditing && ( <div className="p-2 pt-4"><Button onClick={addRangedWeapon} size="sm" className="w-full"><Plus className="mr-2 h-4 w-4"/> {t('add')} {t('rangedWeapons')}</Button></div> )}
                                                            </AccordionContent>
                                                        </AccordionItem>
                                                    </Accordion>
                                                </div>
                                            </div>
                                        </CollapsibleContent>
                                    </Collapsible>
                                </div>
                                <div className={cn(isCompactView && activeCompactSection !== 'inventory-section' && 'hidden')}>
                                    <Collapsible id="inventory-section" open={isInventorySectionOpen} onOpenChange={setIsInventorySectionOpen} className="border rounded-lg overflow-hidden">
                                        <div className="flex items-center pr-4 border-b">
                                            <h3 className="flex-1 px-6 py-4 text-lg font-semibold leading-none tracking-tight font-headline">{t('inventory')}</h3>
                                            <CollapsibleTrigger asChild><Button size="icon" variant="ghost"><ChevronRight className={cn("h-4 w-4 transition-transform", isInventorySectionOpen && "rotate-90")} /><span className="sr-only">Toggle Inventory</span></Button></CollapsibleTrigger>
                                        </div>
                                        <CollapsibleContent>
                                            <div className="p-6 space-y-8">
                                                <div className="p-4 rounded-lg bg-card border shadow-sm">
                                                    <div className="flex items-center justify-between mb-4">
                                                        <div className="flex items-center gap-2">
                                                            <h4 className="font-semibold text-lg text-primary">{t('wealth')}</h4>
                                                            {!hideNotes && (
                                                                <Popover>
                                                                    <PopoverTrigger asChild>
                                                                        <Button variant={character.wealth?.notes ? 'secondary' : 'ghost'} size="icon" className="h-6 w-6 shrink-0"><InfoIcon className="h-4 w-4" /></Button>
                                                                    </PopoverTrigger>
                                                                    <PopoverContent className="w-64">
                                                                        <Label className="text-xs mb-2 block">Wealth Notes</Label>
                                                                        <Textarea defaultValue={character.wealth?.notes || ''} onBlur={(e) => updateCharacter(character.id, { wealth: { ...editableWealth, notes: e.target.value } })} placeholder="Add notes about your wealth..." className="min-h-[100px] text-sm" />
                                                                    </PopoverContent>
                                                                </Popover>
                                                            )}
                                                        </div>
                                                        {(showEditButtons || isWealthEditing) && <EditSaveButton editing={isWealthEditing} onEdit={() => setIsWealthEditing(true)} onSave={handleSaveWealth} />}
                                                    </div>
                                                    {isWealthEditing ? ( 
                                                        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                                                            <div className="space-y-1"><Label>{t('throneGelt')}</Label><Input type="number" value={editableWealth.throneGelt} onChange={(e) => setEditableWealth(prev => ({...prev, throneGelt: parseInt(e.target.value, 10) || 0}))} /></div>
                                                            <div className="space-y-1"><Label>{t('monthlyIncome')}</Label><Input type="number" value={editableWealth.monthlyIncome} onChange={(e) => setEditableWealth(prev => ({...prev, monthlyIncome: parseInt(e.target.value, 10) || 0}))} /></div>
                                                        </div> 
                                                    ) : ( 
                                                        <div className="grid grid-cols-1 md:grid-cols-2 gap-4 text-sm font-medium">
                                                            <div className="flex justify-between items-center bg-background p-2 rounded border"><span>{t('throneGelt')}:</span> <span className="text-primary font-bold">{character.wealth?.throneGelt ?? 0}</span></div>
                                                            <div className="flex justify-between items-center bg-background p-2 rounded border"><span>{t('monthlyIncome')}:</span> <span className="text-primary font-bold">{character.wealth?.monthlyIncome ?? 0}</span></div>
                                                        </div> 
                                                    )}
                                                </div>
                                                
                                                <div className="p-4 rounded-lg bg-card border shadow-sm space-y-4">
                                                    <div className="flex items-center justify-between border-b pb-2">
                                                        <h4 className="font-semibold text-lg">{t('items')}</h4>
                                                        {(showEditButtons || isInventoryEditing) && <EditSaveButton editing={isInventoryEditing} onEdit={() => setIsInventoryEditing(true)} onSave={handleSaveInventory} />}
                                                    </div>
                                                    {isInventoryEditing ? ( 
                                                        <div className="space-y-4">
                                                            <div className="grid grid-cols-1 md:grid-cols-2 gap-x-4 gap-y-2">
                                                                {editableInventory.map((item) => ( 
                                                                    <div key={item.id} className="flex items-center gap-2">
                                                                        <Input defaultValue={item.name} onChange={e => setEditableInventory(editableInventory.map(i => i.id === item.id ? {...i, name: e.target.value} : i))} className="h-9 text-sm"/>
                                                                        {!hideNotes && (
                                                                            <Popover>
                                                                                <PopoverTrigger asChild>
                                                                                    <Button variant={item.notes ? 'secondary' : 'ghost'} size="icon" className="h-9 w-9 shrink-0"><InfoIcon className="h-4 w-4" /></Button>
                                                                                </PopoverTrigger>
                                                                                <PopoverContent className="w-64">
                                                                                    <Label className="text-xs mb-2 block">Notes for {item.name}</Label>
                                                                                    <Textarea defaultValue={item.notes || ''} onBlur={(e) => setEditableInventory(editableInventory.map(i => i.id === item.id ? {...i, notes: e.target.value} : i))} placeholder="Add notes..." className="mt-2 min-h-[100px] text-sm" />
                                                                                </PopoverContent>
                                                                            </Popover>
                                                                        )}
                                                                        <Button variant="ghost" size="icon" className="h-7 w-7 shrink-0" onClick={() => setEditableInventory(editableInventory.filter(i => i.id !== item.id))}><Trash2 className="h-4 w-4 text-destructive" /></Button>
                                                                    </div> 
                                                                ))}
                                                            </div>
                                                            <div className="flex gap-2 pt-2">
                                                                <Input placeholder="New item" value={newInventoryItem} onChange={(e) => setNewInventoryItem(e.target.value)} />
                                                                <Button onClick={addInventoryItem} size="sm"><Plus className="mr-2 h-4 w-4" /> {t('add')}</Button>
                                                            </div>
                                                        </div> 
                                                    ) : ( 
                                                        <div className="grid grid-cols-1 md:grid-cols-2 gap-x-4 gap-y-1 text-sm text-muted-foreground">
                                                            {(currentInventory ?? []).length > 0 ? currentInventory.map((item) => ( 
                                                                <div key={item.id} className="flex items-start gap-2 p-1.5 hover:bg-muted/50 rounded transition-colors">
                                                                    <span className="mt-1.5 h-1.5 w-1.5 rounded-full bg-primary shrink-0"></span>
                                                                    <span className="flex-grow break-words font-medium text-foreground">{item.name}</span>
                                                                    {!hideNotes && (
                                                                        <Popover>
                                                                            <PopoverTrigger asChild>
                                                                                <Button variant={item.notes ? 'secondary' : 'ghost'} size="icon" className="h-5 w-5 shrink-0 -mr-1 -mt-0.5"><InfoIcon className="h-3 w-3" /></Button>
                                                                            </PopoverTrigger>
                                                                            <PopoverContent className="w-64">
                                                                                <Label className="text-xs mb-2 block">Notes for {item.name}</Label>
                                                                                <Textarea defaultValue={item.notes || ''} onBlur={(e) => updateCharacter(character.id, { inventory: (character.inventory || []).map(i => i.id === item.id ? {...i, notes: e.target.value} : i)})} placeholder="Add notes..." className="mt-2 min-h-[100px] text-sm" />
                                                                            </PopoverContent>
                                                                        </Popover>
                                                                    )}
                                                                </div> 
                                                            )) : <p className="col-span-full text-sm text-muted-foreground italic p-4 text-center border border-dashed rounded-lg">No items in your inventory.</p>}
                                                        </div> 
                                                    )}
                                                </div>
                                            </div>
                                        </CollapsibleContent>
                                    </Collapsible>
                                </div>
                                {!isCompactView && ( <div className="grid grid-cols-2 gap-4">
                                      <MetricBox title={t('insanity')} notes={getSimplePointsObject(character.insanityPoints).notes} onNoteChange={(val) => updateCharacter(character.id, { insanityPoints: { ...getSimplePointsObject(character.insanityPoints), notes: val } })} editing={isPointsEditing} onEdit={() => setIsPointsEditing(true)} onSave={handleSavePoints} isCompactView={isCompactView} hideNotes={hideNotes} showEditButtons={showEditButtons}><div className="text-center flex flex-col justify-center items-center h-full">{isPointsEditing ? ( <Input type="number" value={editablePoints.insanityPoints.total} onChange={e => handleSimplePointsChange('insanityPoints', 'total', e.target.value)} className="text-lg font-bold h-8 w-16 text-center mx-auto"/> ) : ( <div className="flex items-center justify-center gap-2"><Button size="icon" variant="outline" className="h-6 w-6" onClick={() => handlePointChange('insanityPoints', -1)}><Minus className="h-4 w-4" /></Button><p className="text-2xl font-bold text-primary w-12 text-center">{getSimplePointsObject(character.insanityPoints).total}</p><Button size="icon" variant="outline" className="h-6 w-6" onClick={() => handlePointChange('insanityPoints', 1)}><Plus className="h-4 w-4" /></Button></div> )}</div></MetricBox>
                                      <MetricBox title={t('corruption')} notes={getSimplePointsObject(character.corruptionPoints).notes} onNoteChange={(val) => updateCharacter(character.id, { corruptionPoints: { ...getSimplePointsObject(character.corruptionPoints), notes: val } })} editing={isPointsEditing} onEdit={() => setIsPointsEditing(true)} onSave={handleSavePoints} isCompactView={isCompactView} hideNotes={hideNotes} showEditButtons={showEditButtons}><div className="text-center flex flex-col justify-center items-center h-full">{isPointsEditing ? ( <Input type="number" value={editablePoints.corruptionPoints.total} onChange={e => handleSimplePointsChange('corruptionPoints', 'total', e.target.value)} className="text-lg font-bold h-8 w-16 text-center mx-auto"/> ) : ( <div className="flex items-center justify-center gap-2"><Button size="icon" variant="outline" className="h-6 w-6" onClick={() => handlePointChange('corruptionPoints', -1)}><Minus className="h-4 w-4" /></Button><p className="text-2xl font-bold text-primary w-12 text-center">{getSimplePointsObject(character.corruptionPoints).total}</p><Button size="icon" variant="outline" className="h-6 w-6" onClick={() => handlePointChange('corruptionPoints', 1)}><Plus className="h-4 w-4" /></Button></div> )}</div></MetricBox>
                                  </div> )}
                            </CardContent>
                        </Card>
                    )}
                </div>
            </div>
             <Dialog open={isAdvancedPathModalOpen} onOpenChange={setIsAdvancedPathModalOpen}><DialogContent className="sm:max-w-md" onInteractOutside={(e) => e.preventDefault()} onEscapeKeyDown={(e) => e.preventDefault()}><DialogHeader><DialogTitle>Select Advanced Career Path</DialogTitle><DialogDescription>Your experience has unlocked new possibilities. This choice is permanent for this character.</DialogDescription></DialogHeader><div className="grid grid-cols-1 gap-4 py-4">{possibleAdvancedPaths && Object.values(possibleAdvancedPaths).map(path => ( <Button key={path.name} onClick={() => handleSelectAdvancedPath(path.name)} className="h-12 text-base">Choose {path.name}</Button> ))}</div></DialogContent></Dialog>
            <Dialog open={isAlternateRankModalOpen} onOpenChange={setIsAlternateRankModalOpen}><DialogContent><DialogHeader><DialogTitle>Select Adept Rank</DialogTitle><DialogDescription>Choose your rank for the 2000-2999 EXP tier.</DialogDescription></DialogHeader><div className="grid grid-cols-1 gap-4 py-4"><Button onClick={() => handleSelectAlternateRank(null)} className="h-12 text-base">Choose Inditor</Button><Button onClick={() => handleSelectAlternateRank('Chirurgeon')} className="h-12 text-base">Choose Chirurgeon</Button></div></DialogContent></Dialog>
        </div>
    );
  }
);

DarkHeresySheet.displayName = 'DarkHeresySheet';
