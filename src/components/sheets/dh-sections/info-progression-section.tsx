'use client';

import * as React from 'react';
import { type DarkHeresyCharacter, type DarkHeresyCareerPath } from '@/lib/types';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { Button } from '@/components/ui/button';
import { Plus, Minus } from 'lucide-react';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { cn } from '@/lib/utils';
import { useCharacterContext } from '@/context/character-context';
import { useTranslation } from '@/context/language-context';
import { WORLD_VARIANTS_BY_HOMEWORLD, WORLD_VARIANT_LABELS } from '@/lib/dark-heresy-data';
import { ADVANCED_RANK_THRESHOLD, RanksByCareer, AdvancedPathsByCareer, type AdvancedPath, calculateRank } from '@/lib/dark-heresy-ranks';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from '@/components/ui/dialog';
import { EditSaveButton } from './dh-ui-helpers';

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

interface SectionProps {
    character: DarkHeresyCharacter;
    isCompactView: boolean;
    activeCompactSection?: string;
    onEditingChange?: (val: boolean) => void;
}

export const InfoSection = ({ character, isCompactView, activeCompactSection, onEditingChange }: SectionProps) => {
    const { updateCharacter, showEditButtons } = useCharacterContext();
    const { t } = useTranslation();
    const [isInfoEditing, setIsInfoEditing] = React.useState(false);
    
    React.useEffect(() => { onEditingChange?.(isInfoEditing); }, [isInfoEditing, onEditingChange]);

    const worldVariantLabel = React.useMemo(() => {
        if (!character.homeWorld) return t('waitingHomeWorld');
        const key = WORLD_VARIANT_LABELS[character.homeWorld];
        if (key === 'Tribal Taboos') return t('tribalTaboos');
        if (key === 'Hive Class') return t('hiveClass');
        if (key === 'Birth Planet') return t('birthPlanet');
        if (key === 'Ship Tradition') return t('shipTradition');
        return t('worldVariant');
    }, [character.homeWorld, t]);

    const showInfo = !isCompactView || activeCompactSection === 'info-section';
    if (!showInfo) return null;

    return (
        <Card id="info-section">
            <CardHeader className={cn("flex flex-row items-center justify-between px-6 pt-3 pb-6", isCompactView && "px-4 pt-2 pb-4")}>
                <CardTitle className={cn("font-headline", isCompactView ? "text-lg" : "text-2xl")}>{t('info')}</CardTitle>
                {(showEditButtons || isInfoEditing) && <EditSaveButton editing={isInfoEditing} onEdit={() => setIsInfoEditing(true)} onSave={() => setIsInfoEditing(false)} />}
            </CardHeader>
            <CardContent className="pt-0">
                <div className="grid grid-cols-2 md:grid-cols-3 3xl:grid-cols-4 gap-x-4 gap-y-4">
                    <DetailField label={t('characterName')} value={character.name} editing={isInfoEditing} onBlur={(e) => updateCharacter(character.id, { name: e.target.value })} isCompactView={isCompactView} />
                    <div className="space-y-1"><Label className={cn("text-xs text-muted-foreground", isCompactView && "text-[10px]")}>{t('homeWorld')}</Label><p className={cn("text-sm font-medium break-words", isCompactView && "text-xs")}>{character.homeWorld || '-'}</p></div>
                    <div className="space-y-1">
                        <Label className={cn("text-xs text-muted-foreground", isCompactView && "text-[10px]")}>{worldVariantLabel}</Label>
                        {isInfoEditing ? ( 
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
                    <DetailField label={t('divination')} value={character.divination} editing={isInfoEditing} onBlur={(e) => updateCharacter(character.id, { divination: e.target.value })} isCompactView={isCompactView} />
                    <DetailField label={t('divinationEffect')} value={character.divinationEffect} editing={false} isCompactView={isCompactView} />
                    <DetailField label={t('quirk')} value={character.quirk} editing={isInfoEditing} onBlur={(e) => updateCharacter(character.id, { quirk: e.target.value })} isCompactView={isCompactView} />
                    <DetailField label={t('height')} value={character.height} editing={isInfoEditing} onBlur={(e) => updateCharacter(character.id, { height: e.target.value })} isCompactView={isCompactView} />
                    <DetailField label={t('weight')} value={character.weight} editing={isInfoEditing} onBlur={(e) => updateCharacter(character.id, { weight: e.target.value })} isCompactView={isCompactView} />
                    <DetailField label={t('age')} value={character.age} editing={isInfoEditing} onBlur={(e) => updateCharacter(character.id, { age: e.target.value })} isCompactView={isCompactView} />
                    <DetailField label={t('skinColor')} value={character.skinColor} editing={isInfoEditing} onBlur={(e) => updateCharacter(character.id, { skinColor: e.target.value })} isCompactView={isCompactView} />
                    <DetailField label={t('hairColor')} value={character.hairColor} editing={isInfoEditing} onBlur={(e) => updateCharacter(character.id, { hairColor: e.target.value })} isCompactView={isCompactView} />
                    <DetailField label={t('eyeColor')} value={character.eyeColor} editing={isInfoEditing} onBlur={(e) => updateCharacter(character.id, { eyeColor: e.target.value })} isCompactView={isCompactView} />
                </div>
                <div className="mt-4 grid grid-cols-1 gap-4">
                    <div className="space-y-1">
                        <Label className={cn("text-xs text-muted-foreground", isCompactView && "text-[10px]")}>{t('backstory')}</Label>
                        {isInfoEditing ? (
                            <Textarea defaultValue={character.backstory} className="min-h-[100px] resize-y" onBlur={(e) => updateCharacter(character.id, { backstory: e.target.value })} />
                        ) : (
                            <p className={cn("text-sm font-medium whitespace-pre-wrap break-words", isCompactView && "text-xs")}>{character.backstory || '-'}</p>
                        )}
                    </div>
                    <div className="space-y-1">
                        <Label className={cn("text-xs text-muted-foreground", isCompactView && "text-[10px]")}>{t('notes')}</Label>
                        {isInfoEditing ? (
                            <Textarea defaultValue={character.notes} className="min-h-[100px] resize-y" onBlur={(e) => updateCharacter(character.id, { notes: e.target.value })} />
                        ) : (
                            <p className={cn("text-sm font-medium whitespace-pre-wrap break-words", isCompactView && "text-xs")}>{character.notes || '-'}</p>
                        )}
                    </div>
                </div>
            </CardContent>
        </Card>
    );
};

export const ProgressionSection = ({ character, isCompactView, activeCompactSection, onEditingChange }: SectionProps) => {
    const { updateCharacter, showEditButtons } = useCharacterContext();
    const { t } = useTranslation();
    const [isProgressionEditing, setIsProgressionEditing] = React.useState(false);
    
    React.useEffect(() => { onEditingChange?.(isProgressionEditing); }, [isProgressionEditing, onEditingChange]);
    
    const [editableExperience, setEditableExperience] = React.useState(character.experience ?? 0);
    const [editableTotalExpSpent, setEditableTotalExpSpent] = React.useState(character.totalExpSpent ?? 0);
    const [editableAdvancedPath, setEditableAdvancedPath] = React.useState(character.advancedPath ?? null);
    const [editableAlternatePath, setEditableAlternatePath] = React.useState(character.alternatePath ?? null);
    const [amountToSpend, setAmountToSpend] = React.useState(0);
    
    const [isAdvancedPathModalOpen, setIsAdvancedPathModalOpen] = React.useState(false);
    const [isAlternateRankModalOpen, setIsAlternateRankModalOpen] = React.useState(false);

    const advancedPathThreshold = character.careerPath === 'Tech-Priest' ? 3000 : character.careerPath === 'Imperial Psyker' ? 2000 : ADVANCED_RANK_THRESHOLD;
    
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

    const showProgression = !isCompactView || activeCompactSection === 'progression-section';
    if (!showProgression) return null;

    return (
        <>
            <Card id="progression-section">
                <CardHeader className={cn("flex flex-row items-center justify-between px-6 pt-3 pb-6", isCompactView && "px-4 pt-2 pb-4")}>
                    <CardTitle className={cn("font-headline", isCompactView ? "text-lg" : "text-2xl")}>{t('progression')}</CardTitle>
                    {(showEditButtons || isProgressionEditing) && <EditSaveButton editing={isProgressionEditing} onEdit={() => setIsProgressionEditing(true)} onSave={() => {
                        handleSaveTotalExp();
                        setIsProgressionEditing(false);
                    }} />}
                </CardHeader>
                <CardContent className="pt-0">
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
                        
                        {/* Rank Display & Selection with exact label requested */}
                        <div className="space-y-1 pt-2 border-t">
                            <Label className="text-xs text-muted-foreground">{t('rank')}</Label>
                            <div className="flex flex-col gap-1">
                                <div className="flex items-center gap-2 flex-wrap">
                                    <p className="text-sm font-medium break-words">{currentRankName}</p>
                                    {(editableAdvancedPath ?? character.advancedPath) && (
                                        <span className="text-[10px] px-2 py-0.5 rounded bg-primary/10 text-primary font-semibold border border-primary/20">
                                            Advanced: {editableAdvancedPath ?? character.advancedPath}
                                        </span>
                                    )}
                                    {(editableAlternatePath ?? character.alternatePath) && (
                                        <span className="text-[10px] px-2 py-0.5 rounded bg-secondary/20 text-secondary-foreground font-semibold border border-secondary/20">
                                            Alternate: {editableAlternatePath ?? character.alternatePath}
                                        </span>
                                    )}
                                </div>
                                <div className="flex gap-2 mt-1">
                                    {editableTotalExpSpent >= advancedPathThreshold && ( 
                                        <Button size="sm" variant="outline" className="h-7 text-xs" onClick={() => setIsAdvancedPathModalOpen(true)}>
                                            {(editableAdvancedPath ?? character.advancedPath) ? 'Change Advanced Path' : 'Select Advanced Path'}
                                        </Button> 
                                    )}
                                    {canChooseAlternateRank && ( 
                                        <Button size="sm" variant="outline" className="h-7 text-xs" onClick={() => setIsAlternateRankModalOpen(true)}>
                                            {(editableAlternatePath ?? character.alternatePath) ? 'Change Alternate Rank' : 'Select Alternate Rank'}
                                        </Button> 
                                    )}
                                </div>
                            </div>
                        </div>
                    </div>
                </CardContent>
            </Card>

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