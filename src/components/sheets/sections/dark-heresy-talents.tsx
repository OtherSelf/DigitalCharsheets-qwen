'use client';

import * as React from 'react';
import { type DarkHeresyCharacter, Talent } from '@/lib/types';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';
import { Textarea } from '@/components/ui/textarea';
import { cn } from '@/lib/utils';
import { useTranslation } from '@/context/language-context';
import { EditSaveButton } from '@/components/ui/edit-save-button';
import { Plus, Trash2, Info as InfoIcon } from 'lucide-react';
import { Button } from '@/components/ui/button';

interface TalentsSectionProps {
    character: DarkHeresyCharacter;
    isCompactView: boolean;
    isTalentsEditing: boolean;
    setIsTalentsEditing: (val: boolean) => void;
    handleSaveTalents: () => void;
    editableTalents: Talent[];
    setEditableTalents: (val: any) => void;
    newTalentName: string;
    setNewTalentName: (val: string) => void;
    addTalent: () => void;
    showEditButtons?: boolean;
    hideNotes?: boolean;
    updateCharacter: (id: string, data: any) => void;
}

export function TalentsSection({
    character, isCompactView, isTalentsEditing, setIsTalentsEditing,
    handleSaveTalents, editableTalents, setEditableTalents, newTalentName,
    setNewTalentName, addTalent, showEditButtons, hideNotes, updateCharacter
}: TalentsSectionProps) {
    const { t } = useTranslation();

    return (
        <div>
            <div className="flex flex-row items-center justify-between mb-4">
                <h3 className="font-headline text-lg font-semibold">{t('talentsAndTraits')}</h3>
                {(showEditButtons || isTalentsEditing) && <EditSaveButton editing={isTalentsEditing} onEdit={() => setIsTalentsEditing(true)} onSave={handleSaveTalents} />}
            </div>
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
    );
}