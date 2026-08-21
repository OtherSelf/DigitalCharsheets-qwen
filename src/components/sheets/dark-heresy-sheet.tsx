'use client';
import * as React from 'react';
import { type DarkHeresyCharacter, BodyPart } from '@/lib/types';
import { Card, CardContent, CardHeader, CardTitle } from '../ui/card';
import { Input } from '../ui/input';
import { Textarea } from '../ui/textarea';
import { Button } from '../ui/button';
import { Plus, Minus, ChevronRight, ChevronLeft } from 'lucide-react';
import { Label } from '@/components/ui/label';
import { useCharacterContext } from '@/context/character-context';
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';
import { cn } from '@/lib/utils';
import { useTranslation } from '@/context/language-context';
import { InfoSection, ProgressionSection } from './dh-sections/info-progression-section';
import { CharacteristicsSection } from './dh-sections/characteristics-section';
import { SkillsTalentsSection } from './dh-sections/skills-talents-section';
import { EquipmentInventorySection } from './dh-sections/equipment-inventory-section';
import { EditSaveButton, MetricBox } from './dh-sections/dh-ui-helpers';
import { Info } from 'lucide-react';
import { Checkbox } from '@/components/ui/checkbox';




const defaultArmor = { 'Head': null, 'Right arm': null, 'Body': null, 'Left arm': null, 'Right leg': null, 'Left leg': null };
const ArmorDisplay = ({ character, isCompactView }: { character: DarkHeresyCharacter; isCompactView: boolean; }) => {
    const armor = character.equipment?.armor ?? defaultArmor;
    const bodyPartLocations: Record<BodyPart, string> = {
        'Head': '1-10', 'Right arm': '11-20', 'Left arm': '21-30', 'Body': '31-70', 'Right leg': '71-85', 'Left leg': '86-00',
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

export const DarkHeresySheet = React.forwardRef<any, { character: DarkHeresyCharacter, isCompactView: boolean, activeCompactSection: string }>(
  ({ character, isCompactView, activeCompactSection }, ref) => {
    const { updateCharacter, setHasUnsavedChanges, hideNotes, showEditButtons } = useCharacterContext();
    const { t } = useTranslation();

    const [isPointsEditing, setIsPointsEditing] = React.useState(false);
    const [isSkillsPanelCollapsed, setIsSkillsPanelCollapsed] = React.useState(false);
    const [isEquipmentPanelCollapsed, setIsEquipmentPanelCollapsed] = React.useState(false);
    const characteristicsRef = React.useRef<{ saveAll: () => void }>(null);
    const skillsTalentsRef = React.useRef<{ saveAll: () => void }>(null);
    const equipmentInventoryRef = React.useRef<{ saveAll: () => void }>(null);
    const [sectionEditing, setSectionEditing] = React.useState<Record<string, boolean>>({});
    const reportSectionEditing = React.useCallback((key: string, val: boolean) => {
        setSectionEditing(prev => (prev[key] === val ? prev : { ...prev, [key]: val }));
    }, []);

    const getPointsObject = (p: any) => {
        if (typeof p === 'object' && p !== null && 'max' in p && 'current' in p) return { current: p.current, max: p.max, notes: p.notes || '' };
        return { current: 0, max: 0, notes: '' };
    };
    const getSimplePointsObject = (p: any) => {
        if (typeof p === 'object' && p !== null && 'total' in p) return { total: p.total, notes: p.notes || '' };
        return { total: 0, notes: '' };
    };

    const [editablePoints, setEditablePoints] = React.useState({
        wounds: getPointsObject(character.wounds),
        fatePoints: getPointsObject(character.fatePoints),
        insanityPoints: getSimplePointsObject(character.insanityPoints),
        corruptionPoints: getSimplePointsObject(character.corruptionPoints),
    });

    const isAnyEditing = isPointsEditing || Object.values(sectionEditing).some(Boolean);

    React.useEffect(() => { setHasUnsavedChanges(isAnyEditing); }, [isAnyEditing, setHasUnsavedChanges]);

    const handleSavePoints = React.useCallback(() => { updateCharacter(character.id, { wounds: editablePoints.wounds, fatePoints: editablePoints.fatePoints, insanityPoints: editablePoints.insanityPoints, corruptionPoints: editablePoints.corruptionPoints }); setIsPointsEditing(false); }, [character.id, editablePoints, updateCharacter]);

    const handleSaveAll = React.useCallback(() => {
      if (isPointsEditing) handleSavePoints();
      characteristicsRef.current?.saveAll();
      skillsTalentsRef.current?.saveAll();
      equipmentInventoryRef.current?.saveAll();
    }, [isPointsEditing, handleSavePoints]);
    React.useImperativeHandle(ref, () => ({ saveAll: handleSaveAll }));

    const handlePointChange = (pointType: 'wounds' | 'fatePoints' | 'insanityPoints' | 'corruptionPoints', delta: number) => {
        let dataToUpdate: Partial<DarkHeresyCharacter> = {};
        if (pointType === 'wounds' || pointType === 'fatePoints') {
            const currentPoints = getPointsObject(character[pointType]);
            const newVal = Math.max(0, currentPoints.current + delta);
            dataToUpdate[pointType] = { ...currentPoints, current: Math.min(newVal, currentPoints.max) };
        } else {
            const currentPoints = getSimplePointsObject(character[pointType]);
            dataToUpdate[pointType] = { ...currentPoints, total: Math.min(Math.max(currentPoints.total + delta, 0), 100) };
        }
        updateCharacter(character.id, dataToUpdate);
    };
  
    const handleNestedPointsChange = (pointType: 'wounds' | 'fatePoints', field: 'current' | 'max', value: string) => {
        setEditablePoints(prev => ({ ...prev, [pointType]: { ...prev[pointType], [field]: parseInt(value, 10) || 0 } }));
    };
    const handleSimplePointsChange = (point: 'insanityPoints' | 'corruptionPoints', field: 'total' | 'notes', value: string) => {
        if (field === 'total') {
            const numValue = parseInt(value, 10) || 0;
            setEditablePoints(prev => ({ ...prev, [point]: { ...prev[point], total: Math.min(Math.max(numValue, 0), 100) } }));
        } else {
            setEditablePoints(prev => ({ ...prev, [point]: { ...prev[point], notes: value } }));
        }
    };
   
    return (
        <div className="space-y-6">
            {isCompactView && (
                <div className="bg-card px-4 py-3 border-b shadow-sm space-y-3">
                    <div className="grid grid-cols-1 md:grid-cols-5 gap-1 items-start">
                        <div className="md:col-span-3">
                            <div className="flex-row items-center justify-between flex">
                                <div className="flex-1 justify-start p-0 h-auto hover:bg-transparent flex items-center"><CardTitle className="font-headline text-base">{t('characteristics')}</CardTitle></div>
                            </div>
                            <div className="grid grid-cols-5 gap-0.5 mt-2">
                                {[
                                    { key: 'weaponSkill', label: 'WS' },
                                    { key: 'ballisticSkill', label: 'BS' },
                                    { key: 'strength', label: 'S' },
                                    { key: 'toughness', label: 'T' },
                                    { key: 'agility', label: 'AG' },
                                    { key: 'intelligence', label: 'INT' },
                                    { key: 'perception', label: 'PER' },
                                    { key: 'willpower', label: 'WP' },
                                    { key: 'fellowship', label: 'FEL' },
                                    { key: 'influence', label: 'INF' },
                                ].map((char, idx) => {
                                    const stats = character.stats as Record<string, number>;
                                    const statUpgrades = character.statUpgrades as Record<string, boolean[]> | undefined;
                                    const statNotes = character.statNotes as Record<string, string> | undefined;
                                    const val = stats?.[char.key] || 0;
                                    const upgrades = (statUpgrades?.[char.key] || [false, false, false, false]) as boolean[];
                                    const bonus = upgrades.filter(Boolean).length * 5;
                                    const notes = statNotes?.[char.key] || '';
    
                                    return (
                                        <div key={char.key} className="relative bg-background border rounded-md text-center py-1 px-0.5 flex flex-col justify-between min-h-[60px]">
                                            {/* Info/Notes Button */}
                                            <Popover>
                                               <PopoverTrigger asChild>
                                                    <Button variant={notes ? 'secondary' : 'ghost'} size="icon" className="h-4 w-4 absolute top-0.5 right-0.5">
                                                        <Info className="h-2.5 w-2.5" />
                                                    </Button>
                                                </PopoverTrigger>
                                                <PopoverContent className="w-64 p-3" side="top" align="center">
                                                    <Label className="text-xs mb-2 block font-semibold">{char.label} - Notes</Label>
                                                    <Textarea 
                                                        defaultValue={notes} 
                                                        onBlur={(e) => {
                                                            const nextNotes = { ...(character.statNotes || {}), [char.key]: e.target.value };
                                                            updateCharacter(character.id, { statNotes: nextNotes });
                                                        }} 
                                                        placeholder="Add notes about this characteristic..." 
                                                        className="min-h-[80px] text-xs" 
                                                    />
                                                </PopoverContent>
                                            </Popover>
            
                                            {/* Stat Label */}
                                            <div className="text-[8px] font-semibold text-muted-foreground uppercase mt-1">{char.label}</div>
            
                                            {/* Value and Checkboxes (Flex Row) */}
                                            <div className="flex items-center justify-center gap-1 mt-1 mb-1">
                                                <div className="text-sm font-bold text-primary leading-tight">{val + bonus}</div>
                                                <div className="flex flex-col gap-[1px] items-center">
                                                    {upgrades.map((checked, upgradeIdx) => (
                                                        <Checkbox 
                                                            key={upgradeIdx} 
                                                            checked={checked} 
                                                            disabled={!checked && upgradeIdx > 0 && !upgrades[upgradeIdx - 1]}
                                                            onCheckedChange={(c) => {
                                                                const nextUpgrades = { ...character.statUpgrades };
                                                                const specific = [...(nextUpgrades[char.key] || [false, false, false, false])];
                                                                specific[upgradeIdx] = !!c;
                                                                if (!c) {
                                                                    for (let i = upgradeIdx + 1; i < specific.length; i++) {
                                                                        specific[i] = false;
                                                                    }
                                                                }
                                                                nextUpgrades[char.key] = specific as [boolean, boolean, boolean, boolean];
                                                                updateCharacter(character.id, { statUpgrades: nextUpgrades });
                                                            }}
                                                            className="h-2.5 w-2.5 data-[state=checked]:bg-primary" 
                                                        />
                                                    ))}
                                                </div>
                                            </div>
                                        </div>
                                    );
                                })}
                            </div>
                        </div>
                        <div className="md:col-span-2 grid grid-cols-2 gap-1 px-1 mt-1">
                            <MetricBox title={t('wounds')} notes={getPointsObject(character.wounds).notes} onNoteChange={(val) => updateCharacter(character.id, { wounds: { ...getPointsObject(character.wounds), notes: val } })} editing={isPointsEditing} onEdit={() => setIsPointsEditing(true)} onSave={handleSavePoints} isCompactView={isCompactView} hideNotes={hideNotes} showEditButtons={showEditButtons}>
                              <div className="flex items-center justify-center gap-1">
                                {isPointsEditing ? (
                                  <><Input type="number" value={editablePoints.wounds.current} onChange={e => handleNestedPointsChange('wounds', 'current', e.target.value)} className="h-6 w-10 text-xs px-1 text-center"/><span className="text-[10px] text-muted-foreground">/</span><Input type="number" value={editablePoints.wounds.max} onChange={e => handleNestedPointsChange('wounds', 'max', e.target.value)} className="h-6 w-10 text-xs px-1 text-center"/></>
                                ) : (
                                  <div className="flex items-center justify-center gap-1">
                                    <Button size="icon" variant="outline" className="h-5 w-5" onClick={() => handlePointChange('wounds', -1)}><Minus className="h-3 w-3" /></Button>
                                    <span className="font-bold text-sm min-w-[1.2rem] text-center">{getPointsObject(character.wounds).current}</span>
                                    <Button size="icon" variant="outline" className="h-5 w-5" onClick={() => handlePointChange('wounds', 1)}><Plus className="h-3 w-3" /></Button>
                                    <span className="text-[10px] text-muted-foreground mx-0.5">/</span>
                                    <span className="text-sm">{getPointsObject(character.wounds).max}</span>
                                  </div>
                                )}
                              </div>
                            </MetricBox>
                            <MetricBox title={t('fate')} notes={getPointsObject(character.fatePoints).notes} onNoteChange={(val) => updateCharacter(character.id, { fatePoints: { ...getPointsObject(character.fatePoints), notes: val } })} editing={isPointsEditing} onEdit={() => setIsPointsEditing(true)} onSave={handleSavePoints} isCompactView={isCompactView} hideNotes={hideNotes} showEditButtons={showEditButtons}>
                              <div className="flex items-center justify-center gap-1">
                                {isPointsEditing ? (
                                  <><Input type="number" value={editablePoints.fatePoints.current} onChange={e => handleNestedPointsChange('fatePoints', 'current', e.target.value)} className="h-6 w-10 text-xs px-1 text-center"/><span className="text-[10px] text-muted-foreground">/</span><Input type="number" value={editablePoints.fatePoints.max} onChange={e => handleNestedPointsChange('fatePoints', 'max', e.target.value)} className="h-6 w-10 text-xs px-1 text-center"/></>
                                ) : (
                                  <div className="flex items-center justify-center gap-1">
                                    <Button size="icon" variant="outline" className="h-5 w-5" onClick={() => handlePointChange('fatePoints', -1)}><Minus className="h-3 w-3" /></Button>
                                    <span className="font-bold text-sm min-w-[1.2rem] text-center">{getPointsObject(character.fatePoints).current}</span>
                                    <Button size="icon" variant="outline" className="h-5 w-5" onClick={() => handlePointChange('fatePoints', 1)}><Plus className="h-3 w-3" /></Button>
                                    <span className="text-[10px] text-muted-foreground mx-0.5">/</span>
                                    <span className="text-sm">{getPointsObject(character.fatePoints).max}</span>
                                  </div>
                                )}
                              </div>
                            </MetricBox>
                            <MetricBox title={t('insanity')} notes={getSimplePointsObject(character.insanityPoints).notes} onNoteChange={(val) => updateCharacter(character.id, { insanityPoints: { ...getSimplePointsObject(character.insanityPoints), notes: val } })} editing={isPointsEditing} onEdit={() => setIsPointsEditing(true)} onSave={handleSavePoints} isCompactView={isCompactView} hideNotes={hideNotes} showEditButtons={showEditButtons}>
                              <div className="flex items-center justify-center gap-1">
                                {isPointsEditing ? ( 
                                  <Input type="number" value={editablePoints.insanityPoints.total} onChange={e => handleSimplePointsChange('insanityPoints', 'total', e.target.value)} className="h-6 w-12 text-xs px-1 text-center mx-auto"/> 
                                ) : ( 
                                  <div className="flex items-center justify-center gap-1">
                                    <Button size="icon" variant="outline" className="h-5 w-5" onClick={() => handlePointChange('insanityPoints', -1)}><Minus className="h-3 w-3" /></Button>
                                    <span className="font-bold text-sm min-w-[1.2rem] text-center">{getSimplePointsObject(character.insanityPoints).total}</span>
                                    <Button size="icon" variant="outline" className="h-5 w-5" onClick={() => handlePointChange('insanityPoints', 1)}><Plus className="h-3 w-3" /></Button>
                                  </div>
                                )}
                              </div>
                            </MetricBox>
                            <MetricBox title={t('corruption')} notes={getSimplePointsObject(character.corruptionPoints).notes} onNoteChange={(val) => updateCharacter(character.id, { corruptionPoints: { ...getSimplePointsObject(character.corruptionPoints), notes: val } })} editing={isPointsEditing} onEdit={() => setIsPointsEditing(true)} onSave={handleSavePoints} isCompactView={isCompactView} hideNotes={hideNotes} showEditButtons={showEditButtons}>
                              <div className="flex items-center justify-center gap-1">
                                {isPointsEditing ? ( 
                                  <Input type="number" value={editablePoints.corruptionPoints.total} onChange={e => handleSimplePointsChange('corruptionPoints', 'total', e.target.value)} className="h-6 w-12 text-xs px-1 text-center mx-auto"/> 
                                ) : ( 
                                  <div className="flex items-center justify-center gap-1">
                                    <Button size="icon" variant="outline" className="h-5 w-5" onClick={() => handlePointChange('corruptionPoints', -1)}><Minus className="h-3 w-3" /></Button>
                                    <span className="font-bold text-sm min-w-[1.2rem] text-center">{getSimplePointsObject(character.corruptionPoints).total}</span>
                                    <Button size="icon" variant="outline" className="h-5 w-5" onClick={() => handlePointChange('corruptionPoints', 1)}><Plus className="h-3 w-3" /></Button>
                                  </div>
                                )}
                              </div>
                            </MetricBox>
                          </div>
                          {/* Compact Movement Display - FIXED */}
                          <div className="grid grid-cols-4 gap-1 mt-2 px-1 md:col-span-2">
                              {(() => {
                                  const agUpgrades = (character.statUpgrades?.agility || [false, false, false, false]) as boolean[];
                                  const agBonus = agUpgrades.filter(Boolean).length * 5;
                                  const effectiveAg = character.stats.agility + agBonus;
                                  const agMod = Math.floor(effectiveAg / 10);
        
                                  return (
                                      <>
                                          <div className="p-1 rounded bg-background/50 border text-center">
                                              <div className="text-[8px] text-muted-foreground uppercase">½ Move</div>
                                              <div className="text-xs font-bold">{agMod}</div>
                                          </div>
                                          <div className="p-1 rounded bg-background/50 border text-center">
                                              <div className="text-[8px] text-muted-foreground uppercase">Move</div>
                                              <div className="text-xs font-bold">{agMod * 2}</div>
                                          </div>
                                          <div className="p-1 rounded bg-background/50 border text-center">
                                              <div className="text-[8px] text-muted-foreground uppercase">Charge</div>
                                              <div className="text-xs font-bold">{agMod * 3}</div>
                                          </div>
                                         <div className="p-1 rounded bg-background/50 border text-center">
                                              <div className="text-[8px] text-muted-foreground uppercase">Run</div>
                                              <div className="text-xs font-bold">{agMod * 6}</div>
                                          </div>
                                      </>
                                  );
                              })()}
                          </div>
                    </div>
                </div>
            )}
            <div className={cn("grid grid-cols-1 lg:grid-cols-12 gap-6", isCompactView && !['info-section', 'progression-section'].includes(activeCompactSection) && 'hidden')}>
                {/* INFO BOX: Left side (5 columns) */}
                <div className={cn("lg:col-span-5", isCompactView && activeCompactSection !== 'info-section' && 'hidden')}>
                    <InfoSection 
                        character={character} 
                        isCompactView={isCompactView} 
                        activeCompactSection={activeCompactSection}
                        onEditingChange={(v) => reportSectionEditing('info', v)}
                    />
                </div>

                {/* PROGRESSION BOX: Middle (4 columns) */}
                <div className={cn("lg:col-span-4", isCompactView && activeCompactSection !== 'progression-section' && 'hidden')}>
                    <ProgressionSection 
                        character={character} 
                        isCompactView={isCompactView} 
                        activeCompactSection={activeCompactSection}
                        onEditingChange={(v) => reportSectionEditing('progression', v)}
                    />
                </div>

                {/* ARMOR DIAGRAM: Right side (3 columns) */}
                {!isCompactView && ( 
                    <div className="hidden lg:block lg:col-span-3 overflow-hidden">
                        <ArmorDisplay character={character} isCompactView={isCompactView} />
                    </div> 
                )}
            </div>
      
            <div className={cn("flex flex-row items-stretch gap-2 md:gap-6", isCompactView && !['skills-section', 'talents-section', 'equipment-section', 'inventory-section'].includes(activeCompactSection) && 'hidden' )}>
                 <div className={cn("transition-all duration-300 ease-in-out", isCompactView ? ( !['skills-section', 'talents-section'].includes(activeCompactSection) ? 'hidden' : 'flex-1' ) : (isSkillsPanelCollapsed ? "w-12 flex-shrink-0" : "flex-1 min-w-0"))}>
                    {isSkillsPanelCollapsed && !isCompactView ? ( <Card className="flex items-center justify-center h-full"><Button variant="ghost" className="h-full w-full py-4" onClick={() => setIsSkillsPanelCollapsed(false)}><span className="[writing-mode:vertical-rl] transform rotate-180 whitespace-nowrap text-center text-sm font-semibold tracking-widest uppercase text-muted-foreground">{t('skills')}, {t('talentsAndTraits')}, {t('wounds')} &amp; {t('fate')}</span></Button></Card> ) : (
                        <Card>
                            <CardHeader className="flex-row items-center justify-between px-6 pt-3 pb-6"><CardTitle className="font-headline">{t('skills')}, {t('talentsAndTraits')}, {t('wounds')} &amp; {t('fate')}</CardTitle><Button variant="ghost" size="icon" onClick={() => setIsSkillsPanelCollapsed(true)} aria-label="Collapse Panel" className={cn(isCompactView && 'hidden')}><ChevronLeft className="h-5 w-5" /></Button></CardHeader>
                            <CardContent className="pt-0 space-y-8">
                                <SkillsTalentsSection ref={skillsTalentsRef} onEditingChange={(v) => reportSectionEditing('skills', v)} character={character} isCompactView={isCompactView} activeCompactSection={activeCompactSection} />
                                {!isCompactView && ( <div className="grid grid-cols-2 gap-4">
                                      <MetricBox title={t('wounds')} notes={getPointsObject(character.wounds).notes} onNoteChange={(val) => updateCharacter(character.id, { wounds: { ...getPointsObject(character.wounds), notes: val } })} editing={isPointsEditing} onEdit={() => setIsPointsEditing(true)} onSave={handleSavePoints} isCompactView={isCompactView} hideNotes={hideNotes} showEditButtons={showEditButtons}><div className="text-center flex flex-col justify-center items-center h-full">{isPointsEditing ? ( <div className="flex items-center justify-center gap-2"><Input type="number" value={editablePoints.wounds.current} onChange={e => handleNestedPointsChange('wounds', 'current', e.target.value)} className="text-lg font-bold h-8 w-16 text-center"/><span className="text-muted-foreground">/</span><Input type="number" value={editablePoints.wounds.max} onChange={e => handleNestedPointsChange('wounds', 'max', e.target.value)} className="text-lg font-bold h-8 w-16 text-center"/></div> ) : ( <div className="flex items-center justify-center gap-2"><Button size="icon" variant="outline" className="h-6 w-6" onClick={() => handlePointChange('wounds', -1)}><Minus className="h-4 w-4" /></Button><p className="text-2xl font-bold text-primary w-12 text-center">{getPointsObject(character.wounds).current}</p><Button size="icon" variant="outline" className="h-6 w-6" onClick={() => handlePointChange('wounds', 1)}><Plus className="h-4 w-4" /></Button><p className="text-xl font-medium text-muted-foreground ml-2">/ {getPointsObject(character.wounds).max}</p></div> )}</div></MetricBox>
                                      <MetricBox title={t('fate')} notes={getPointsObject(character.fatePoints).notes} onNoteChange={(val) => updateCharacter(character.id, { fatePoints: { ...getPointsObject(character.fatePoints), notes: val } })} editing={isPointsEditing} onEdit={() => setIsPointsEditing(true)} onSave={handleSavePoints} isCompactView={isCompactView} hideNotes={hideNotes} showEditButtons={showEditButtons}><div className="text-center flex flex-col justify-center items-center h-full">{isPointsEditing ? ( <div className="flex items-center justify-center gap-2"><Input type="number" value={editablePoints.fatePoints.current} onChange={e => handleNestedPointsChange('fatePoints', 'current', e.target.value)} className="text-lg font-bold h-8 w-16 text-center"/><span className="text-muted-foreground">/</span><Input type="number" value={editablePoints.fatePoints.max} onChange={e => handleNestedPointsChange('fatePoints', 'max', e.target.value)} className="text-lg font-bold h-8 w-16 text-center"/></div> ) : ( <div className="flex items-center justify-center gap-2"><Button size="icon" variant="outline" className="h-6 w-6" onClick={() => handlePointChange('fatePoints', -1)}><Minus className="h-4 w-4" /></Button><p className="text-2xl font-bold text-primary w-12 text-center">{getPointsObject(character.fatePoints).current}</p><Button size="icon" variant="outline" className="h-6 w-6" onClick={() => handlePointChange('fatePoints', 1)}><Plus className="h-4 w-4" /></Button><p className="text-xl font-medium text-muted-foreground ml-2">/ {getPointsObject(character.fatePoints).max}</p></div> )}</div></MetricBox>
                                </div> )}
                            </CardContent>
                        </Card>
                    )}
                </div>

                {!isCompactView && (
                <div className={cn("transition-all duration-300 ease-in-out flex-shrink-0", (isSkillsPanelCollapsed && isEquipmentPanelCollapsed) ? "flex-1" : "w-auto")}>
                    <CharacteristicsSection ref={characteristicsRef} onEditingChange={(v) => reportSectionEditing('characteristics', v)} character={character} isCompactView={isCompactView} isSkillsPanelCollapsed={isSkillsPanelCollapsed} isEquipmentPanelCollapsed={isEquipmentPanelCollapsed} />
                </div>
                )}
                
                <div className={cn("transition-all duration-300 ease-in-out", isCompactView ? ( !['equipment-section', 'inventory-section'].includes(activeCompactSection) ? 'hidden' : 'flex-1' ) : (isEquipmentPanelCollapsed ? "w-12 flex-shrink-0" : "flex-1 min-w-0"))}>
                    {isEquipmentPanelCollapsed && !isCompactView ? ( <Card className="flex items-center justify-center h-full"><Button variant="ghost" className="h-full w-full py-4" onClick={() => setIsEquipmentPanelCollapsed(false)}><span className="[writing-mode:vertical-rl] transform rotate-180 whitespace-nowrap text-center text-sm font-semibold tracking-widest uppercase text-muted-foreground">{t('equipment')}, {t('inventory')} &amp; {t('corruption')}</span></Button></Card> ) : (
                        <Card>
                            <CardHeader className={cn("flex-row items-center justify-between px-6 pt-3 pb-6", isCompactView && "hidden")}><CardTitle className="font-headline">{t('equipment')}, {t('inventory')} &amp; {t('corruption')}</CardTitle><Button variant="ghost" size="icon" onClick={() => setIsEquipmentPanelCollapsed(true)} aria-label="Collapse Panel"><ChevronRight className="h-5 w-5" /></Button></CardHeader>
                                <CardContent className="pt-0 space-y-8">
                                    <EquipmentInventorySection ref={equipmentInventoryRef} onEditingChange={(v) => reportSectionEditing('equipment', v)} character={character} isCompactView={isCompactView} activeCompactSection={activeCompactSection} />
                                        {!isCompactView && ( <div className="grid grid-cols-2 gap-4">
                                            <MetricBox title={t('insanity')} notes={getSimplePointsObject(character.insanityPoints).notes} onNoteChange={(val) => updateCharacter(character.id, { insanityPoints: { ...getSimplePointsObject(character.insanityPoints), notes: val } })} editing={isPointsEditing} onEdit={() => setIsPointsEditing(true)} onSave={handleSavePoints} isCompactView={isCompactView} hideNotes={hideNotes} showEditButtons={showEditButtons}><div className="text-center flex flex-col justify-center items-center h-full">{isPointsEditing ? ( <Input type="number" value={editablePoints.insanityPoints.total} onChange={e => handleSimplePointsChange('insanityPoints', 'total', e.target.value)} className="text-lg font-bold h-8 w-16 text-center mx-auto"/> ) : ( <div className="flex items-center justify-center gap-2"><Button size="icon" variant="outline" className="h-6 w-6" onClick={() => handlePointChange('insanityPoints', -1)}><Minus className="h-4 w-4" /></Button><p className="text-2xl font-bold text-primary w-12 text-center">{getSimplePointsObject(character.insanityPoints).total}</p><Button size="icon" variant="outline" className="h-6 w-6" onClick={() => handlePointChange('insanityPoints', 1)}><Plus className="h-4 w-4" /></Button></div> )}</div></MetricBox>
                                            <MetricBox title={t('corruption')} notes={getSimplePointsObject(character.corruptionPoints).notes} onNoteChange={(val) => updateCharacter(character.id, { corruptionPoints: { ...getSimplePointsObject(character.corruptionPoints), notes: val } })} editing={isPointsEditing} onEdit={() => setIsPointsEditing(true)} onSave={handleSavePoints} isCompactView={isCompactView} hideNotes={hideNotes} showEditButtons={showEditButtons}><div className="text-center flex flex-col justify-center items-center h-full">{isPointsEditing ? ( <Input type="number" value={editablePoints.corruptionPoints.total} onChange={e => handleSimplePointsChange('corruptionPoints', 'total', e.target.value)} className="text-lg font-bold h-8 w-16 text-center mx-auto"/> ) : ( <div className="flex items-center justify-center gap-2"><Button size="icon" variant="outline" className="h-6 w-6" onClick={() => handlePointChange('corruptionPoints', -1)}><Minus className="h-4 w-4" /></Button><p className="text-2xl font-bold text-primary w-12 text-center">{getSimplePointsObject(character.corruptionPoints).total}</p><Button size="icon" variant="outline" className="h-6 w-6" onClick={() => handlePointChange('corruptionPoints', 1)}><Plus className="h-4 w-4" /></Button></div> )}</div></MetricBox>
                                        </div> )}
                            </CardContent>
                        </Card>
                    )}
                </div>
            </div>
         </div>
    );
  }
);

DarkHeresySheet.displayName = 'DarkHeresySheet';