'use client';

import * as React from 'react';
import { type DarkHeresyCharacter, Skill } from '@/lib/types';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Checkbox } from '@/components/ui/checkbox';
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from "@/components/ui/collapsible";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { cn } from '@/lib/utils';
import { useTranslation } from '@/context/language-context';
import { EditSaveButton } from '@/components/ui/edit-save-button';
import { ChevronDown } from 'lucide-react';

interface SkillsSectionProps {
    character: DarkHeresyCharacter;
    isCompactView: boolean;
    currentSkills: Skill[];
    isSkillsEditing: boolean;
    setIsSkillsEditing: (val: boolean) => void;
    handleSaveSkills: () => void;
    handleSkillChange: (skillId: string, field: keyof Skill, value: any) => void;
    isSkillsExpanded: boolean;
    setIsSkillsExpanded: (val: boolean) => void;
    showEditButtons?: boolean;
}

export function SkillsSection({
    isCompactView, currentSkills, isSkillsEditing, setIsSkillsEditing,
    handleSaveSkills, handleSkillChange, isSkillsExpanded, setIsSkillsExpanded, showEditButtons
}: SkillsSectionProps) {
    const { t } = useTranslation();

    return (
        <Collapsible open={!isCompactView || isSkillsExpanded} onOpenChange={setIsSkillsExpanded}>
            <div className="flex items-center justify-between mb-2">
                <CollapsibleTrigger asChild disabled={!isCompactView}>
                    <div className={cn("flex items-center gap-2", isCompactView && "cursor-pointer")}>
                        <h4 className="font-semibold text-lg">{t('skills')}</h4>
                        {isCompactView && <ChevronDown className={cn("h-4 w-4 transition-transform", isSkillsExpanded && "rotate-180")} />}
                    </div>
                </CollapsibleTrigger>
                {(showEditButtons || isSkillsEditing) && <EditSaveButton editing={isSkillsEditing} onEdit={() => setIsSkillsEditing(true)} onSave={handleSaveSkills} />}
            </div>
            <CollapsibleContent forceMount={!isCompactView}>
                <div className="border rounded-lg p-2">
                    <Table>
                        <TableHeader>
                            <TableRow>
                                <TableHead>Skill</TableHead>
                                <TableHead>Type</TableHead>
                                <TableHead>Trained</TableHead>
                                <TableHead>+10</TableHead>
                                <TableHead>+20</TableHead>
                                <TableHead>Notes</TableHead>
                            </TableRow>
                        </TableHeader>
                        <TableBody>
                            {currentSkills.map(skill => (
                                <TableRow key={skill.id}>
                                    <TableCell className="font-medium">{skill.name}</TableCell>
                                    <TableCell>{skill.type}</TableCell>
                                    <TableCell>
                                        {isSkillsEditing ? (
                                            <Checkbox checked={skill.training.skilled} onCheckedChange={(checked) => handleSkillChange(skill.id, 'training', { ...skill.training, skilled: checked })} />
                                        ) : (
                                            <span>{skill.training.skilled ? '✓' : '-'}</span>
                                        )}
                                    </TableCell>
                                    <TableCell>
                                        {isSkillsEditing ? (
                                            <Checkbox checked={skill.training.plus10} onCheckedChange={(checked) => handleSkillChange(skill.id, 'training', { ...skill.training, plus10: checked })} />
                                        ) : (
                                            <span>{skill.training.plus10 ? '✓' : '-'}</span>
                                        )}
                                    </TableCell>
                                    <TableCell>
                                        {isSkillsEditing ? (
                                            <Checkbox checked={skill.training.plus20} onCheckedChange={(checked) => handleSkillChange(skill.id, 'training', { ...skill.training, plus20: checked })} />
                                        ) : (
                                            <span>{skill.training.plus20 ? '✓' : '-'}</span>
                                        )}
                                    </TableCell>
                                    <TableCell>
                                        {isSkillsEditing ? (
                                            <Input value={skill.notes} onChange={e => handleSkillChange(skill.id, 'notes', e.target.value)} className="h-7 text-xs" />
                                        ) : (
                                            <span>{skill.notes || '-'}</span>
                                        )}
                                    </TableCell>
                                </TableRow>
                            ))}
                        </TableBody>
                    </Table>
                </div>
            </CollapsibleContent>
        </Collapsible>
    );
}