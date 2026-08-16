// src/components/sheets/dh-sections/skills-talents-section.tsx
'use client';

import * as React from 'react';
import { type DarkHeresyCharacter, Skill } from '@/lib/types';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { Button } from '@/components/ui/button';
import { Plus, Trash2, Info as InfoIcon } from 'lucide-react';
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
import { cn } from '@/lib/utils';
import { useCharacterContext } from '@/context/character-context';
import { useTranslation } from '@/context/language-context';
import { EditSaveButton } from './dh-ui-helpers';

interface SkillsTalentsSectionProps {
    character: DarkHeresyCharacter;
    isCompactView: boolean;
    activeCompactSection: string;
}

export const SkillsTalentsSection = ({ character, isCompactView, activeCompactSection }: SkillsTalentsSectionProps) => {
    const { updateCharacter, hideNotes, showEditButtons } = useCharacterContext();
    const { t } = useTranslation();

    const [isSkillsEditing, setIsSkillsEditing] = React.useState(false);
    const [isTalentsEditing, setIsTalentsEditing] = React.useState(false);
    const [isMovementEditing, setIsMovementEditing] = React.useState(false);

    const [editableSkills, setEditableSkills] = React.useState(character.skills ?? []);
    const [newBasicSkillName, setNewBasicSkillName] = React.useState('');
    const [newAdvancedSkillName, setNewAdvancedSkillName] = React.useState('');
    const [editableTalents, setEditableTalents] = React.useState(character.talents ?? []);
    const [newTalentName, setNewTalentName] = React.useState('');
    const [editableMovement, setEditableMovement] = React.useState(character.movement ?? { walkHalf: 0, walkFull: 0, charge: 0, run: 0 });

    const handleSaveSkills = React.useCallback(() => { updateCharacter(character.id, { skills: editableSkills }); setIsSkillsEditing(false); }, [character.id, editableSkills, updateCharacter]);
    const handleSaveTalents = React.useCallback(() => { updateCharacter(character.id, { talents: editableTalents }); setIsTalentsEditing(false); }, [character.id, editableTalents, updateCharacter]);
    const handleSaveMovement = React.useCallback(() => { updateCharacter(character.id, { movement: editableMovement }); setIsMovementEditing(false); }, [character.id, editableMovement, updateCharacter]);

    const handleSkillTrainingUpdate = (skillId: string, trainingKey: keyof Skill['training'], isChecked: boolean) => {
        const skillsToUpdate = isSkillsEditing ? editableSkills : (character.skills ?? []);
        const nextSkills = skillsToUpdate.map(s => { if (s.id === skillId) { const next = { ...s.training, [trainingKey]: isChecked }; if (trainingKey === 'skilled' && !isChecked) { next.plus10 = false; next.plus20 = false; } if (trainingKey === 'plus10' && !isChecked) next.plus20 = false; return { ...s, training: next }; } return s; });
        if (isSkillsEditing) setEditableSkills(nextSkills); else updateCharacter(character.id, { skills: nextSkills });
    };

    const addBasicSkill = () => { if (newBasicSkillName.trim() !== '') { setEditableSkills([...editableSkills, { id: `new-skill-${Date.now()}`, name: newBasicSkillName, notes: '', type: 'basic', training: { skilled: false, plus10: false, plus20: false } }]); setNewBasicSkillName(''); } };
    const addAdvancedSkill = () => { if (newAdvancedSkillName.trim() !== '') { setEditableSkills([...editableSkills, { id: `new-skill-${Date.now()}`, name: newAdvancedSkillName, notes: '', type: 'advanced', training: { skilled: false, plus10: false, plus20: false } }]); setNewAdvancedSkillName(''); } };
    const addTalent = () => { if (newTalentName.trim() !== '') { setEditableTalents([...editableTalents, { id: `new-talent-${Date.now()}`, name: newTalentName, notes: '' }]); setNewTalentName(''); } };

    const currentSkills = isSkillsEditing ? editableSkills : (character.skills ?? []);
    const basicSkills = currentSkills.filter(s => s.type === 'basic');
    const advancedSkills = currentSkills.filter(s => s.type === 'advanced');

    return (
        <>
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
        </>
    );
};