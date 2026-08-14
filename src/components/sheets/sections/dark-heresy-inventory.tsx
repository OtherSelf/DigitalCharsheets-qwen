'use client';

import * as React from 'react';
import { type DarkHeresyCharacter, InventoryItem } from '@/lib/types';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from "@/components/ui/collapsible";
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';
import { Textarea } from '@/components/ui/textarea';
import { cn } from '@/lib/utils';
import { useTranslation } from '@/context/language-context';
import { EditSaveButton } from '@/components/ui/edit-save-button';
import { ChevronRight, Plus, Trash2, Info as InfoIcon } from 'lucide-react';
import { Button } from '@/components/ui/button';

interface InventorySectionProps {
    character: DarkHeresyCharacter;
    isCompactView: boolean;
    currentInventory: InventoryItem[];
    editableWealth: { throneGelt: number; monthlyIncome: number };
    isWealthEditing: boolean;
    setIsWealthEditing: (val: boolean) => void;
    handleSaveWealth: () => void;
    setEditableWealth: (val: any) => void;
    isInventoryEditing: boolean;
    setIsInventoryEditing: (val: boolean) => void;
    handleSaveInventory: () => void;
    editableInventory: InventoryItem[];
    setEditableInventory: (val: any) => void;
    newInventoryItem: string;
    setNewInventoryItem: (val: string) => void;
    addInventoryItem: () => void;
    showEditButtons?: boolean;
    hideNotes?: boolean;
    updateCharacter: (id: string, data: any) => void;
}

export function InventorySection({
    character, isCompactView, currentInventory, editableWealth, isWealthEditing, setIsWealthEditing,
    handleSaveWealth, setEditableWealth, isInventoryEditing, setIsInventoryEditing,
    handleSaveInventory, editableInventory, setEditableInventory, newInventoryItem,
    setNewInventoryItem, addInventoryItem, showEditButtons, hideNotes, updateCharacter
}: InventorySectionProps) {
    const { t } = useTranslation();

    return (
        <div className="p-6 space-y-8">
            {/* Wealth Section */}
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
                        <div className="space-y-1"><Label>{t('throneGelt')}</Label><Input type="number" value={editableWealth.throneGelt} onChange={(e) => setEditableWealth((prev: any) => ({...prev, throneGelt: parseInt(e.target.value, 10) || 0}))} /></div>
                        <div className="space-y-1"><Label>{t('monthlyIncome')}</Label><Input type="number" value={editableWealth.monthlyIncome} onChange={(e) => setEditableWealth((prev: any) => ({...prev, monthlyIncome: parseInt(e.target.value, 10) || 0}))} /></div>
                    </div> 
                ) : ( 
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-4 text-sm font-medium">
                        <div className="flex justify-between items-center bg-background p-2 rounded border"><span>{t('throneGelt')}:</span> <span className="text-primary font-bold">{character.wealth?.throneGelt ?? 0}</span></div>
                        <div className="flex justify-between items-center bg-background p-2 rounded border"><span>{t('monthlyIncome')}:</span> <span className="text-primary font-bold">{character.wealth?.monthlyIncome ?? 0}</span></div>
                    </div> 
                )}
            </div>
            
            {/* Items Section */}
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
    );
}