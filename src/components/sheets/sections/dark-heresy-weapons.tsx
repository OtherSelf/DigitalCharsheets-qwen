'use client';

import * as React from 'react';
import { type DarkHeresyCharacter, MeleeWeapon, RangedWeapon } from '@/lib/types';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Checkbox } from '@/components/ui/checkbox';
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from "@/components/ui/collapsible";
import { Accordion, AccordionContent, AccordionItem, AccordionTrigger } from "@/components/ui/accordion";
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';
import { Textarea } from '@/components/ui/textarea';
import { cn } from '@/lib/utils';
import { useTranslation } from '@/context/language-context';
import { EditSaveButton } from '@/components/ui/edit-save-button';
import { ChevronDown, Plus, Trash2, Info as InfoIcon } from 'lucide-react';
import { Button } from '@/components/ui/button';

interface WeaponsSectionProps {
    character: DarkHeresyCharacter;
    isCompactView: boolean;
    currentEquipment: any;
    isMeleeWeaponsEditing: boolean;
    setIsMeleeWeaponsEditing: (val: boolean) => void;
    handleSaveMeleeWeapons: () => void;
    handleMeleeWeaponChange: (weaponId: string, field: keyof Omit<MeleeWeapon, 'id'>, value: string | boolean) => void;
    addMeleeWeapon: () => void;
    removeMeleeWeapon: (weaponId: string) => void;
    isRangedWeaponsEditing: boolean;
    setIsRangedWeaponsEditing: (val: boolean) => void;
    handleSaveRangedWeapons: () => void;
    handleRangedWeaponChange: (weaponId: string, field: keyof Omit<RangedWeapon, 'id'>, value: string | number | boolean) => void;
    addRangedWeapon: () => void;
    removeRangedWeapon: (weaponId: string) => void;
    showEditButtons?: boolean;
    hideNotes?: boolean;
    updateCharacter: (id: string, data: any) => void;
}

export function WeaponsSection({
    character, isCompactView, currentEquipment, isMeleeWeaponsEditing, setIsMeleeWeaponsEditing,
    handleSaveMeleeWeapons, handleMeleeWeaponChange, addMeleeWeapon, removeMeleeWeapon,
    isRangedWeaponsEditing, setIsRangedWeaponsEditing, handleSaveRangedWeapons,
    handleRangedWeaponChange, addRangedWeapon, removeRangedWeapon, showEditButtons, hideNotes, updateCharacter
}: WeaponsSectionProps) {
    const { t } = useTranslation();

    const equippedMeleeWeapons = (currentEquipment.weapons?.melee ?? []).filter(w => w.equipped);
    const unequippedMeleeWeapons = (currentEquipment.weapons?.melee ?? []).filter(w => !w.equipped);
    const equippedRangedWeapons = (currentEquipment.weapons?.ranged ?? []).filter(w => w.equipped);
    const unequippedRangedWeapons = (currentEquipment.weapons?.ranged ?? []).filter(w => w.equipped === false || w.equipped === undefined);

    return (
        <div className="space-y-4">
            {/* Melee Weapons Section */}
            <div>
                <div className="flex items-center justify-between mb-2">
                    <h4 className="font-semibold text-lg">{t('meleeWeapons')}</h4>
                    {(showEditButtons || isMeleeWeaponsEditing) && <EditSaveButton editing={isMeleeWeaponsEditing} onEdit={() => setIsMeleeWeaponsEditing(true)} onSave={handleSaveMeleeWeapons} />}
                </div>
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
                    <AccordionTrigger className="flex flex-1 items-center justify-between py-2 text-sm font-medium"><span>{t('notEquipped')}</span><ChevronDown className="h-4 w-4 shrink-0 transition-transform duration-200" /></AccordionTrigger>
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

            {/* Ranged Weapons Section */}
            <div>
                <div className="flex items-center justify-between mb-2">
                    <h4 className="font-semibold text-lg">{t('rangedWeapons')}</h4>
                    {(showEditButtons || isRangedWeaponsEditing) && <EditSaveButton editing={isRangedWeaponsEditing} onEdit={() => setIsRangedWeaponsEditing(true)} onSave={handleSaveRangedWeapons} />}
                </div>
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
                    <AccordionTrigger className="flex flex-1 items-center justify-between py-2 text-sm font-medium"><span>{t('notEquipped')}</span><ChevronDown className="h-4 w-4 shrink-0 transition-transform duration-200" /></AccordionTrigger>
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
    );
}