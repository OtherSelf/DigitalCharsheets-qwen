// src/components/sheets/dh-sections/equipment-inventory-section.tsx
'use client';

import * as React from 'react';
import { type DarkHeresyCharacter, BodyPart, MeleeWeapon, RangedWeapon, ArmorPiece } from '@/lib/types';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { Button } from '@/components/ui/button';
import { Plus, Trash2, Info as InfoIcon, ChevronRight, ChevronDown } from 'lucide-react';
import { Label } from '@/components/ui/label';
import { Checkbox } from '@/components/ui/checkbox';
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from "@/components/ui/collapsible";
import {
  Accordion,
  AccordionContent,
  AccordionItem,
} from "@/components/ui/accordion";
import * as AccordionPrimitive from "@radix-ui/react-accordion";
import {
    Table,
    TableBody,
    TableCell,
    TableHead,
    TableHeader,
    TableRow,
} from "@/components/ui/table";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { cn } from '@/lib/utils';
import { useCharacterContext } from '@/context/character-context';
import { useTranslation } from '@/context/language-context';
import { EditSaveButton } from './dh-ui-helpers';

const defaultEquipment = {
  armor: { 'Head': null, 'Right arm': null, 'Body': null, 'Left arm': null, 'Right leg': null, 'Left leg': null },
  weapons: { melee: [], ranged: [] }
};

const ARMOR_TYPES = ["Primitive", "Advanced", "Flack", "Mesh", "Carapace", "Power", "Force"];

interface EquipmentInventorySectionProps {
    character: DarkHeresyCharacter;
    isCompactView: boolean;
    activeCompactSection: string;
    onEditingChange?: (val: boolean) => void;
}

export const EquipmentInventorySection = React.forwardRef<{ saveAll: () => void }, EquipmentInventorySectionProps>(({ character, isCompactView, activeCompactSection, onEditingChange }, ref) => {
    const { updateCharacter, hideNotes, showEditButtons } = useCharacterContext();
    const { t } = useTranslation();

    const [isWealthEditing, setIsWealthEditing] = React.useState(false);
    const [isArmorEditing, setIsArmorEditing] = React.useState(false);
    const [isMeleeWeaponsEditing, setIsMeleeWeaponsEditing] = React.useState(false);
    const [isRangedWeaponsEditing, setIsRangedWeaponsEditing] = React.useState(false);
    const [isInventoryEditing, setIsInventoryEditing] = React.useState(false);
    const [isEquipmentSectionOpen, setIsEquipmentSectionOpen] = React.useState(true);
    const [isInventorySectionOpen, setIsInventorySectionOpen] = React.useState(true);
    const [isArmorExpanded, setIsArmorExpanded] = React.useState(false);

    const [editableWealth, setEditableWealth] = React.useState({
        throneGelt: character.wealth?.throneGelt ?? 0, monthlyIncome: character.wealth?.monthlyIncome ?? 0,
    });
    const [editableEquipment, setEditableEquipment] = React.useState(character.equipment ?? defaultEquipment);
    const [editableInventory, setEditableInventory] = React.useState(character.inventory ?? []);
    const [newInventoryItem, setNewInventoryItem] = React.useState('');

    const handleSaveWealth = React.useCallback(() => { updateCharacter(character.id, { wealth: editableWealth }); setIsWealthEditing(false); }, [character.id, editableWealth, updateCharacter]);
    const handleSaveArmor = React.useCallback(() => { updateCharacter(character.id, { equipment: {...editableEquipment, armor: editableEquipment.armor} }); setIsArmorEditing(false); }, [character.id, editableEquipment, updateCharacter]);
    const handleSaveMeleeWeapons = React.useCallback(() => { updateCharacter(character.id, { equipment: editableEquipment }); setIsMeleeWeaponsEditing(false); }, [character.id, editableEquipment, updateCharacter]);
    const handleSaveRangedWeapons = React.useCallback(() => { updateCharacter(character.id, { equipment: editableEquipment }); setIsRangedWeaponsEditing(false); }, [character.id, editableEquipment, updateCharacter]);
    const handleSaveInventory = React.useCallback(() => { updateCharacter(character.id, { inventory: editableInventory }); setIsInventoryEditing(false); }, [character.id, editableInventory, updateCharacter]);

    const isAnyEditing = isWealthEditing || isArmorEditing || isMeleeWeaponsEditing || isRangedWeaponsEditing || isInventoryEditing;
    React.useEffect(() => { onEditingChange?.(isAnyEditing); }, [isAnyEditing, onEditingChange]);

    React.useImperativeHandle(ref, () => ({
        saveAll: () => {
            if (isWealthEditing) handleSaveWealth();
            if (isArmorEditing) handleSaveArmor();
            if (isMeleeWeaponsEditing) handleSaveMeleeWeapons();
            if (isRangedWeaponsEditing) handleSaveRangedWeapons();
            if (isInventoryEditing) handleSaveInventory();
        }
    }), [isWealthEditing, isArmorEditing, isMeleeWeaponsEditing, isRangedWeaponsEditing, isInventoryEditing, handleSaveWealth, handleSaveArmor, handleSaveMeleeWeapons, handleSaveRangedWeapons, handleSaveInventory]);

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

    const addInventoryItem = () => { if (newInventoryItem.trim() !== '') { setEditableInventory([...editableInventory, { id: `new-inv-${Date.now()}`, name: newInventoryItem, status: 'default', notes: '' }]); setNewInventoryItem(''); } };

    const bodyParts: BodyPart[] = ['Head', 'Right arm', 'Left arm', 'Body', 'Right leg', 'Left leg'];
    const bodyPartLocations: Record<BodyPart, string> = { 'Head': '1-10', 'Right arm': '11-20', 'Left arm': '21-30', 'Body': '31-70', 'Right leg': '71-85', 'Left leg': '86-00' };

    const currentEquipment = isArmorEditing || isMeleeWeaponsEditing || isRangedWeaponsEditing ? editableEquipment : (character.equipment ?? defaultEquipment);
    const currentInventory = isInventoryEditing ? editableInventory : (character.inventory ?? []);
    const equippedMeleeWeapons = (currentEquipment.weapons?.melee ?? []).filter(w => w.equipped);
    const unequippedMeleeWeapons = (currentEquipment.weapons?.melee ?? []).filter(w => !w.equipped);
    const equippedRangedWeapons = (currentEquipment.weapons?.ranged ?? []).filter(w => w.equipped);
    const unequippedRangedWeapons = (currentEquipment.weapons?.ranged ?? []).filter(w => w.equipped === false || w.equipped === undefined);

    return (
        <>
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
        </>
    );
});

EquipmentInventorySection.displayName = 'EquipmentInventorySection';