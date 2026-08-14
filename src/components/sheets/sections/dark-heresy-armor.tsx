'use client';

import * as React from 'react';
import { type DarkHeresyCharacter, BodyPart, ArmorPiece } from '@/lib/types';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from "@/components/ui/collapsible";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { cn } from '@/lib/utils';
import { useTranslation } from '@/context/language-context';
import { EditSaveButton } from '@/components/ui/edit-save-button';
import { ChevronDown } from 'lucide-react';

export const ARMOR_TYPES = ["Primitive", "Advanced", "Flack", "Mesh", "Carapace", "Power", "Force"];
export const bodyParts: BodyPart[] = ['Head', 'Right arm', 'Left arm', 'Body', 'Right leg', 'Left leg'];
export const bodyPartLocations: Record<BodyPart, string> = { 'Head': '1-10', 'Right arm': '11-20', 'Left arm': '21-30', 'Body': '31-70', 'Right leg': '71-85', 'Left leg': '86-00' };

export const ArmorDisplay = ({ character, isCompactView }: { character: DarkHeresyCharacter; isCompactView: boolean; }) => {
    const armor: Record<BodyPart, ArmorPiece | null> = character.equipment?.armor ?? { 
        'Head': null, 'Right arm': null, 'Body': null, 'Left arm': null, 'Right leg': null, 'Left leg': null 
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

interface ArmorSectionProps {
    character: DarkHeresyCharacter;
    isCompactView: boolean;
    currentEquipment: any; 
    isArmorEditing: boolean;
    setIsArmorEditing: (val: boolean) => void;
    handleSaveArmor: () => void;
    handleArmorChange: (part: BodyPart, field: keyof ArmorPiece, value: string) => void;
    isArmorExpanded: boolean;
    setIsArmorExpanded: (val: boolean) => void;
    showEditButtons?: boolean;
}

export function ArmorSection({
    isCompactView, currentEquipment, isArmorEditing, setIsArmorEditing,
    handleSaveArmor, handleArmorChange, isArmorExpanded, setIsArmorExpanded, showEditButtons
}: ArmorSectionProps) {
    const { t } = useTranslation();

    return (
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
    );
}