// src/components/sheets/dh-sections/info-progression-section.tsx
'use client';

import * as React from 'react';
import { type DarkHeresyCharacter, type DarkHeresyCareerPath } from '@/lib/types';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { Button } from '@/components/ui/button';
import { Plus, Minus, ChevronDown } from 'lucide-react';
import { Label } from '@/components/ui/label';
import * as AccordionPrimitive from "@radix-ui/react-accordion";
import {
  Accordion,
  AccordionContent,
  AccordionItem,
} from "@/components/ui/accordion";
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
import { WORLD_VARIANTS_BY_HOMEWORLD, WORLD_VARIANT_LABELS } from '@/lib/dark-heresy-data';
import { ADVANCED_RANK_THRESHOLD, RanksByCareer, AdvancedPathsByCareer, type AdvancedPath, calculateRank } from '@/lib/dark-heresy-ranks';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from '@/components/ui/dialog';
import { DetailField, EditSaveButton } from './dh-ui-helpers';

interface InfoProgressionSectionProps {
    character: DarkHeresyCharacter;
    isCompactView: boolean;
    onEditingChange?: (val: boolean) => void;
}

export const InfoProgressionSection = ({ character, isCompactView, onEditingChange }: InfoProgressionSectionProps) => {
    const { updateCharacter } = useCharacterContext();
    const { t } = useTranslation();

    const [isInfoProgressionEditing, setIsInfoProgressionEditing] = React.useState(false);
    React.useEffect(() => { onEditingChange?.(isInfoProgressionEditing); }, [isInfoProgressionEditing, onEditingChange]);
    const [editableExperience, setEditableExperience] = React.useState(character.experience ?? 0);
    const [editableTotalExpSpent, setEditableTotalExpSpent] = React.useState(character.totalExpSpent ?? 0);
    const [editableAdvancedPath, setEditableAdvancedPath] = React.useState(character.advancedPath ?? null);
    const [editableAlternatePath, setEditableAlternatePath] = React.useState(character.alternatePath ?? null);
    const [amountToSpend, setAmountToSpend] = React.useState(0);
    
    const [isAdvancedPathModalOpen, setIsAdvancedPathModalOpen] = React.useState(false);
    const [isAlternateRankModalOpen, setIsAlternateRankModalOpen] = React.useState(false);

    const advancedPathThreshold = character.careerPath === 'Tech-Priest' ? 3000 : character.careerPath === 'Imperial Psyker' ? 2000 : ADVANCED_RANK_THRESHOLD;
    
    const worldVariantLabel = React.useMemo(() => {
        if (!character.homeWorld) return t('waitingHomeWorld');
        const key = WORLD_VARIANT_LABELS[character.homeWorld];
        if (key === 'Tribal Taboos') return t('tribalTaboos');
        if (key === 'Hive Class') return t('hiveClass');
        if (key === 'Birth Planet') return t('birthPlanet');
        if (key === 'Ship Tradition') return t('shipTradition');
        return t('worldVariant');
    }, [character.homeWorld, t]);

    const possibleAdvancedPaths = AdvancedPathsByCareer[character.careerPath as keyof typeof AdvancedPathsByCareer];
    const careerProgression = character.careerPath ? RanksByCareer[character.careerPath as DarkHeresyCareerPath] : null;
    let chosenAdvancedPathData: AdvancedPath | null = null;
    if ((editableAdvancedPath ?? character.advancedPath) && possibleAdvancedPaths) {
        const paths = Object.values(possibleAdvancedPaths) as AdvancedPath[];
        chosenAdvancedPathData = paths.find(p => p.name === (editableAdvancedPath ?? character.advancedPath)) || null;
    }
    const currentRankName = careerProgression ? calculateRank(careerProgression, editableTotalExpSpent, chosenAdvancedPathData, editableAlternatePath ?? character.alternatePath) : 'N/A';
    const canChooseAlternateRank = character.careerPath === 'Adept' && editableTotalExpSpent >= 2000 && editableTotalExpSpent < 3000;

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

    const handleSelectAdvancedPath = (pathName: string) => { 
        updateCharacter(character.id, { advancedPath: pathName }); 
        setEditableAdvancedPath(pathName); 
        setIsAdvancedPathModalOpen(false); 
    };
    
    const handleSelectAlternateRank = (pathName: string | null) => { 
        updateCharacter(character.id, { alternatePath: pathName }); 
        setEditableAlternatePath(pathName); 
        setIsAlternateRankModalOpen(false); 
    };

    return (
        <>
            <div className={cn("lg:col-span-9 flex flex-col", isCompactView ? "space-y-4" : "")}>
                <div className="w-full">
                    <Card id="info-section">
                        <CardHeader className={cn("flex flex-row items-center justify-between px-6 pt-3 pb-6", isCompactView && "px-4 pt-2 pb-4")}>
                            <CardTitle className={cn("font-headline", isCompactView ? "text-lg" : "text-2xl")}>{t('characterInfo')}</CardTitle>
                            {(isInfoProgressionEditing || true) && <EditSaveButton editing={isInfoProgressionEditing} onEdit={() => setIsInfoProgressionEditing(true)} onSave={() => setIsInfoProgressionEditing(false)} />}
                        </CardHeader>
                        <CardContent className="pt-0">
                            <Accordion type="single" collapsible className="w-full" defaultValue="info">
                                <AccordionItem value="info" className="border-b-0">
                                    <AccordionPrimitive.Header className={cn("flex w-full items-center justify-between pb-4", isCompactView ? "px-0 pt-2" : "px-0 pt-3")}>
                                        <AccordionPrimitive.Trigger className="flex flex-1 items-center justify-between font-medium transition-all hover:no-underline [&[data-state=open]>svg]:rotate-180"><CardTitle className={cn("font-headline", isCompactView ? "text-lg" : "text-2xl")}>{t('info')}</CardTitle><ChevronDown className="h-4 w-4 shrink-0 transition-transform duration-200" /></AccordionPrimitive.Trigger>
                                    </AccordionPrimitive.Header>
                                    <AccordionContent className={cn("pt-0", isCompactView ? "px-0 pb-4" : "px-0 pb-6")}>
                                        <div className="grid grid-cols-2 md:grid-cols-3 3xl:grid-cols-4 gap-x-4 gap-y-4">
                                            <DetailField label={t('characterName')} value={character.name} editing={isInfoProgressionEditing} onBlur={(e) => updateCharacter(character.id, { name: e.target.value })} isCompactView={isCompactView} />
                                            <div className="space-y-1"><Label className={cn("text-xs text-muted-foreground", isCompactView && "text-[10px]")}>{t('homeWorld')}</Label><p className={cn("text-sm font-medium break-words", isCompactView && "text-xs")}>{character.homeWorld || '-'}</p></div>
                                            <div className="space-y-1">
                                                <Label className={cn("text-xs text-muted-foreground", isCompactView && "text-[10px]")}>{worldVariantLabel}</Label>
                                                {isInfoProgressionEditing ? ( 
                                                    <Select defaultValue={character.worldVariant} onValueChange={(value) => updateCharacter(character.id, { worldVariant: value })}>
                                                        <SelectTrigger className="h-8 text-xs"><SelectValue placeholder="Select variant..." /></SelectTrigger>
                                                        <SelectContent>{(character.homeWorld ? WORLD_VARIANTS_BY_HOMEWORLD[character.homeWorld] || [] : []).map(v => ( <SelectItem key={v} value={v}>{v}</SelectItem> ))}</SelectContent>
                                                    </Select> 
                                                ) : ( 
                                                    <p className={cn("text-sm font-medium break-words", isCompactView && "text-xs")}>{character.worldVariant || '-'}</p> 
                                                )}
                                            </div>
                                            <div className="space-y-1"><Label className={cn("text-xs text-muted-foreground", isCompactView && "text-[10px]")}>{t('careerPath')}</Label><p className={cn("text-sm font-medium break-words", isCompactView && "text-xs")}>{character.careerPath || '-'}</p></div>
                                            <div className="space-y-1"><Label className={cn("text-xs text-muted-foreground", isCompactView && "text-[10px]")}>{t('characterClass')}</Label><p className={cn("text-sm font-medium break-words", isCompactView && "text-xs")}>{character.characterClass || '-'}</p></div>
                                            <div className="space-y-1">
                                                <Label className={cn("text-xs text-muted-foreground", isCompactView && "text-[10px]")}>{t('rank')}</Label>
                                                <div className="flex items-center gap-2">
                                                    <p className={cn("text-sm font-medium break-words", isCompactView && "text-xs")}>{currentRankName}</p>
                                                    {editableTotalExpSpent >= advancedPathThreshold && !(editableAdvancedPath ?? character.advancedPath) && ( 
                                                        <Button size="sm" variant="outline" onClick={() => setIsAdvancedPathModalOpen(true)}>Select Path</Button> 
                                                    )}
                                                    {canChooseAlternateRank && ( 
                                                        <Button size="sm" variant="outline" onClick={() => setIsAlternateRankModalOpen(true)}>Select Rank</Button> 
                                                    )}
                                                </div>
                                            </div>
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
                                        <div className="mt-4 grid grid-cols-1 gap-4">
                                            <div className="space-y-1">
                                                <Label className={cn("text-xs text-muted-foreground", isCompactView && "text-[10px]")}>{t('backstory')}</Label>
                                                {isInfoProgressionEditing ? (
                                                    <Textarea defaultValue={character.backstory} className="min-h-[100px] resize-y" onBlur={(e) => updateCharacter(character.id, { backstory: e.target.value })} />
                                                ) : (
                                                    <p className={cn("text-sm font-medium whitespace-pre-wrap break-words", isCompactView && "text-xs")}>{character.backstory || '-'}</p>
                                                )}
                                            </div>
                                            <div className="space-y-1">
                                                <Label className={cn("text-xs text-muted-foreground", isCompactView && "text-[10px]")}>{t('notes')}</Label>
                                                {isInfoProgressionEditing ? (
                                                    <Textarea defaultValue={character.notes} className="min-h-[100px] resize-y" onBlur={(e) => updateCharacter(character.id, { notes: e.target.value })} />
                                                ) : (
                                                    <p className={cn("text-sm font-medium whitespace-pre-wrap break-words", isCompactView && "text-xs")}>{character.notes || '-'}</p>
                                                )}
                                            </div>
                                        </div>
                                    </AccordionContent>
                                </AccordionItem>
                                <AccordionItem value="progression" className="border-b-0">
                                    <AccordionPrimitive.Trigger className={cn("hover:no-underline flex flex-1 items-center justify-between pb-4", isCompactView ? "px-0 pt-2" : "px-0 pt-3")}>
                                        <CardTitle className={cn("font-headline", isCompactView ? "text-lg" : "text-2xl")}>{t('progression')}</CardTitle>
                                        <ChevronDown className="h-4 w-4 shrink-0 transition-transform duration-200" />
                                    </AccordionPrimitive.Trigger>
                                    <AccordionContent className={cn("pt-0", isCompactView ? "px-0 pb-4" : "px-0 pb-6")}>
                                        <div className="flex flex-col space-y-4">
                                            <div className="space-y-1">
                                                <Label htmlFor="current-exp-edit" className="text-xs text-muted-foreground">{t('currentExp')}</Label>
                                                <Input id="current-exp-edit" type="number" value={editableExperience} onChange={(e) => setEditableExperience(parseInt(e.target.value, 10) || 0)} onBlur={() => { if (editableExperience !== character.experience) updateCharacter(character.id, { experience: editableExperience }); }} className="h-9"/>
                                            </div>
                                            <div className="space-y-2">
                                                <Label htmlFor="spend-exp-amount">{t('spendExp')}</Label>
                                                <div className="flex items-center gap-2">
                                                    <Button size="icon" variant="outline" className="h-9 w-9 shrink-0" onClick={() => setAmountToSpend(Math.max(0, amountToSpend - 50))}><Minus className="h-4 w-4" /></Button>
                                                    <Input id="spend-exp-amount" type="number" value={amountToSpend} onChange={(e) => setAmountToSpend(Math.max(0, parseInt(e.target.value, 10) || 0))} className="h-9 text-center" />
                                                    <Button size="icon" variant="outline" className="h-9 w-9 shrink-0" onClick={() => setAmountToSpend(amountToSpend + 50)}><Plus className="h-4 w-4" /></Button>
                                                </div>
                                            </div>
                                            <Button onClick={handleSpendExp} disabled={amountToSpend <= 0 || amountToSpend > editableExperience} className="w-full">{t('spendExp')}</Button>
                                            <div className="space-y-1">
                                                <Label htmlFor="total-exp-edit" className="text-xs text-muted-foreground">{t('totalExpSpent')}</Label>
                                                <Input id="total-exp-edit" type="number" value={editableTotalExpSpent} onChange={handleTotalExpChange} onBlur={handleSaveTotalExp} className="h-9"/>
                                            </div>
                                        </div>
                                    </AccordionContent>
                                </AccordionItem>
                            </Accordion>
                        </CardContent>
                    </Card>
                </div>
            </div>

            <Dialog open={isAdvancedPathModalOpen} onOpenChange={setIsAdvancedPathModalOpen}>
                <DialogContent className="sm:max-w-md" onInteractOutside={(e) => e.preventDefault()} onEscapeKeyDown={(e) => e.preventDefault()}>
                    <DialogHeader>
                        <DialogTitle>Select Advanced Career Path</DialogTitle>
                        <DialogDescription>Your experience has unlocked new possibilities. This choice is permanent for this character.</DialogDescription>
                    </DialogHeader>
                    <div className="grid grid-cols-1 gap-4 py-4">
                        {possibleAdvancedPaths && Object.values(possibleAdvancedPaths).map(path => ( 
                            <Button key={path.name} onClick={() => handleSelectAdvancedPath(path.name)} className="h-12 text-base">Choose {path.name}</Button> 
                        ))}
                    </div>
                </DialogContent>
            </Dialog>

            <Dialog open={isAlternateRankModalOpen} onOpenChange={setIsAlternateRankModalOpen}>
                <DialogContent>
                    <DialogHeader>
                        <DialogTitle>Select Adept Rank</DialogTitle>
                        <DialogDescription>Choose your rank for the 2000-2999 EXP tier.</DialogDescription>
                    </DialogHeader>
                    <div className="grid grid-cols-1 gap-4 py-4">
                        <Button onClick={() => handleSelectAlternateRank(null)} className="h-12 text-base">Choose Inditor</Button>
                        <Button onClick={() => handleSelectAlternateRank('Chirurgeon')} className="h-12 text-base">Choose Chirurgeon</Button>
                    </div>
                </DialogContent>
            </Dialog>
        </>
    );
};