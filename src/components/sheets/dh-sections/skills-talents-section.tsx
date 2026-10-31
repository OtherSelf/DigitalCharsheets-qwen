// src/components/sheets/dh-sections/skills-talents-section.tsx
'use client';

import * as React from 'react';
import { type DarkHeresyCharacter, Skill } from '@/lib/types';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { Button } from '@/components/ui/button';
import { Plus, Trash2, Info as InfoIcon, ChevronDown, ChevronRight } from 'lucide-react';
import { Label } from '@/components/ui/label';
import { Checkbox } from '@/components/ui/checkbox';
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';
import {
    Table,
    TableBody,
    TableCell,
    TableHead,
    TableHeader,
    TableRow,
} from "@/components/ui/table";
import { Separator } from '@/components/ui/separator';
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from '@/components/ui/collapsible';
import { cn } from '@/lib/utils';
import { useCharacterContext } from '@/context/character-context';
import { useTranslation } from '@/context/language-context';
import { EditSaveButton } from './dh-ui-helpers';

const CHARACTERISTIC_KEYS = [
    'weaponSkill', 'ballisticSkill', 'strength', 'toughness', 'agility', 
    'intelligence', 'perception', 'willpower', 'fellowship', 'influence'
] as const;

// Map all possible saved abbreviations (EN and RU) back to their characteristic key
const ABBR_TO_KEY: Record<string, typeof CHARACTERISTIC_KEYS[number]> = {
    'WS': 'weaponSkill', 'ББ': 'weaponSkill',
    'BS': 'ballisticSkill', 'ДБ': 'ballisticSkill',
    'S': 'strength', 'СЛ': 'strength',
    'T': 'toughness', 'СТ': 'toughness',
    'Ag': 'agility', 'AG': 'agility', 'ЛВ': 'agility',
    'Int': 'intelligence', 'INT': 'intelligence', 'ИН': 'intelligence',
    'Per': 'perception', 'PER': 'perception', 'ВП': 'perception',
    'WP': 'willpower', 'СВ': 'willpower',
    'Fel': 'fellowship', 'FEL': 'fellowship', 'ОБ': 'fellowship',
    'Inf': 'influence', 'INF': 'influence', 'ВЛ': 'influence',
};

// Helper to translate the abbreviation in existing skill names
const getTranslatedSkillName = (skillName: string, t: (key: string) => string) => {
    // Match "Base Name (Abbr)" at the end of the string
    const match = skillName.match(/^(.*?)\s*\(([^)]+)\)$/);
    if (match) {
        const baseName = match[1].trim();
        const abbr = match[2].trim();
        const key = ABBR_TO_KEY[abbr];
        if (key) {
            return `${baseName} (${t(`${key}Abbr`)})`;
        }
    }
    return skillName; // Return original if no match (e.g., custom name without abbr)
};

interface SkillsTalentsSectionProps {
    character: DarkHeresyCharacter;
    isCompactView: boolean;
    activeCompactSection: string;
    onEditingChange?: (val: boolean) => void;
}

export const SkillsTalentsSection = React.forwardRef<{ saveAll: () => void }, SkillsTalentsSectionProps>(({ character, isCompactView, activeCompactSection, onEditingChange }, ref) => {
    const { updateCharacter, hideNotes, showEditButtons } = useCharacterContext();
    const { t } = useTranslation();

    const [isSkillsOpen, setIsSkillsOpen] = React.useState(true);
    const [isTalentsOpen, setIsTalentsOpen] = React.useState(true);

    const [isSkillsEditing, setIsSkillsEditing] = React.useState(false);
    const [isTalentsEditing, setIsTalentsEditing] = React.useState(false);

    const [editableSkills, setEditableSkills] = React.useState(character.skills ?? []);
    const [newBasicSkillName, setNewBasicSkillName] = React.useState('');
    const [newBasicSkillChar, setNewBasicSkillChar] = React.useState<string>('agility');
    const [newAdvancedSkillName, setNewAdvancedSkillName] = React.useState('');
    const [newAdvancedSkillChar, setNewAdvancedSkillChar] = React.useState<string>('intelligence');
    const [editableTalents, setEditableTalents] = React.useState(character.talents ?? []);
    const [newTalentName, setNewTalentName] = React.useState('');
    const [newTalentDescription, setNewTalentDescription] = React.useState('');

    const handleSaveSkills = React.useCallback(() => { 
        updateCharacter(character.id, { skills: editableSkills }); 
        setIsSkillsEditing(false); 
    }, [character.id, editableSkills, updateCharacter]);

    const handleSaveTalents = React.useCallback(() => { 
        updateCharacter(character.id, { talents: editableTalents }); 
        setIsTalentsEditing(false); 
    }, [character.id, editableTalents, updateCharacter]);

    const handleSkillTrainingUpdate = (skillId: string, trainingKey: keyof Skill['training'], isChecked: boolean) => {
        const skillsToUpdate = isSkillsEditing ? editableSkills : (character.skills ?? []);
        const nextSkills = skillsToUpdate.map(s => { 
            if (s.id === skillId) { 
                const next = { ...s.training, [trainingKey]: isChecked }; 
                if (trainingKey === 'skilled' && !isChecked) { 
                    next.plus10 = false; 
                    next.plus20 = false; 
                } 
                if (trainingKey === 'plus10' && !isChecked) {
                    next.plus20 = false; 
                }
                return { ...s, training: next }; 
            } 
            return s; 
        });
        if (isSkillsEditing) {
            setEditableSkills(nextSkills); 
        } else {
            updateCharacter(character.id, { skills: nextSkills }); 
        }
    };

    const addBasicSkill = () => { 
        if (newBasicSkillName.trim() !== '') { 
            const charAbbr = t(`${newBasicSkillChar}Abbr`);
            setEditableSkills([...editableSkills, { id: `new-skill-${Date.now()}`, name: `${newBasicSkillName} (${charAbbr})`, notes: '', type: 'basic', training: { skilled: false, plus10: false, plus20: false } }]); 
            setNewBasicSkillName(''); 
            setNewBasicSkillChar('agility');
        } 
    };
    
    const addAdvancedSkill = () => { 
        if (newAdvancedSkillName.trim() !== '') { 
            const charAbbr = t(`${newAdvancedSkillChar}Abbr`);
            setEditableSkills([...editableSkills, { id: `new-skill-${Date.now()}`, name: `${newAdvancedSkillName} (${charAbbr})`, notes: '', type: 'advanced', training: { skilled: false, plus10: false, plus20: false } }]); 
            setNewAdvancedSkillName(''); 
            setNewAdvancedSkillChar('intelligence');
        } 
    };
    
    const addTalent = () => { 
        if (newTalentName.trim() !== '') { 
            setEditableTalents([...editableTalents, { id: `new-talent-${Date.now()}`, name: newTalentName, notes: '', description: newTalentDescription.trim() || undefined }]); 
            setNewTalentName(''); 
            setNewTalentDescription('');
        } 
    };

    const currentSkills = isSkillsEditing ? editableSkills : (character.skills ?? []);
    const basicSkills = currentSkills.filter(s => s.type === 'basic');
    const advancedSkills = currentSkills.filter(s => s.type === 'advanced');

    const isAnyEditing = isSkillsEditing || isTalentsEditing;
    React.useEffect(() => { onEditingChange?.(isAnyEditing); }, [isAnyEditing, onEditingChange]);

    React.useImperativeHandle(ref, () => ({
        saveAll: () => {
            if (isSkillsEditing) handleSaveSkills();
            if (isTalentsEditing) handleSaveTalents();
        }
    }), [isSkillsEditing, isTalentsEditing, handleSaveSkills, handleSaveTalents]);

    return (
        <div className="space-y-6 w-full">
            {/* Shared outline wrapper for Skills and Talents & Traits */}
            <div className={cn("border rounded-lg space-y-6 bg-card", isCompactView ? "p-3" : "p-4 md:p-6")}>
                {/* ==================== SKILLS SECTION ==================== */}
                <Collapsible 
                    open={isSkillsOpen} 
                    onOpenChange={setIsSkillsOpen}
                    className="w-full"
                >
                    <div className="flex flex-row items-center justify-between mb-2">
                        <CollapsibleTrigger className="flex items-center gap-2 hover:bg-accent hover:text-accent-foreground rounded-md px-2 py-1 -ml-2 transition-colors focus:outline-none">
                            {isSkillsOpen ? <ChevronDown className="h-5 w-5" /> : <ChevronRight className="h-5 w-5" />}
                            <h3 className="font-headline text-lg font-semibold">{t('skills')}</h3>
                        </CollapsibleTrigger>
                        {(showEditButtons || isSkillsEditing) && (
                            <EditSaveButton 
                                editing={isSkillsEditing} 
                                onEdit={() => { setIsSkillsOpen(true); setIsSkillsEditing(true); }} 
                                onSave={handleSaveSkills} 
                            />
                        )}
                    </div>
                    
                    <CollapsibleContent className="w-full">
                        <div className="grid grid-cols-1 md:grid-cols-2 gap-x-8 gap-y-6">
                            <div>
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
                                                                    <Label className="text-xs mb-2 block">Notes for {getTranslatedSkillName(skill.name, t)}</Label>
                                                                    <Textarea defaultValue={skill.notes || ''} onBlur={(e) => updateCharacter(character.id, { skills: (character.skills || []).map(s => s.id === skill.id ? {...s, notes: e.target.value} : s) })} placeholder="Add notes..." className="mt-2 min-h-[100px] text-sm" />
                                                                </PopoverContent>
                                                            </Popover>
                                                        )}
                                                    </TableCell>
                                                    <TableCell className={cn(isCompactView && "p-2")}>
                                                        {isSkillsEditing ? (
                                                            <Input defaultValue={skill.name} onChange={(e) => setEditableSkills(editableSkills.map(s => s.id === skill.id ? {...s, name: e.target.value} : s))} className="h-8 text-xs"/>
                                                        ) : (
                                                            <p className={cn("font-medium whitespace-normal break-words", isCompactView && "text-xs")}>
                                                                {getTranslatedSkillName(skill.name, t)}
                                                            </p>
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
                                {isSkillsEditing && (
                                    <div className="flex flex-col gap-2 mt-4 p-3 border rounded-md bg-background">
                                        <div className="flex gap-2">
                                            <Input placeholder={t('basic')} value={newBasicSkillName} onChange={(e) => setNewBasicSkillName(e.target.value)} className="flex-grow" />
                                            <select 
                                                value={newBasicSkillChar} 
                                                onChange={(e) => setNewBasicSkillChar(e.target.value)}
                                                className="flex h-9 w-32 rounded-md border border-input bg-background px-3 py-1 text-sm shadow-sm transition-colors focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring"
                                            >
                                                {CHARACTERISTIC_KEYS.map(key => (
                                                    <option key={key} value={key}>{t(key)} ({t(`${key}Abbr`)})</option>
                                                ))}
                                            </select>
                                            <Button onClick={addBasicSkill} size="sm"><Plus className="mr-2 h-4 w-4" /> {t('add')}</Button>
                                        </div>
                                    </div>
                                )}
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
                                                                    <Label className="text-xs mb-2 block">Notes for {getTranslatedSkillName(skill.name, t)}</Label>
                                                                    <Textarea defaultValue={skill.notes || ''} onBlur={(e) => updateCharacter(character.id, { skills: (character.skills || []).map(s => s.id === skill.id ? {...s, notes: e.target.value} : s) })} placeholder="Add notes..." className="mt-2 min-h-[100px] text-sm" />
                                                                </PopoverContent>
                                                            </Popover>
                                                        )}
                                                    </TableCell>
                                                    <TableCell className={cn(isCompactView && "p-2")}>
                                                        {isSkillsEditing ? (
                                                            <Input defaultValue={skill.name} onChange={(e) => setEditableSkills(editableSkills.map(s => s.id === skill.id ? {...s, name: e.target.value} : s))} className="h-8 text-xs"/>
                                                        ) : (
                                                            <p className={cn("font-medium whitespace-normal break-words", isCompactView && "text-xs")}>
                                                                {getTranslatedSkillName(skill.name, t)}
                                                            </p>
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
                                {isSkillsEditing && (
                                    <div className="flex flex-col gap-2 mt-4 p-3 border rounded-md bg-background">
                                        <div className="flex gap-2">
                                            <Input placeholder={t('advanced')} value={newAdvancedSkillName} onChange={(e) => setNewAdvancedSkillName(e.target.value)} className="flex-grow" />
                                            <select 
                                                value={newAdvancedSkillChar} 
                                                onChange={(e) => setNewAdvancedSkillChar(e.target.value)}
                                                className="flex h-9 w-32 rounded-md border border-input bg-background px-3 py-1 text-sm shadow-sm transition-colors focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring"
                                            >
                                                {CHARACTERISTIC_KEYS.map(key => (
                                                    <option key={key} value={key}>{t(key)} ({t(`${key}Abbr`)})</option>
                                                ))}
                                            </select>
                                            <Button onClick={addAdvancedSkill} size="sm"><Plus className="mr-2 h-4 w-4" /> {t('add')}</Button>
                                        </div>
                                    </div>
                                )}
                            </div>
                        </div>
                    </CollapsibleContent>
                </Collapsible>
                
                <Separator className={cn(isCompactView && 'hidden')} />
                
                {/* ==================== TALENTS & TRAITS SECTION ==================== */}
                <Collapsible 
                    open={isTalentsOpen} 
                    onOpenChange={setIsTalentsOpen}
                    className="w-full"
                >
                    <div className="flex flex-row items-center justify-between mb-2">
                        <CollapsibleTrigger className="flex items-center gap-2 hover:bg-accent hover:text-accent-foreground rounded-md px-2 py-1 -ml-2 transition-colors focus:outline-none">
                            {isTalentsOpen ? <ChevronDown className="h-5 w-5" /> : <ChevronRight className="h-5 w-5" />}
                            <h3 className="font-headline text-lg font-semibold">{t('talentsAndTraits')}</h3>
                        </CollapsibleTrigger>
                        {(showEditButtons || isTalentsEditing) && (
                            <EditSaveButton 
                                editing={isTalentsEditing} 
                                onEdit={() => { setIsTalentsOpen(true); setIsTalentsEditing(true); }} 
                                onSave={handleSaveTalents} 
                            />
                        )}
                    </div>
                    
                    <CollapsibleContent className="w-full">
                        {isTalentsEditing ? (
                            <div className="space-y-4">
                                <ul className="space-y-3">{(editableTalents ?? []).map(talent => (
                                    <li key={talent.id} className="space-y-2 p-3 border rounded-md bg-background">
                                        <div className="flex items-center gap-2">
                                            {!hideNotes && (
                                                <Popover>
                                                    <PopoverTrigger asChild><Button variant={talent.notes ? 'secondary' : 'ghost'} size="icon" className="h-9 w-9 shrink-0"><InfoIcon className="h-4 w-4" /></Button></PopoverTrigger>
                                                    <PopoverContent className="w-64"><Label className="text-xs mb-2 block">Notes for {talent.name}</Label><Textarea defaultValue={talent.notes || ''} onBlur={(e) => setEditableTalents(editableTalents.map(t => t.id === talent.id ? {...t, notes: e.target.value} : t))} placeholder="Add notes..." className="mt-2 min-h-[100px] text-sm" /></PopoverContent>
                                                </Popover>
                                            )}
                                            <Input defaultValue={talent.name} onChange={e => setEditableTalents(editableTalents.map(t => t.id === talent.id ? {...t, name: e.target.value} : t))} className="h-9 flex-grow"/>
                                            <Button variant="ghost" size="icon" className="h-7 w-7 shrink-0" onClick={() => setEditableTalents(editableTalents.filter((t) => t.id !== talent.id))}><Trash2 className="h-4 w-4 text-destructive" /></Button>
                                        </div>
                                        <Textarea 
                                            defaultValue={talent.description || ''} 
                                            onChange={e => setEditableTalents(editableTalents.map(t => t.id === talent.id ? {...t, description: e.target.value} : t))} 
                                            placeholder="Description..." 
                                            className="min-h-[60px] text-sm" 
                                        />
                                    </li>
                                ))}</ul>
                                <div className="space-y-2 p-3 border rounded-md bg-background">
                                    <Input placeholder="New talent/trait name" value={newTalentName} onChange={(e) => setNewTalentName(e.target.value)} />
                                    <Textarea placeholder="Description (optional)" value={newTalentDescription} onChange={(e) => setNewTalentDescription(e.target.value)} className="min-h-[60px] text-sm" />
                                    <Button onClick={addTalent} className="w-full"><Plus className="mr-2 h-4 w-4" /> {t('add')}</Button>
                                </div>
                            </div>
                        ) : (
                            <div className="space-y-3">{(character.talents ?? []).length > 0 ? character.talents.map(talent => (
                                <div key={talent.id} className="border rounded-md bg-background overflow-hidden">
                                    <Collapsible>
                                        <div className={cn("flex items-start gap-2 p-3", isCompactView ? "text-xs" : "text-sm")}>
                                            {!hideNotes && (
                                                <Popover>
                                                    <PopoverTrigger asChild><Button variant={talent.notes ? 'secondary' : 'ghost'} size="icon" className="h-6 w-6 shrink-0 mt-0.5"><InfoIcon className="h-4 w-4" /></Button></PopoverTrigger>
                                                    <PopoverContent className="w-64"><Label className="text-xs mb-2 block">Notes for {talent.name}</Label><Textarea defaultValue={talent.notes || ''} onBlur={(e) => updateCharacter(character.id, { talents: (character.talents || []).map(t => t.id === talent.id ? {...t, notes: e.target.value} : t)})} placeholder="Add notes..." className="mt-2 min-h-[100px] text-sm" /></PopoverContent>
                                                </Popover>
                                            )}
                                            <div className="flex-grow">
                                                <CollapsibleTrigger className="flex items-center justify-between w-full hover:bg-accent/50 rounded px-2 py-1 -mx-2 transition-colors text-left">
                                                    <p className="text-foreground flex-grow break-words font-medium">&bull; {talent.name}</p>
                                                    {talent.description && (
                                                        <ChevronDown className="h-4 w-4 shrink-0 ml-2 transition-transform duration-200 data-[state=open]:rotate-180" />
                                                    )}
                                                </CollapsibleTrigger>
                                                {talent.description && (
                                                    <CollapsibleContent className="pt-2">
                                                        <p className={cn("text-muted-foreground whitespace-pre-wrap", isCompactView ? "text-xs" : "text-sm")}>
                                                            {talent.description}
                                                        </p>
                                                    </CollapsibleContent>
                                                )}
                                            </div>
                                        </div>
                                    </Collapsible>
                                </div>
                            )) : <p className={cn("text-muted-foreground", isCompactView ? "text-xs" : "text-sm")}>No talents or traits.</p>}
                            </div>
                        )}
                    </CollapsibleContent>
                </Collapsible>
            </div>
        </div>
    );
});

SkillsTalentsSection.displayName = 'SkillsTalentsSection';