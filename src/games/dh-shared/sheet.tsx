'use client';

import * as React from 'react';

import {
  ChevronLeft,
  ChevronRight,
  Info,
  Minus,
  Plus,
  Trash2,
} from 'lucide-react';

import { CharacteristicsSection } from '@/components/sheets/dh-sections/characteristics-section';
import { CustomResourceCounter } from '@/components/sheets/dh-sections/custom-resource-counter';
import {
  EditSaveButton,
  MetricBox,
} from '@/components/sheets/dh-sections/dh-ui-helpers';
import { EquipmentInventorySection } from '@/components/sheets/dh-sections/equipment-inventory-section';
import {
  InfoSection,
  ProgressionSection,
} from '@/components/sheets/dh-sections/info-progression-section';
import { SkillsTalentsSection } from '@/components/sheets/dh-sections/skills-talents-section';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Checkbox } from '@/components/ui/checkbox';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from '@/components/ui/popover';
import { Textarea } from '@/components/ui/textarea';
import { useCharacterContext } from '@/context/character-context';
import { useTranslation } from '@/context/language-context';
import type { DarkHeresyCharacter } from '@/lib/types';
import { cn } from '@/lib/utils';

import type { BodyPart } from './types';

const defaultArmor = {
  Head: null,
  'Right arm': null,
  Body: null,
  'Left arm': null,
  'Right leg': null,
  'Left leg': null,
};

const ArmorDisplay = ({
  character,
  isCompactView,
}: {
  character: DarkHeresyCharacter;
  isCompactView: boolean;
}) => {
  const { t } = useTranslation();
  const armor = character.equipment?.armor ?? defaultArmor;
  const bodyPartLocations: Record<BodyPart, string> = {
    Head: '1-10',
    'Right arm': '11-20',
    'Left arm': '21-30',
    Body: '31-70',
    'Right leg': '71-85',
    'Left leg': '86-00',
  };
  const displayArmorType = (type: string | undefined | null) => {
    if (!type) return '—';
    const translationKey = `armorType${type}` as any;
    const translated = t(translationKey);
    return translated === translationKey ? type : translated;
  };
  const ArmorBox = ({
    part,
    location,
  }: {
    part: BodyPart;
    location: string;
  }) => {
    const armorPiece = armor[part];
    const bodyPartKey: Record<BodyPart, string> = {
      Head: 'dh.bodyPartHead',
      'Right arm': 'dh.bodyPartRightArm',
      'Left arm': 'dh.bodyPartLeftArm',
      Body: 'dh.bodyPartBody',
      'Right leg': 'dh.bodyPartRightLeg',
      'Left leg': 'dh.bodyPartLeftLeg',
    };
    const title = t(bodyPartKey[part] || part);
    return (
      <div
        className={cn(
          'bg-card text-card-foreground flex w-full min-w-0 flex-col items-center rounded-md border shadow-md',
          isCompactView ? 'p-1' : 'p-2',
        )}
      >
        <h4
          className={cn(
            'w-full truncate px-1 text-center font-bold',
            isCompactView ? 'text-[10px]' : 'text-xs',
          )}
        >
          {title}
        </h4>
        <div className="text-muted-foreground mb-1 text-[10px]">
          ({location})
        </div>
        <div
          className={cn(
            'w-full space-y-0.5',
            isCompactView ? 'text-[9px]' : 'text-center text-[10px]',
          )}
        >
          <p className="truncate">
            <strong className="text-muted-foreground">
              {t('dh.armorAp')}:{' '}
            </strong>
            {armorPiece?.ap ?? '—'}
          </p>
          <p className="truncate">
            <strong className="text-muted-foreground">
              {t('dh.armorType')}:{' '}
            </strong>
            {displayArmorType(armorPiece?.type)}
          </p>
        </div>
      </div>
    );
  };
  return (
    <div className="grid w-full max-w-full grid-cols-3 gap-x-2 gap-y-4 overflow-hidden pt-8">
      <div />{' '}
      <div className="flex items-start justify-center">
        {' '}
        <ArmorBox part="Head" location={bodyPartLocations['Head']} />{' '}
      </div>{' '}
      <div />
      <div className="mt-2 flex flex-col justify-start">
        {' '}
        <ArmorBox
          part="Left arm"
          location={bodyPartLocations['Left arm']}
        />{' '}
      </div>
      <div className="mt-8">
        {' '}
        <ArmorBox part="Body" location={bodyPartLocations['Body']} />{' '}
      </div>
      <div className="mt-2 flex flex-col justify-start">
        {' '}
        <ArmorBox
          part="Right arm"
          location={bodyPartLocations['Right arm']}
        />{' '}
      </div>
      <div className="-mt-2">
        {' '}
        <ArmorBox
          part="Left leg"
          location={bodyPartLocations['Left leg']}
        />{' '}
      </div>{' '}
      <div />
      <div className="-mt-2">
        {' '}
        <ArmorBox
          part="Right leg"
          location={bodyPartLocations['Right leg']}
        />{' '}
      </div>
    </div>
  );
};

export const DarkHeresySheet = React.forwardRef<
  any,
  {
    character: DarkHeresyCharacter;
    isCompactView: boolean;
    activeCompactSection: string;
  }
>(({ character, isCompactView, activeCompactSection }, ref) => {
  const {
    updateCharacter,
    setHasUnsavedChanges,
    hideNotes,
    showEditButtons,
    isTabletScreen,
  } = useCharacterContext();
  const { t } = useTranslation();
  const [isPointsEditing, setIsPointsEditing] = React.useState(false);
  const [isSkillsPanelCollapsed, setIsSkillsPanelCollapsed] =
    React.useState(false);
  const [isEquipmentPanelCollapsed, setIsEquipmentPanelCollapsed] =
    React.useState(false);
  const [isCharacteristicsEditing, setIsCharacteristicsEditing] =
    React.useState(false);
  const [editableStats, setEditableStats] = React.useState(character.stats);
  const [editableStatUpgrades, setEditableStatUpgrades] = React.useState(
    character.statUpgrades ?? {},
  );

  React.useEffect(() => {
    setEditableStats(character.stats);
    setEditableStatUpgrades(character.statUpgrades ?? {});
  }, [character.stats, character.statUpgrades]);

  const handleSaveCharacteristics = React.useCallback(() => {
    updateCharacter(character.id, {
      stats: editableStats,
      statUpgrades: editableStatUpgrades,
    });
    setIsCharacteristicsEditing(false);
  }, [character.id, editableStats, editableStatUpgrades, updateCharacter]);

  const characteristicsRef = React.useRef<{ saveAll: () => void }>(null);
  const skillsTalentsRef = React.useRef<{ saveAll: () => void }>(null);
  const equipmentInventoryRef = React.useRef<{ saveAll: () => void }>(null);
  const [sectionEditing, setSectionEditing] = React.useState<
    Record<string, boolean>
  >({});
  const reportSectionEditing = React.useCallback(
    (key: string, val: boolean) => {
      setSectionEditing((prev) =>
        prev[key] === val ? prev : { ...prev, [key]: val },
      );
    },
    [],
  );

  const getPointsObject = (p: any) => {
    if (typeof p === 'object' && p !== null && 'max' in p && 'current' in p)
      return { current: p.current, max: p.max, notes: p.notes || '' };
    return { current: 0, max: 0, notes: '' };
  };
  const getSimplePointsObject = (p: any) => {
    if (typeof p === 'object' && p !== null && 'total' in p)
      return { total: p.total, notes: p.notes || '' };
    return { total: 0, notes: '' };
  };

  const [editablePoints, setEditablePoints] = React.useState({
    wounds: getPointsObject(character.wounds),
    fatePoints: getPointsObject(character.fatePoints),
    insanityPoints: getSimplePointsObject(character.insanityPoints),
    corruptionPoints: getSimplePointsObject(character.corruptionPoints),
  });

  React.useEffect(() => {
    setEditablePoints({
      wounds: getPointsObject(character.wounds),
      fatePoints: getPointsObject(character.fatePoints),
      insanityPoints: getSimplePointsObject(character.insanityPoints),
      corruptionPoints: getSimplePointsObject(character.corruptionPoints),
    });
  }, [
    character.wounds,
    character.fatePoints,
    character.insanityPoints,
    character.corruptionPoints,
  ]);

  const isAnyEditing =
    isPointsEditing || Object.values(sectionEditing).some(Boolean);
  React.useEffect(() => {
    setHasUnsavedChanges(isAnyEditing);
  }, [isAnyEditing, setHasUnsavedChanges]);

  const handleSavePoints = React.useCallback(() => {
    updateCharacter(character.id, {
      wounds: editablePoints.wounds,
      fatePoints: editablePoints.fatePoints,
      insanityPoints: editablePoints.insanityPoints,
      corruptionPoints: editablePoints.corruptionPoints,
    });
    setIsPointsEditing(false);
  }, [character.id, editablePoints, updateCharacter]);

  const handleSaveAll = React.useCallback(() => {
    if (isPointsEditing) handleSavePoints();
    characteristicsRef.current?.saveAll();
    skillsTalentsRef.current?.saveAll();
    equipmentInventoryRef.current?.saveAll();
  }, [isPointsEditing, handleSavePoints]);

  React.useImperativeHandle(ref, () => ({ saveAll: handleSaveAll }));

  const handlePointChange = (
    pointType: 'wounds' | 'fatePoints' | 'insanityPoints' | 'corruptionPoints',
    delta: number,
  ) => {
    const dataToUpdate: Partial<DarkHeresyCharacter> = {};
    if (pointType === 'wounds' || pointType === 'fatePoints') {
      const currentPoints = getPointsObject(character[pointType]);
      const newVal = currentPoints.current + delta;
      dataToUpdate[pointType] = {
        ...currentPoints,
        current: Math.min(newVal, currentPoints.max),
      };
    } else {
      const currentPoints = getSimplePointsObject(character[pointType]);
      dataToUpdate[pointType] = {
        ...currentPoints,
        total: Math.min(currentPoints.total + delta, 100),
      };
    }
    updateCharacter(character.id, dataToUpdate);
  };

  // ─── LANDMARK: FATIGUE & CRITICAL CONDITIONS LOGIC (EXISTING) ───
  const [newCriticalCondition, setNewCriticalCondition] = React.useState('');
  const getEffectiveStat = (statKey: keyof typeof character.stats) => {
    const baseStat = character.stats[statKey];
    const upgrades = character.statUpgrades?.[statKey] || [
      false,
      false,
      false,
      false,
    ];
    const bonus = upgrades.filter(Boolean).length * 5;
    return baseStat + bonus;
  };
  const getStatMod = (stat: number) => Math.floor(stat / 10);
  const effectiveToughness = getEffectiveStat('toughness');
  const effectiveWillpower = getEffectiveStat('willpower');
  const fatigue1stMax = Math.max(0, getStatMod(effectiveToughness));
  const fatigue2ndMax = Math.max(
    0,
    getStatMod(effectiveToughness) + getStatMod(effectiveWillpower),
  );
  const handleFatigueChange = (edition: '1st' | '2nd', delta: number) => {
    const key = edition === '1st' ? 'fatigue1st' : 'fatigue2nd';
    const currentData =
      edition === '1st' ? character.fatigue1st : character.fatigue2nd;
    const currentVal = currentData?.current ?? 0;
    const maxVal = edition === '1st' ? fatigue1stMax : fatigue2ndMax;
    const newVal = Math.max(0, Math.min(currentVal + delta, maxVal));
    updateCharacter(character.id, {
      [key]: { ...(currentData || {}), current: newVal },
    });
  };
  const addCriticalCondition = () => {
    if (newCriticalCondition.trim() !== '') {
      const currentConditions = character.criticalConditions || [];
      updateCharacter(character.id, {
        criticalConditions: [
          ...currentConditions,
          {
            id: `new-cc-${Date.now()}`,
            name: newCriticalCondition.trim(),
            notes: '',
          },
        ],
      });
      setNewCriticalCondition('');
    }
  };
  const removeCriticalCondition = (id: string) => {
    const currentConditions = character.criticalConditions || [];
    updateCharacter(character.id, {
      criticalConditions: currentConditions.filter((c) => c.id !== id),
    });
  };
  // ─── END FATIGUE & CRITICAL CONDITIONS LOGIC ───

  const handleNestedPointsChange = (
    pointType: 'wounds' | 'fatePoints',
    field: 'current' | 'max',
    value: string,
  ) => {
    setEditablePoints((prev) => ({
      ...prev,
      [pointType]: { ...prev[pointType], [field]: parseInt(value, 10) || 0 },
    }));
  };
  const handleSimplePointsChange = (
    point: 'insanityPoints' | 'corruptionPoints',
    field: 'total' | 'notes',
    value: string,
  ) => {
    if (field === 'total') {
      const numValue = parseInt(value, 10) || 0;
      setEditablePoints((prev) => ({
        ...prev,
        [point]: { ...prev[point], total: Math.min(numValue, 100) },
      }));
    } else {
      setEditablePoints((prev) => ({
        ...prev,
        [point]: { ...prev[point], notes: value },
      }));
    }
  };

  return (
    <div className={cn('dh-sheet space-y-6', isCompactView && 'is-compact')}>
      {isCompactView && (
        <div
          data-testid="characteristics-compact"
          className="bg-card space-y-3 border-b px-4 py-3 shadow-sm"
        >
          <div className="grid grid-cols-1 items-start gap-1 md:grid-cols-5">
            <div className="md:col-span-3">
              <div className="flex flex-row items-center justify-between">
                <div className="flex h-auto flex-1 items-center justify-start p-0 hover:bg-transparent">
                  <CardTitle className="font-headline text-base">
                    {t('common.characteristics')}
                  </CardTitle>
                </div>
                <EditSaveButton
                  editing={isCharacteristicsEditing}
                  onEdit={() => setIsCharacteristicsEditing(true)}
                  onSave={handleSaveCharacteristics}
                />
              </div>
              <div className="mt-2 grid grid-cols-5 gap-0.5">
                {(
                  [
                    {
                      key: 'weaponSkill' as const,
                      label: t('dh.weaponSkillAbbr'),
                    },
                    {
                      key: 'ballisticSkill' as const,
                      label: t('dh.ballisticSkillAbbr'),
                    },
                    { key: 'strength' as const, label: t('dh.strengthAbbr') },
                    { key: 'toughness' as const, label: t('dh.toughnessAbbr') },
                    { key: 'agility' as const, label: t('dh.agilityAbbr') },
                    {
                      key: 'intelligence' as const,
                      label: t('dh.intelligenceAbbr'),
                    },
                    {
                      key: 'perception' as const,
                      label: t('dh.perceptionAbbr'),
                    },
                    { key: 'willpower' as const, label: t('dh.willpowerAbbr') },
                    {
                      key: 'fellowship' as const,
                      label: t('dh.fellowshipAbbr'),
                    },
                    { key: 'influence' as const, label: t('dh.influenceAbbr') },
                  ] as const
                )
                  .filter((c) =>
                    character.edition === '1st' || !character.edition
                      ? c.key !== 'influence'
                      : true,
                  )
                  .map((char, idx) => {
                    const stats = isCharacteristicsEditing
                      ? editableStats
                      : character.stats;
                    const statUpgrades = isCharacteristicsEditing
                      ? editableStatUpgrades
                      : character.statUpgrades || {};
                    const statNotes = character.statNotes as
                      Record<string, string> | undefined;
                    const val = stats?.[char.key] || 0;
                    const upgrades = (statUpgrades?.[char.key] || [
                      false,
                      false,
                      false,
                      false,
                    ]) as boolean[];
                    const bonus = upgrades.filter(Boolean).length * 5;
                    const notes = statNotes?.[char.key] || '';
                    return (
                      <div
                        key={char.key}
                        className="bg-background relative flex min-h-[60px] flex-col justify-between rounded-md border px-0.5 py-1 text-center"
                      >
                        <Popover>
                          <PopoverTrigger asChild>
                            <Button
                              variant={notes ? 'secondary' : 'ghost'}
                              size="icon"
                              className="absolute top-0.5 right-0.5 h-4 w-4"
                            >
                              <Info className="h-2.5 w-2.5" />
                            </Button>
                          </PopoverTrigger>
                          <PopoverContent
                            className="w-64 p-3"
                            side="top"
                            align="center"
                          >
                            <Label className="mb-2 block text-xs font-semibold">
                              {char.label} - {t('common.notes')}
                            </Label>
                            <Textarea
                              defaultValue={notes}
                              onBlur={(e) => {
                                const nextNotes = {
                                  ...(character.statNotes || {}),
                                  [char.key]: e.target.value,
                                };
                                updateCharacter(character.id, {
                                  statNotes: nextNotes,
                                });
                              }}
                              placeholder={t(
                                'dh.addNotesCharacteristicPlaceholder',
                              )}
                              className="min-h-[80px] text-xs"
                            />
                          </PopoverContent>
                        </Popover>
                        <div className="text-muted-foreground mt-1 text-[8px] font-semibold uppercase">
                          {char.label}
                        </div>
                        <div className="mt-1 mb-1 flex items-center justify-center gap-1">
                          {isCharacteristicsEditing ? (
                            <Input
                              type="number"
                              value={val === 0 ? '' : val}
                              onChange={(e) =>
                                setEditableStats((prev) => ({
                                  ...prev,
                                  [char.key]: parseInt(e.target.value, 10) || 0,
                                }))
                              }
                              className="text-primary h-6 w-10 [appearance:textfield] px-1 text-center text-xs leading-tight font-bold [&::-webkit-inner-spin-button]:appearance-none [&::-webkit-outer-spin-button]:appearance-none"
                            />
                          ) : (
                            <div className="text-primary text-sm leading-tight font-bold">
                              {val + bonus}
                            </div>
                          )}
                          <div className="flex flex-col items-center gap-[1px]">
                            {upgrades.map((checked, upgradeIdx) => (
                              <Checkbox
                                key={upgradeIdx}
                                checked={checked}
                                disabled={
                                  !checked &&
                                  upgradeIdx > 0 &&
                                  !upgrades[upgradeIdx - 1]
                                }
                                onCheckedChange={(c) => {
                                  const currentUpgrades =
                                    isCharacteristicsEditing
                                      ? editableStatUpgrades
                                      : character.statUpgrades || {};
                                  const nextUpgrades = { ...currentUpgrades };
                                  const specific = [
                                    ...(nextUpgrades[char.key] || [
                                      false,
                                      false,
                                      false,
                                      false,
                                    ]),
                                  ];
                                  specific[upgradeIdx] = !!c;
                                  if (!c) {
                                    for (
                                      let i = upgradeIdx + 1;
                                      i < specific.length;
                                      i++
                                    ) {
                                      specific[i] = false;
                                    }
                                  }
                                  nextUpgrades[char.key] = specific as [
                                    boolean,
                                    boolean,
                                    boolean,
                                    boolean,
                                  ];
                                  if (isCharacteristicsEditing) {
                                    setEditableStatUpgrades(nextUpgrades);
                                  } else {
                                    updateCharacter(character.id, {
                                      statUpgrades: nextUpgrades,
                                    });
                                  }
                                }}
                                className="data-[state=checked]:bg-primary h-2.5 w-2.5"
                              />
                            ))}
                          </div>
                        </div>
                      </div>
                    );
                  })}
              </div>
            </div>
            <div className="mt-1 grid grid-cols-2 gap-1 px-1 md:col-span-2">
              <MetricBox
                title={t('dh.wounds')}
                notes={getPointsObject(character.wounds).notes}
                onNoteChange={(val) =>
                  updateCharacter(character.id, {
                    wounds: {
                      ...getPointsObject(character.wounds),
                      notes: val,
                    },
                  })
                }
                editing={isPointsEditing}
                onEdit={() => setIsPointsEditing(true)}
                onSave={handleSavePoints}
                isCompactView={isCompactView}
                hideNotes={hideNotes}
                showEditButtons={showEditButtons}
              >
                <div className="flex items-center justify-center gap-1">
                  {isPointsEditing ? (
                    <>
                      <Input
                        type="number"
                        value={editablePoints.wounds.current}
                        onChange={(e) =>
                          handleNestedPointsChange(
                            'wounds',
                            'current',
                            e.target.value,
                          )
                        }
                        className="h-6 w-10 px-1 text-center text-xs"
                      />
                      <span className="text-muted-foreground text-[10px]">
                        /
                      </span>
                      <Input
                        type="number"
                        value={editablePoints.wounds.max}
                        onChange={(e) =>
                          handleNestedPointsChange(
                            'wounds',
                            'max',
                            e.target.value,
                          )
                        }
                        className="h-6 w-10 px-1 text-center text-xs"
                      />
                    </>
                  ) : (
                    <div className="flex items-center justify-center gap-1">
                      <Button
                        size="icon"
                        variant="outline"
                        className="h-5 w-5"
                        onClick={() => handlePointChange('wounds', -1)}
                      >
                        <Minus className="h-3 w-3" />
                      </Button>
                      <span className="min-w-[1.2rem] text-center text-sm font-bold">
                        {getPointsObject(character.wounds).current}
                      </span>
                      <Button
                        size="icon"
                        variant="outline"
                        className="h-5 w-5"
                        onClick={() => handlePointChange('wounds', 1)}
                      >
                        <Plus className="h-3 w-3" />
                      </Button>
                      <span className="text-muted-foreground mx-0.5 text-[10px]">
                        /
                      </span>
                      <span className="text-sm">
                        {getPointsObject(character.wounds).max}
                      </span>
                    </div>
                  )}
                </div>
              </MetricBox>
              <MetricBox
                title={t('dh.fate')}
                notes={getPointsObject(character.fatePoints).notes}
                onNoteChange={(val) =>
                  updateCharacter(character.id, {
                    fatePoints: {
                      ...getPointsObject(character.fatePoints),
                      notes: val,
                    },
                  })
                }
                editing={isPointsEditing}
                onEdit={() => setIsPointsEditing(true)}
                onSave={handleSavePoints}
                isCompactView={isCompactView}
                hideNotes={hideNotes}
                showEditButtons={showEditButtons}
              >
                <div className="flex items-center justify-center gap-1">
                  {isPointsEditing ? (
                    <>
                      <Input
                        type="number"
                        value={editablePoints.fatePoints.current}
                        onChange={(e) =>
                          handleNestedPointsChange(
                            'fatePoints',
                            'current',
                            e.target.value,
                          )
                        }
                        className="h-6 w-10 px-1 text-center text-xs"
                      />
                      <span className="text-muted-foreground text-[10px]">
                        /
                      </span>
                      <Input
                        type="number"
                        value={editablePoints.fatePoints.max}
                        onChange={(e) =>
                          handleNestedPointsChange(
                            'fatePoints',
                            'max',
                            e.target.value,
                          )
                        }
                        className="h-6 w-10 px-1 text-center text-xs"
                      />
                    </>
                  ) : (
                    <div className="flex items-center justify-center gap-1">
                      <Button
                        size="icon"
                        variant="outline"
                        className="h-5 w-5"
                        onClick={() => handlePointChange('fatePoints', -1)}
                      >
                        <Minus className="h-3 w-3" />
                      </Button>
                      <span className="min-w-[1.2rem] text-center text-sm font-bold">
                        {getPointsObject(character.fatePoints).current}
                      </span>
                      <Button
                        size="icon"
                        variant="outline"
                        className="h-5 w-5"
                        onClick={() => handlePointChange('fatePoints', 1)}
                      >
                        <Plus className="h-3 w-3" />
                      </Button>
                      <span className="text-muted-foreground mx-0.5 text-[10px]">
                        /
                      </span>
                      <span className="text-sm">
                        {getPointsObject(character.fatePoints).max}
                      </span>
                    </div>
                  )}
                </div>
              </MetricBox>
              {/* ─── LANDMARK: COMPACT VIEW FATIGUE COUNTERS ─── */}
              {(character.edition === '1st' ||
                character.edition === 'hybrid' ||
                !character.edition) && (
                <MetricBox
                  title={t('dh.fatigueFirstEdition')}
                  notes={character.fatigue1st?.notes}
                  onNoteChange={(val) =>
                    updateCharacter(character.id, {
                      fatigue1st: {
                        ...(character.fatigue1st || {}),
                        notes: val,
                      },
                    })
                  }
                  editing={isPointsEditing}
                  onEdit={() => setIsPointsEditing(true)}
                  onSave={handleSavePoints}
                  isCompactView={isCompactView}
                  hideNotes={hideNotes}
                  showEditButtons={showEditButtons}
                >
                  <div className="flex items-center justify-center gap-1">
                    {isPointsEditing ? (
                      <>
                        <Input
                          type="number"
                          value={character.fatigue1st?.current ?? 0}
                          onChange={(e) =>
                            updateCharacter(character.id, {
                              fatigue1st: {
                                ...(character.fatigue1st || {}),
                                current: Math.max(
                                  0,
                                  Math.min(
                                    parseInt(e.target.value, 10) || 0,
                                    fatigue1stMax,
                                  ),
                                ),
                              },
                            })
                          }
                          className="h-6 w-10 px-1 text-center text-xs"
                        />
                        <span className="text-muted-foreground text-[10px]">
                          /
                        </span>
                        <span className="text-sm">{fatigue1stMax}</span>
                      </>
                    ) : (
                      <div className="flex items-center justify-center gap-1">
                        <Button
                          size="icon"
                          variant="outline"
                          className="h-5 w-5"
                          onClick={() => handleFatigueChange('1st', -1)}
                        >
                          <Minus className="h-3 w-3" />
                        </Button>
                        <span className="min-w-[1.2rem] text-center text-sm font-bold">
                          {character.fatigue1st?.current ?? 0}
                        </span>
                        <Button
                          size="icon"
                          variant="outline"
                          className="h-5 w-5"
                          onClick={() => handleFatigueChange('1st', 1)}
                        >
                          <Plus className="h-3 w-3" />
                        </Button>
                        <span className="text-muted-foreground mx-0.5 text-[10px]">
                          /
                        </span>
                        <span className="text-sm">{fatigue1stMax}</span>
                      </div>
                    )}
                  </div>
                </MetricBox>
              )}
              {(character.edition === '2nd' ||
                character.edition === 'hybrid') && (
                <MetricBox
                  title={t('dh.fatigueSecondEdition')}
                  notes={character.fatigue2nd?.notes}
                  onNoteChange={(val) =>
                    updateCharacter(character.id, {
                      fatigue2nd: {
                        ...(character.fatigue2nd || {}),
                        notes: val,
                      },
                    })
                  }
                  editing={isPointsEditing}
                  onEdit={() => setIsPointsEditing(true)}
                  onSave={handleSavePoints}
                  isCompactView={isCompactView}
                  hideNotes={hideNotes}
                  showEditButtons={showEditButtons}
                >
                  <div className="flex items-center justify-center gap-1">
                    {isPointsEditing ? (
                      <>
                        <Input
                          type="number"
                          value={character.fatigue2nd?.current ?? 0}
                          onChange={(e) =>
                            updateCharacter(character.id, {
                              fatigue2nd: {
                                ...(character.fatigue2nd || {}),
                                current: Math.max(
                                  0,
                                  Math.min(
                                    parseInt(e.target.value, 10) || 0,
                                    fatigue2ndMax,
                                  ),
                                ),
                              },
                            })
                          }
                          className="h-6 w-10 px-1 text-center text-xs"
                        />
                        <span className="text-muted-foreground text-[10px]">
                          /
                        </span>
                        <span className="text-sm">{fatigue2ndMax}</span>
                      </>
                    ) : (
                      <div className="flex items-center justify-center gap-1">
                        <Button
                          size="icon"
                          variant="outline"
                          className="h-5 w-5"
                          onClick={() => handleFatigueChange('2nd', -1)}
                        >
                          <Minus className="h-3 w-3" />
                        </Button>
                        <span className="min-w-[1.2rem] text-center text-sm font-bold">
                          {character.fatigue2nd?.current ?? 0}
                        </span>
                        <Button
                          size="icon"
                          variant="outline"
                          className="h-5 w-5"
                          onClick={() => handleFatigueChange('2nd', 1)}
                        >
                          <Plus className="h-3 w-3" />
                        </Button>
                        <span className="text-muted-foreground mx-0.5 text-[10px]">
                          /
                        </span>
                        <span className="text-sm">{fatigue2ndMax}</span>
                      </div>
                    )}
                  </div>
                </MetricBox>
              )}
              {/* ─── END COMPACT VIEW FATIGUE COUNTERS ─── */}
              <CustomResourceCounter
                character={character}
                isCompactView={true}
              />

              <MetricBox
                title={t('dh.insanity')}
                notes={getSimplePointsObject(character.insanityPoints).notes}
                onNoteChange={(val) =>
                  updateCharacter(character.id, {
                    insanityPoints: {
                      ...getSimplePointsObject(character.insanityPoints),
                      notes: val,
                    },
                  })
                }
                editing={isPointsEditing}
                onEdit={() => setIsPointsEditing(true)}
                onSave={handleSavePoints}
                isCompactView={isCompactView}
                hideNotes={hideNotes}
                showEditButtons={showEditButtons}
              >
                <div className="flex items-center justify-center gap-1">
                  {isPointsEditing ? (
                    <Input
                      type="number"
                      value={editablePoints.insanityPoints.total}
                      onChange={(e) =>
                        handleSimplePointsChange(
                          'insanityPoints',
                          'total',
                          e.target.value,
                        )
                      }
                      className="mx-auto h-6 w-12 px-1 text-center text-xs"
                    />
                  ) : (
                    <div className="flex items-center justify-center gap-1">
                      <Button
                        size="icon"
                        variant="outline"
                        className="h-5 w-5"
                        onClick={() => handlePointChange('insanityPoints', -1)}
                      >
                        <Minus className="h-3 w-3" />
                      </Button>
                      <span className="min-w-[1.2rem] text-center text-sm font-bold">
                        {getSimplePointsObject(character.insanityPoints).total}
                      </span>
                      <Button
                        size="icon"
                        variant="outline"
                        className="h-5 w-5"
                        onClick={() => handlePointChange('insanityPoints', 1)}
                      >
                        <Plus className="h-3 w-3" />
                      </Button>
                    </div>
                  )}
                </div>
              </MetricBox>
              <MetricBox
                title={t('dh.corruption')}
                notes={getSimplePointsObject(character.corruptionPoints).notes}
                onNoteChange={(val) =>
                  updateCharacter(character.id, {
                    corruptionPoints: {
                      ...getSimplePointsObject(character.corruptionPoints),
                      notes: val,
                    },
                  })
                }
                editing={isPointsEditing}
                onEdit={() => setIsPointsEditing(true)}
                onSave={handleSavePoints}
                isCompactView={isCompactView}
                hideNotes={hideNotes}
                showEditButtons={showEditButtons}
              >
                <div className="flex items-center justify-center gap-1">
                  {isPointsEditing ? (
                    <Input
                      type="number"
                      value={editablePoints.corruptionPoints.total}
                      onChange={(e) =>
                        handleSimplePointsChange(
                          'corruptionPoints',
                          'total',
                          e.target.value,
                        )
                      }
                      className="mx-auto h-6 w-12 px-1 text-center text-xs"
                    />
                  ) : (
                    <div className="flex items-center justify-center gap-1">
                      <Button
                        size="icon"
                        variant="outline"
                        className="h-5 w-5"
                        onClick={() =>
                          handlePointChange('corruptionPoints', -1)
                        }
                      >
                        <Minus className="h-3 w-3" />
                      </Button>
                      <span className="min-w-[1.2rem] text-center text-sm font-bold">
                        {
                          getSimplePointsObject(character.corruptionPoints)
                            .total
                        }
                      </span>
                      <Button
                        size="icon"
                        variant="outline"
                        className="h-5 w-5"
                        onClick={() => handlePointChange('corruptionPoints', 1)}
                      >
                        <Plus className="h-3 w-3" />
                      </Button>
                    </div>
                  )}
                </div>
              </MetricBox>
            </div>
            <div className="mt-2 grid grid-cols-4 gap-1 px-1 md:col-span-2">
              {(() => {
                const agUpgrades = (character.statUpgrades?.agility || [
                  false,
                  false,
                  false,
                  false,
                ]) as boolean[];
                const agBonus = agUpgrades.filter(Boolean).length * 5;
                const effectiveAg = character.stats.agility + agBonus;
                const agMod = Math.floor(effectiveAg / 10);
                return (
                  <>
                    <div className="bg-background/50 rounded border p-1 text-center">
                      <div className="text-muted-foreground text-[8px] uppercase">
                        {t('dh.halfMove')}
                      </div>
                      <div className="text-xs font-bold">{agMod}</div>
                    </div>
                    <div className="bg-background/50 rounded border p-1 text-center">
                      <div className="text-muted-foreground text-[8px] uppercase">
                        {t('dh.move')}
                      </div>
                      <div className="text-xs font-bold">{agMod * 2}</div>
                    </div>
                    <div className="bg-background/50 rounded border p-1 text-center">
                      <div className="text-muted-foreground text-[8px] uppercase">
                        {t('dh.charge')}
                      </div>
                      <div className="text-xs font-bold">{agMod * 3}</div>
                    </div>
                    <div className="bg-background/50 rounded border p-1 text-center">
                      <div className="text-muted-foreground text-[8px] uppercase">
                        {t('dh.run')}
                      </div>
                      <div className="text-xs font-bold">{agMod * 6}</div>
                    </div>
                  </>
                );
              })()}
            </div>
          </div>
        </div>
      )}
      <div
        className={cn(
          'sheet-info-grid grid grid-cols-1 gap-6 lg:grid-cols-12',
          isCompactView &&
            !['info-section', 'progression-section'].includes(
              activeCompactSection,
            ) &&
            'hidden',
        )}
      >
        <div
          className={cn(
            'lg:col-span-5',
            isCompactView &&
              activeCompactSection &&
              activeCompactSection !== 'info-section' &&
              'hidden',
          )}
        >
          <InfoSection
            character={character}
            isCompactView={isCompactView}
            activeCompactSection={activeCompactSection}
            onEditingChange={(v: boolean) => reportSectionEditing('info', v)}
          />
        </div>
        <div
          className={cn(
            'lg:col-span-4',
            isCompactView &&
              activeCompactSection &&
              activeCompactSection !== 'progression-section' &&
              'hidden',
          )}
        >
          <ProgressionSection
            character={character}
            isCompactView={isCompactView}
            activeCompactSection={activeCompactSection}
            onEditingChange={(v: boolean) =>
              reportSectionEditing('progression', v)
            }
          />
        </div>
        {!isCompactView && (
          <div className="hidden overflow-hidden md:col-span-3 md:block">
            <ArmorDisplay character={character} isCompactView={isCompactView} />
          </div>
        )}
      </div>
      <div
        className={cn(
          'sheet-panels flex flex-row items-stretch gap-2 md:gap-6',
          isCompactView &&
            ![
              'skills-section',
              'talents-section',
              'equipment-section',
              'inventory-section',
            ].includes(activeCompactSection) &&
            'hidden',
        )}
      >
        {/* DH-COMPACT-SKILLS-PANEL-START */}
        <div
          className={cn(
            'min-w-0 transition-all duration-300 ease-in-out',
            isCompactView
              ? activeCompactSection &&
                !['skills-section', 'talents-section'].includes(
                  activeCompactSection,
                )
                ? 'hidden'
                : 'flex-1'
              : isSkillsPanelCollapsed
                ? 'w-12 shrink-0'
                : 'min-w-0 flex-1',
          )}
        >
          {isCompactView ? (
            <div className="w-full min-w-0">
              <SkillsTalentsSection
                ref={skillsTalentsRef}
                onEditingChange={(v) => reportSectionEditing('skills', v)}
                character={character}
                isCompactView={isCompactView}
                activeCompactSection={activeCompactSection}
              />
            </div>
          ) : isSkillsPanelCollapsed ? (
            <Card className="flex h-full items-center justify-center">
              <Button
                variant="ghost"
                className="h-full w-full py-4"
                onClick={() => setIsSkillsPanelCollapsed(false)}
              >
                <span className="text-muted-foreground rotate-180 transform text-center text-sm font-semibold tracking-widest whitespace-nowrap uppercase [writing-mode:vertical-rl]">
                  {t('common.skills')}, {t('dh.talentsAndTraits')},{' '}
                  {t('dh.wounds')} &amp; {t('dh.fate')}
                </span>
              </Button>
            </Card>
          ) : (
            <Card id="skills-talents-panel">
              <CardHeader className="flex-row items-center justify-between px-6 pt-3 pb-6">
                <CardTitle className="font-headline">
                  {t('common.skills')}, {t('dh.talentsAndTraits')},{' '}
                  {t('dh.wounds')} &amp; {t('dh.fate')}
                </CardTitle>
                <Button
                  variant="ghost"
                  size="icon"
                  onClick={() => setIsSkillsPanelCollapsed(true)}
                  aria-label={t('dh.collapsePanel')}
                  className={cn(isCompactView && 'hidden')}
                >
                  <ChevronLeft className="h-5 w-5" />
                </Button>
              </CardHeader>
              <CardContent className="space-y-8 pt-0">
                <SkillsTalentsSection
                  ref={skillsTalentsRef}
                  onEditingChange={(v) => reportSectionEditing('skills', v)}
                  character={character}
                  isCompactView={isCompactView}
                  activeCompactSection={activeCompactSection}
                />
                {/* DH-COMPACT-SKILLS-PANEL-END */}
                {!isCompactView && (
                  <div className="grid grid-cols-2 gap-4">
                    <MetricBox
                      title={t('dh.wounds')}
                      notes={getPointsObject(character.wounds).notes}
                      onNoteChange={(val) =>
                        updateCharacter(character.id, {
                          wounds: {
                            ...getPointsObject(character.wounds),
                            notes: val,
                          },
                        })
                      }
                      editing={isPointsEditing}
                      onEdit={() => setIsPointsEditing(true)}
                      onSave={handleSavePoints}
                      isCompactView={isCompactView}
                      hideNotes={hideNotes}
                      showEditButtons={showEditButtons}
                    >
                      <div className="flex h-full flex-col items-center justify-center text-center">
                        {isPointsEditing ? (
                          <div className="flex items-center justify-center gap-2">
                            <Input
                              type="number"
                              value={editablePoints.wounds.current}
                              onChange={(e) =>
                                handleNestedPointsChange(
                                  'wounds',
                                  'current',
                                  e.target.value,
                                )
                              }
                              className="h-8 w-16 text-center text-lg font-bold"
                            />
                            <span className="text-muted-foreground">/</span>
                            <Input
                              type="number"
                              value={editablePoints.wounds.max}
                              onChange={(e) =>
                                handleNestedPointsChange(
                                  'wounds',
                                  'max',
                                  e.target.value,
                                )
                              }
                              className="h-8 w-16 text-center text-lg font-bold"
                            />
                          </div>
                        ) : (
                          <div className="flex items-center justify-center gap-2">
                            <Button
                              size="icon"
                              variant="outline"
                              className="h-6 w-6"
                              onClick={() => handlePointChange('wounds', -1)}
                            >
                              <Minus className="h-4 w-4" />
                            </Button>
                            <p className="text-primary w-12 text-center text-2xl font-bold">
                              {getPointsObject(character.wounds).current}
                            </p>
                            <Button
                              size="icon"
                              variant="outline"
                              className="h-6 w-6"
                              onClick={() => handlePointChange('wounds', 1)}
                            >
                              <Plus className="h-4 w-4" />
                            </Button>
                            <p className="text-muted-foreground ml-2 text-xl font-medium">
                              / {getPointsObject(character.wounds).max}
                            </p>
                          </div>
                        )}
                      </div>
                    </MetricBox>
                    <MetricBox
                      title={t('dh.fate')}
                      notes={getPointsObject(character.fatePoints).notes}
                      onNoteChange={(val) =>
                        updateCharacter(character.id, {
                          fatePoints: {
                            ...getPointsObject(character.fatePoints),
                            notes: val,
                          },
                        })
                      }
                      editing={isPointsEditing}
                      onEdit={() => setIsPointsEditing(true)}
                      onSave={handleSavePoints}
                      isCompactView={isCompactView}
                      hideNotes={hideNotes}
                      showEditButtons={showEditButtons}
                    >
                      <div className="flex h-full flex-col items-center justify-center text-center">
                        {isPointsEditing ? (
                          <div className="flex items-center justify-center gap-2">
                            <Input
                              type="number"
                              value={editablePoints.fatePoints.current}
                              onChange={(e) =>
                                handleNestedPointsChange(
                                  'fatePoints',
                                  'current',
                                  e.target.value,
                                )
                              }
                              className="h-8 w-16 text-center text-lg font-bold"
                            />
                            <span className="text-muted-foreground">/</span>
                            <Input
                              type="number"
                              value={editablePoints.fatePoints.max}
                              onChange={(e) =>
                                handleNestedPointsChange(
                                  'fatePoints',
                                  'max',
                                  e.target.value,
                                )
                              }
                              className="h-8 w-16 text-center text-lg font-bold"
                            />
                          </div>
                        ) : (
                          <div className="flex items-center justify-center gap-2">
                            <Button
                              size="icon"
                              variant="outline"
                              className="h-6 w-6"
                              onClick={() =>
                                handlePointChange('fatePoints', -1)
                              }
                            >
                              <Minus className="h-4 w-4" />
                            </Button>
                            <p className="text-primary w-12 text-center text-2xl font-bold">
                              {getPointsObject(character.fatePoints).current}
                            </p>
                            <Button
                              size="icon"
                              variant="outline"
                              className="h-6 w-6"
                              onClick={() => handlePointChange('fatePoints', 1)}
                            >
                              <Plus className="h-4 w-4" />
                            </Button>
                            <p className="text-muted-foreground ml-2 text-xl font-medium">
                              / {getPointsObject(character.fatePoints).max}
                            </p>
                          </div>
                        )}
                      </div>
                    </MetricBox>
                  </div>
                )}

                {!isCompactView && (
                  <Card>
                    <CardHeader className="flex-row items-center justify-between px-6 pt-3 pb-2">
                      <CardTitle className="font-headline text-base">
                        {t('dh.fatigueAndCriticalConditions')}
                      </CardTitle>
                    </CardHeader>
                    <CardContent className="space-y-4 pt-0">
                      <div className="flex flex-wrap gap-4">
                        {(character.edition === '1st' ||
                          character.edition === 'hybrid' ||
                          !character.edition) && (
                          <div className="min-w-[140px] flex-1">
                            <MetricBox
                              title={t('dh.fatigueFirstEdition')}
                              notes={character.fatigue1st?.notes}
                              onNoteChange={(val) =>
                                updateCharacter(character.id, {
                                  fatigue1st: {
                                    ...(character.fatigue1st || {}),
                                    notes: val,
                                  },
                                })
                              }
                              editing={isPointsEditing}
                              onEdit={() => setIsPointsEditing(true)}
                              onSave={handleSavePoints}
                              isCompactView={isCompactView}
                              hideNotes={hideNotes}
                              showEditButtons={showEditButtons}
                            >
                              <div className="flex h-full flex-col items-center justify-center text-center">
                                {isPointsEditing ? (
                                  <div className="flex items-center justify-center gap-2">
                                    <Input
                                      type="number"
                                      value={character.fatigue1st?.current ?? 0}
                                      onChange={(e) =>
                                        updateCharacter(character.id, {
                                          fatigue1st: {
                                            ...(character.fatigue1st || {}),
                                            current: Math.max(
                                              0,
                                              Math.min(
                                                parseInt(e.target.value, 10) ||
                                                  0,
                                                fatigue1stMax,
                                              ),
                                            ),
                                          },
                                        })
                                      }
                                      className="h-8 w-16 text-center text-lg font-bold"
                                    />
                                    <span className="text-muted-foreground">
                                      /
                                    </span>
                                    <span className="flex h-8 w-16 items-center justify-center text-center text-lg font-bold">
                                      {fatigue1stMax}
                                    </span>
                                  </div>
                                ) : (
                                  <div className="flex items-center justify-center gap-2">
                                    <Button
                                      size="icon"
                                      variant="outline"
                                      className="h-6 w-6"
                                      onClick={() =>
                                        handleFatigueChange('1st', -1)
                                      }
                                    >
                                      <Minus className="h-4 w-4" />
                                    </Button>
                                    <p className="text-primary w-12 text-center text-2xl font-bold">
                                      {character.fatigue1st?.current ?? 0}
                                    </p>
                                    <Button
                                      size="icon"
                                      variant="outline"
                                      className="h-6 w-6"
                                      onClick={() =>
                                        handleFatigueChange('1st', 1)
                                      }
                                    >
                                      <Plus className="h-4 w-4" />
                                    </Button>
                                    <p className="text-muted-foreground ml-2 text-xl font-medium">
                                      / {fatigue1stMax}
                                    </p>
                                  </div>
                                )}
                              </div>
                            </MetricBox>
                          </div>
                        )}
                        {(character.edition === '2nd' ||
                          character.edition === 'hybrid') && (
                          <div className="min-w-[140px] flex-1">
                            <MetricBox
                              title={t('dh.fatigueSecondEdition')}
                              notes={character.fatigue2nd?.notes}
                              onNoteChange={(val) =>
                                updateCharacter(character.id, {
                                  fatigue2nd: {
                                    ...(character.fatigue2nd || {}),
                                    notes: val,
                                  },
                                })
                              }
                              editing={isPointsEditing}
                              onEdit={() => setIsPointsEditing(true)}
                              onSave={handleSavePoints}
                              isCompactView={isCompactView}
                              hideNotes={hideNotes}
                              showEditButtons={showEditButtons}
                            >
                              <div className="flex h-full flex-col items-center justify-center text-center">
                                {isPointsEditing ? (
                                  <div className="flex items-center justify-center gap-2">
                                    <Input
                                      type="number"
                                      value={character.fatigue2nd?.current ?? 0}
                                      onChange={(e) =>
                                        updateCharacter(character.id, {
                                          fatigue2nd: {
                                            ...(character.fatigue2nd || {}),
                                            current: Math.max(
                                              0,
                                              Math.min(
                                                parseInt(e.target.value, 10) ||
                                                  0,
                                                fatigue2ndMax,
                                              ),
                                            ),
                                          },
                                        })
                                      }
                                      className="h-8 w-16 text-center text-lg font-bold"
                                    />
                                    <span className="text-muted-foreground">
                                      /
                                    </span>
                                    <span className="flex h-8 w-16 items-center justify-center text-center text-lg font-bold">
                                      {fatigue2ndMax}
                                    </span>
                                  </div>
                                ) : (
                                  <div className="flex items-center justify-center gap-2">
                                    <Button
                                      size="icon"
                                      variant="outline"
                                      className="h-6 w-6"
                                      onClick={() =>
                                        handleFatigueChange('2nd', -1)
                                      }
                                    >
                                      <Minus className="h-4 w-4" />
                                    </Button>
                                    <p className="text-primary w-12 text-center text-2xl font-bold">
                                      {character.fatigue2nd?.current ?? 0}
                                    </p>
                                    <Button
                                      size="icon"
                                      variant="outline"
                                      className="h-6 w-6"
                                      onClick={() =>
                                        handleFatigueChange('2nd', 1)
                                      }
                                    >
                                      <Plus className="h-4 w-4" />
                                    </Button>
                                    <p className="text-muted-foreground ml-2 text-xl font-medium">
                                      / {fatigue2ndMax}
                                    </p>
                                  </div>
                                )}
                              </div>
                            </MetricBox>
                          </div>
                        )}
                      </div>

                      <div className="border-t pt-2">
                        <h4 className="mb-2 text-sm font-semibold">
                          {t('dh.criticalConditions')}
                        </h4>
                        <div className="space-y-2">
                          {(character.criticalConditions || []).map(
                            (condition) => (
                              <div
                                key={condition.id}
                                className="bg-muted/50 flex items-center justify-between gap-2 rounded-md p-2"
                              >
                                <span className="flex-1 text-sm break-words">
                                  {condition.name}
                                </span>
                                {showEditButtons && (
                                  <Button
                                    size="icon"
                                    variant="ghost"
                                    className="text-destructive hover:text-destructive h-6 w-6"
                                    onClick={() =>
                                      removeCriticalCondition(condition.id)
                                    }
                                  >
                                    <Trash2 className="h-4 w-4" />
                                  </Button>
                                )}
                              </div>
                            ),
                          )}
                          {showEditButtons && (
                            <div className="flex gap-2 pt-2">
                              <Input
                                placeholder={t('dh.addCriticalCondition')}
                                value={newCriticalCondition}
                                onChange={(e) =>
                                  setNewCriticalCondition(e.target.value)
                                }
                                onKeyDown={(e) =>
                                  e.key === 'Enter' && addCriticalCondition()
                                }
                              />
                              <Button onClick={addCriticalCondition} size="sm">
                                <Plus className="mr-2 h-4 w-4" />{' '}
                                {t('common.add')}
                              </Button>
                            </div>
                          )}
                        </div>
                      </div>
                    </CardContent>
                  </Card>
                )}

                <CustomResourceCounter
                  character={character}
                  isCompactView={false}
                />
              </CardContent>
            </Card>
          )}
        </div>
        {/* ─── LANDMARK: MIDDLE COLUMN - ORIGINAL WIDTH RESTORED ─── */}
        {!isCompactView && (
          <div
            className={cn(
              'shrink-0 transition-all duration-300 ease-in-out',
              isSkillsPanelCollapsed && isEquipmentPanelCollapsed
                ? 'flex-1'
                : 'w-auto',
            )}
          >
            {isTabletScreen ? (
              <Card>
                <CardHeader className="flex-row items-center justify-between px-6 pt-3 pb-6">
                  <CardTitle className="font-headline">
                    {t('common.characteristics')}
                  </CardTitle>
                  <EditSaveButton
                    editing={isCharacteristicsEditing}
                    onEdit={() => setIsCharacteristicsEditing(true)}
                    onSave={handleSaveCharacteristics}
                  />
                </CardHeader>
                <CardContent className="space-y-4 pt-0">
                  <div className="grid grid-cols-5 gap-1">
                    {(
                      [
                        {
                          key: 'weaponSkill' as const,
                          label: t('dh.weaponSkillAbbr'),
                        },
                        {
                          key: 'ballisticSkill' as const,
                          label: t('dh.ballisticSkillAbbr'),
                        },
                        {
                          key: 'strength' as const,
                          label: t('dh.strengthAbbr'),
                        },
                        {
                          key: 'toughness' as const,
                          label: t('dh.toughnessAbbr'),
                        },
                        { key: 'agility' as const, label: t('dh.agilityAbbr') },
                        {
                          key: 'intelligence' as const,
                          label: t('dh.intelligenceAbbr'),
                        },
                        {
                          key: 'perception' as const,
                          label: t('dh.perceptionAbbr'),
                        },
                        {
                          key: 'willpower' as const,
                          label: t('dh.willpowerAbbr'),
                        },
                        {
                          key: 'fellowship' as const,
                          label: t('dh.fellowshipAbbr'),
                        },
                        {
                          key: 'influence' as const,
                          label: t('dh.influenceAbbr'),
                        },
                      ] as const
                    )
                      .filter((c) =>
                        character.edition === '1st' || !character.edition
                          ? c.key !== 'influence'
                          : true,
                      )
                      .map((char) => {
                        const stats = isCharacteristicsEditing
                          ? editableStats
                          : character.stats;
                        const statUpgrades = isCharacteristicsEditing
                          ? editableStatUpgrades
                          : character.statUpgrades || {};
                        const statNotes = character.statNotes as
                          Record<string, string> | undefined;
                        const val = stats?.[char.key] || 0;
                        const upgrades = (statUpgrades?.[char.key] || [
                          false,
                          false,
                          false,
                          false,
                        ]) as boolean[];
                        const bonus = upgrades.filter(Boolean).length * 5;
                        const notes = statNotes?.[char.key] || '';
                        return (
                          <div
                            key={char.key}
                            className="bg-background relative flex min-h-[60px] flex-col justify-between rounded-md border px-0.5 py-1 text-center"
                          >
                            <Popover>
                              <PopoverTrigger asChild>
                                <Button
                                  variant={notes ? 'secondary' : 'ghost'}
                                  size="icon"
                                  className="absolute top-0.5 right-0.5 h-4 w-4"
                                >
                                  <Info className="h-2.5 w-2.5" />
                                </Button>
                              </PopoverTrigger>
                              <PopoverContent
                                className="w-64 p-3"
                                side="top"
                                align="center"
                              >
                                <Label className="mb-2 block text-xs font-semibold">
                                  {char.label} - {t('common.notes')}
                                </Label>
                                <Textarea
                                  defaultValue={notes}
                                  onBlur={(e) => {
                                    const nextNotes = {
                                      ...(character.statNotes || {}),
                                      [char.key]: e.target.value,
                                    };
                                    updateCharacter(character.id, {
                                      statNotes: nextNotes,
                                    });
                                  }}
                                  placeholder={t(
                                    'dh.addNotesCharacteristicPlaceholder',
                                  )}
                                  className="min-h-[80px] text-xs"
                                />
                              </PopoverContent>
                            </Popover>
                            <div className="text-muted-foreground mt-1 text-[8px] font-semibold uppercase">
                              {char.label}
                            </div>
                            <div className="mt-1 mb-1 flex items-center justify-center gap-1">
                              {isCharacteristicsEditing ? (
                                <Input
                                  type="number"
                                  value={val === 0 ? '' : val}
                                  onChange={(e) =>
                                    setEditableStats((prev) => ({
                                      ...prev,
                                      [char.key]:
                                        parseInt(e.target.value, 10) || 0,
                                    }))
                                  }
                                  className="text-primary h-6 w-10 [appearance:textfield] px-1 text-center text-xs leading-tight font-bold [&::-webkit-inner-spin-button]:appearance-none [&::-webkit-outer-spin-button]:appearance-none"
                                />
                              ) : (
                                <div className="text-primary text-sm leading-tight font-bold">
                                  {val + bonus}
                                </div>
                              )}
                              <div className="flex flex-col items-center gap-[1px]">
                                {upgrades.map((checked, upgradeIdx) => (
                                  <Checkbox
                                    key={upgradeIdx}
                                    checked={checked}
                                    disabled={
                                      !checked &&
                                      upgradeIdx > 0 &&
                                      !upgrades[upgradeIdx - 1]
                                    }
                                    onCheckedChange={(c) => {
                                      const currentUpgrades =
                                        isCharacteristicsEditing
                                          ? editableStatUpgrades
                                          : character.statUpgrades || {};
                                      const nextUpgrades = {
                                        ...currentUpgrades,
                                      };
                                      const specific = [
                                        ...(nextUpgrades[char.key] || [
                                          false,
                                          false,
                                          false,
                                          false,
                                        ]),
                                      ];
                                      specific[upgradeIdx] = !!c;
                                      if (!c) {
                                        for (
                                          let i = upgradeIdx + 1;
                                          i < specific.length;
                                          i++
                                        ) {
                                          specific[i] = false;
                                        }
                                      }
                                      nextUpgrades[char.key] = specific as [
                                        boolean,
                                        boolean,
                                        boolean,
                                        boolean,
                                      ];
                                      if (isCharacteristicsEditing) {
                                        setEditableStatUpgrades(nextUpgrades);
                                      } else {
                                        updateCharacter(character.id, {
                                          statUpgrades: nextUpgrades,
                                        });
                                      }
                                    }}
                                    className="data-[state=checked]:bg-primary h-2.5 w-2.5"
                                  />
                                ))}
                              </div>
                            </div>
                          </div>
                        );
                      })}
                  </div>
                  <div className="grid grid-cols-4 gap-1">
                    {(() => {
                      const agUpgrades = (character.statUpgrades?.agility || [
                        false,
                        false,
                        false,
                        false,
                      ]) as boolean[];
                      const agBonus = agUpgrades.filter(Boolean).length * 5;
                      const effectiveAg = character.stats.agility + agBonus;
                      const agMod = Math.floor(effectiveAg / 10);
                      return (
                        <>
                          <div className="bg-background/50 rounded border p-1 text-center">
                            <div className="text-muted-foreground text-[8px] uppercase">
                              {t('dh.halfMove')}
                            </div>
                            <div className="text-xs font-bold">{agMod}</div>
                          </div>
                          <div className="bg-background/50 rounded border p-1 text-center">
                            <div className="text-muted-foreground text-[8px] uppercase">
                              {t('dh.move')}
                            </div>
                            <div className="text-xs font-bold">{agMod * 2}</div>
                          </div>
                          <div className="bg-background/50 rounded border p-1 text-center">
                            <div className="text-muted-foreground text-[8px] uppercase">
                              {t('dh.charge')}
                            </div>
                            <div className="text-xs font-bold">{agMod * 3}</div>
                          </div>
                          <div className="bg-background/50 rounded border p-1 text-center">
                            <div className="text-muted-foreground text-[8px] uppercase">
                              {t('dh.run')}
                            </div>
                            <div className="text-xs font-bold">{agMod * 6}</div>
                          </div>
                        </>
                      );
                    })()}
                  </div>
                </CardContent>
              </Card>
            ) : (
              <CharacteristicsSection
                ref={characteristicsRef}
                onEditingChange={(v: boolean) =>
                  reportSectionEditing('characteristics', v)
                }
                character={character}
                isCompactView={isCompactView}
                isSkillsPanelCollapsed={isSkillsPanelCollapsed}
                isEquipmentPanelCollapsed={isEquipmentPanelCollapsed}
              />
            )}
          </div>
        )}
        {/* DH-COMPACT-EQUIPMENT-PANEL-START */}
        <div
          className={cn(
            'min-w-0 transition-all duration-300 ease-in-out',
            isCompactView
              ? activeCompactSection &&
                !['equipment-section', 'inventory-section'].includes(
                  activeCompactSection,
                )
                ? 'hidden'
                : 'flex-1'
              : isEquipmentPanelCollapsed
                ? 'w-12 shrink-0'
                : 'min-w-0 flex-1',
          )}
        >
          {isCompactView ? (
            <div className="w-full min-w-0">
              <EquipmentInventorySection
                ref={equipmentInventoryRef}
                onEditingChange={(v) => reportSectionEditing('equipment', v)}
                character={character}
                isCompactView={isCompactView}
                activeCompactSection={activeCompactSection}
              />
            </div>
          ) : isEquipmentPanelCollapsed ? (
            <Card className="flex h-full items-center justify-center">
              <Button
                variant="ghost"
                className="h-full w-full py-4"
                onClick={() => setIsEquipmentPanelCollapsed(false)}
              >
                <span className="text-muted-foreground rotate-180 transform text-center text-sm font-semibold tracking-widest whitespace-nowrap uppercase [writing-mode:vertical-rl]">
                  {t('dh.equipment')}, {t('common.inventory')} &amp;{' '}
                  {t('dh.corruption')}
                </span>
              </Button>
            </Card>
          ) : (
            <Card>
              <CardHeader className="flex-row items-center gap-2 px-6 pt-3 pb-6">
                <Button
                  variant="ghost"
                  size="icon"
                  onClick={() => setIsEquipmentPanelCollapsed(true)}
                  aria-label={t('dh.collapsePanel')}
                >
                  <ChevronRight className="h-5 w-5" />
                </Button>
                <CardTitle className="font-headline">
                  {t('dh.equipment')}, {t('common.inventory')} &amp;{' '}
                  {t('dh.corruption')}
                </CardTitle>
              </CardHeader>
              <CardContent className="space-y-8 pt-0">
                <EquipmentInventorySection
                  ref={equipmentInventoryRef}
                  onEditingChange={(v) => reportSectionEditing('equipment', v)}
                  character={character}
                  isCompactView={isCompactView}
                  activeCompactSection={activeCompactSection}
                />
                <div className="grid grid-cols-2 gap-4">
                  <MetricBox
                    title={t('dh.insanity')}
                    notes={
                      getSimplePointsObject(character.insanityPoints).notes
                    }
                    onNoteChange={(val) =>
                      updateCharacter(character.id, {
                        insanityPoints: {
                          ...getSimplePointsObject(character.insanityPoints),
                          notes: val,
                        },
                      })
                    }
                    editing={isPointsEditing}
                    onEdit={() => setIsPointsEditing(true)}
                    onSave={handleSavePoints}
                    isCompactView={isCompactView}
                    hideNotes={hideNotes}
                    showEditButtons={showEditButtons}
                  >
                    {' '}
                    <div className="flex h-full flex-col items-center justify-center text-center">
                      {isPointsEditing ? (
                        <Input
                          type="number"
                          value={editablePoints.insanityPoints.total}
                          onChange={(e) =>
                            handleSimplePointsChange(
                              'insanityPoints',
                              'total',
                              e.target.value,
                            )
                          }
                          className="mx-auto h-8 w-16 text-center text-lg font-bold"
                        />
                      ) : (
                        <div className="flex items-center justify-center gap-2">
                          {' '}
                          <Button
                            size="icon"
                            variant="outline"
                            className="h-6 w-6"
                            onClick={() =>
                              handlePointChange('insanityPoints', -1)
                            }
                          >
                            <Minus className="h-4 w-4" />
                          </Button>
                          <p className="text-primary w-12 text-center text-2xl font-bold">
                            {
                              getSimplePointsObject(character.insanityPoints)
                                .total
                            }
                          </p>
                          <Button
                            size="icon"
                            variant="outline"
                            className="h-6 w-6"
                            onClick={() =>
                              handlePointChange('insanityPoints', 1)
                            }
                          >
                            <Plus className="h-4 w-4" />
                          </Button>
                        </div>
                      )}
                    </div>
                  </MetricBox>
                  <MetricBox
                    title={t('dh.corruption')}
                    notes={
                      getSimplePointsObject(character.corruptionPoints).notes
                    }
                    onNoteChange={(val) =>
                      updateCharacter(character.id, {
                        corruptionPoints: {
                          ...getSimplePointsObject(character.corruptionPoints),
                          notes: val,
                        },
                      })
                    }
                    editing={isPointsEditing}
                    onEdit={() => setIsPointsEditing(true)}
                    onSave={handleSavePoints}
                    isCompactView={isCompactView}
                    hideNotes={hideNotes}
                    showEditButtons={showEditButtons}
                  >
                    {' '}
                    <div className="flex h-full flex-col items-center justify-center text-center">
                      {isPointsEditing ? (
                        <Input
                          type="number"
                          value={editablePoints.corruptionPoints.total}
                          onChange={(e) =>
                            handleSimplePointsChange(
                              'corruptionPoints',
                              'total',
                              e.target.value,
                            )
                          }
                          className="mx-auto h-8 w-16 text-center text-lg font-bold"
                        />
                      ) : (
                        <div className="flex items-center justify-center gap-2">
                          {' '}
                          <Button
                            size="icon"
                            variant="outline"
                            className="h-6 w-6"
                            onClick={() =>
                              handlePointChange('corruptionPoints', -1)
                            }
                          >
                            <Minus className="h-4 w-4" />
                          </Button>
                          <p className="text-primary w-12 text-center text-2xl font-bold">
                            {
                              getSimplePointsObject(character.corruptionPoints)
                                .total
                            }
                          </p>
                          <Button
                            size="icon"
                            variant="outline"
                            className="h-6 w-6"
                            onClick={() =>
                              handlePointChange('corruptionPoints', 1)
                            }
                          >
                            <Plus className="h-4 w-4" />
                          </Button>
                        </div>
                      )}
                    </div>
                  </MetricBox>
                </div>
              </CardContent>
            </Card>
          )}
        </div>
        {/* DH-COMPACT-EQUIPMENT-PANEL-END */}
      </div>
    </div>
  );
});
DarkHeresySheet.displayName = 'DarkHeresySheet';
