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
import { useCharacterContext, useTranslation } from '@/games/plugin-host';
import {
  finishCreationReview,
  isCreationReview,
} from '@/games/shared/creation-review';
import { cn } from '@/lib/utils';

import { CreationReviewBanner } from './creation-review-banner';
import { statBonus, upgradeBonus } from './dh-stats';
import { isFieldFilled } from './field-policy';
import { ArmorDisplay } from './sections/armor-display';
import { CharacteristicsSection } from './sections/characteristics-section';
import { EditSaveButton, MetricBox } from './sections/dh-ui-helpers';
import { EquipmentInventorySection } from './sections/equipment-inventory-section';
import {
  InfoSection,
  ProgressionSection,
} from './sections/info-progression-section';
import { SkillsTalentsSection } from './sections/skills-talents-section';
import styles from './sheet.module.css';
import { EMPTY_STAT_UPGRADE, pickAllowedStats, statRecord } from './stats';
import type { DH1Character as Character, DH1Character } from './types';

/** Шаг «−/+» для Безумия и Порчи: значение меняется сразу, ниже нуля не уходит. */
const PointsStepper = ({
  value,
  onChange,
  decreaseLabel,
  increaseLabel,
  testId,
  size,
}: {
  value: number;
  onChange: (delta: number) => void;
  decreaseLabel: string;
  increaseLabel: string;
  testId: string;
  size: 'sm' | 'lg';
}) => {
  const buttonClass = size === 'sm' ? 'h-5 w-5' : 'h-6 w-6';
  const iconClass = size === 'sm' ? 'h-3 w-3' : 'h-4 w-4';
  const valueClass =
    size === 'sm'
      ? 'min-w-[1.2rem] text-center text-sm font-bold'
      : 'text-primary min-w-[1.5rem] text-center text-2xl font-bold';
  return (
    <div className="flex items-center justify-center gap-1">
      <Button
        type="button"
        size="icon"
        variant="outline"
        className={buttonClass}
        onClick={() => onChange(-1)}
        disabled={value <= 0}
        aria-label={decreaseLabel}
        data-testid={`${testId}-decrease`}
      >
        <Minus className={iconClass} />
      </Button>
      <span className={valueClass}>{value}</span>
      <Button
        type="button"
        size="icon"
        variant="outline"
        className={buttonClass}
        onClick={() => onChange(1)}
        aria-label={increaseLabel}
        data-testid={`${testId}-increase`}
      >
        <Plus className={iconClass} />
      </Button>
    </div>
  );
};

export const Dh1Sheet = React.forwardRef<
  any,
  {
    character: DH1Character;
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
  // LANDMARK: CREATION REVIEW STATE
  // Импортированный лист открывается с открытыми замками до фиксации.
  // Отметка живёт в sessionStorage вкладки и привязана к id: лист может
  // остаться смонтированным при переходе между персонажами. Стартуем с
  // false, а реальное значение читаем в эффекте: иначе сервер и клиент
  // отрисовали бы баннер по-разному (отметка есть только в браузере).
  const [creationReview, setCreationReview] = React.useState(false);
  React.useEffect(() => {
    setCreationReview(isCreationReview(character.id));
  }, [character.id]);
  // Обязательные поля для фиксации: мир и карьера.
  const missingCreationFields = creationReview
    ? [
        !isFieldFilled(character.homeWorld) ? t('dh1.homeWorld') : null,
        !isFieldFilled(character.careerPath) ? t('dh1.careerPath') : null,
      ].filter((label): label is string => label !== null)
    : [];
  const handleCreationReviewConfirm = () => {
    finishCreationReview(character.id);
    setCreationReview(false);
  };
  const [isPointsEditing, setIsPointsEditing] = React.useState(false);
  const [isSkillsPanelCollapsed, setIsSkillsPanelCollapsed] =
    React.useState(false);
  const [isEquipmentPanelCollapsed, setIsEquipmentPanelCollapsed] =
    React.useState(false);
  const [isCharacteristicsEditing, setIsCharacteristicsEditing] =
    React.useState(false);
  // ─── LANDMARK: DH1 STAT VIEW ───
  // Девять характеристик 1e; при сохранении остаются только ключи редакции,
  // поэтому influence из старого файла в данные не возвращается.
  const [editableStats, setEditableStats] = React.useState(() =>
    statRecord<number>(character, 'stats', 0),
  );
  const [editableStatUpgrades, setEditableStatUpgrades] = React.useState(() =>
    statRecord(character, 'statUpgrades', EMPTY_STAT_UPGRADE),
  );

  React.useEffect(() => {
    setEditableStats(statRecord<number>(character, 'stats', 0));
    setEditableStatUpgrades(
      statRecord(character, 'statUpgrades', EMPTY_STAT_UPGRADE),
    );
  }, [character]);

  const handleSaveCharacteristics = React.useCallback(() => {
    updateCharacter(character.id, {
      stats: pickAllowedStats(editableStats),
      statUpgrades: pickAllowedStats(editableStatUpgrades),
    } as Partial<Character>);
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
  });

  React.useEffect(() => {
    setEditablePoints({
      wounds: getPointsObject(character.wounds),
      fatePoints: getPointsObject(character.fatePoints),
    });
  }, [character.wounds, character.fatePoints]);

  const isAnyEditing =
    isPointsEditing || Object.values(sectionEditing).some(Boolean);
  React.useEffect(() => {
    setHasUnsavedChanges(isAnyEditing);
  }, [isAnyEditing, setHasUnsavedChanges]);

  const handleSavePoints = React.useCallback(() => {
    updateCharacter(character.id, {
      wounds: editablePoints.wounds,
      fatePoints: editablePoints.fatePoints,
    });
    setIsPointsEditing(false);
  }, [character.id, editablePoints, updateCharacter]);

  /** Безумие и Порча меняются сразу на 1, не ниже нуля. */
  const changeSimplePoints = (
    field: 'insanityPoints' | 'corruptionPoints',
    delta: number,
  ) => {
    const current = getSimplePointsObject(character[field]);
    const next = Math.max(0, current.total + delta);
    if (next === current.total) return;
    updateCharacter(character.id, {
      [field]: { ...current, total: next },
    });
  };

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
    const dataToUpdate: Partial<DH1Character> = {};
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
    const bonus = upgradeBonus(upgrades);
    return baseStat + bonus;
  };
  const getStatMod = (stat: number) => statBonus(stat);
  const effectiveToughness = getEffectiveStat('toughness');
  // У 1-й редакции ровно одно поле усталости.
  const fatigue = character.fatigue1st;
  const fatigueMax = Math.max(0, getStatMod(effectiveToughness));
  const handleFatigueChange = (delta: number) => {
    const currentVal = fatigue?.current ?? 0;
    const newVal = Math.max(0, Math.min(currentVal + delta, fatigueMax));
    const next = { ...(fatigue || {}), current: newVal };
    updateCharacter(character.id, {
      fatigue1st: next,
    } as Partial<Character>);
  };
  const updateFatigue = (patch: { current?: number; notes?: string }) => {
    updateCharacter(character.id, {
      fatigue1st: {
        ...(fatigue || {}),
        ...patch,
      },
    } as Partial<Character>);
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

  return (
    <div
      className={cn(
        styles.sheet,
        'dh-sheet space-y-6',
        isCompactView && 'is-compact',
      )}
    >
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
                      label: t('dh1.weaponSkillAbbr'),
                    },
                    {
                      key: 'ballisticSkill' as const,
                      label: t('dh1.ballisticSkillAbbr'),
                    },
                    { key: 'strength' as const, label: t('dh1.strengthAbbr') },
                    {
                      key: 'toughness' as const,
                      label: t('dh1.toughnessAbbr'),
                    },
                    { key: 'agility' as const, label: t('dh1.agilityAbbr') },
                    {
                      key: 'intelligence' as const,
                      label: t('dh1.intelligenceAbbr'),
                    },
                    {
                      key: 'perception' as const,
                      label: t('dh1.perceptionAbbr'),
                    },
                    {
                      key: 'willpower' as const,
                      label: t('dh1.willpowerAbbr'),
                    },
                    {
                      key: 'fellowship' as const,
                      label: t('dh1.fellowshipAbbr'),
                    },
                  ] as const
                ).map((char, idx) => {
                  const stats = isCharacteristicsEditing
                    ? editableStats
                    : statRecord<number>(character, 'stats', 0);
                  const statUpgrades = isCharacteristicsEditing
                    ? editableStatUpgrades
                    : statRecord(character, 'statUpgrades', EMPTY_STAT_UPGRADE);
                  const statNotes = statRecord<string>(
                    character,
                    'statNotes',
                    '',
                  );
                  const val = stats[char.key] || 0;
                  const upgrades = (statUpgrades[char.key] ||
                    EMPTY_STAT_UPGRADE) as boolean[];
                  const bonus = upgradeBonus(upgrades);
                  const notes = statNotes[char.key] || '';
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
                                ...statRecord<string>(
                                  character,
                                  'statNotes',
                                  '',
                                ),
                                [char.key]: e.target.value,
                              };
                              updateCharacter(character.id, {
                                statNotes: pickAllowedStats(nextNotes),
                              } as Partial<Character>);
                            }}
                            placeholder={t(
                              'dh1.addNotesCharacteristicPlaceholder',
                            )}
                            className="min-h-[80px] text-xs"
                          />
                        </PopoverContent>
                      </Popover>
                      <div className="text-muted-foreground mt-1 text-[8px] font-semibold uppercase">
                        {char.label}
                      </div>
                      <div className="mt-1 mb-1 flex flex-col items-center justify-center gap-1">
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
                        <div className="grid grid-cols-2 justify-items-center gap-1">
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
                                const currentUpgrades = isCharacteristicsEditing
                                  ? editableStatUpgrades
                                  : statRecord(
                                      character,
                                      'statUpgrades',
                                      EMPTY_STAT_UPGRADE,
                                    );
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
                                    statUpgrades:
                                      pickAllowedStats(nextUpgrades),
                                  } as Partial<Character>);
                                }
                              }}
                              dot
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
                title={t('dh1.wounds')}
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
                title={t('dh1.fatePoints')}
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
              {/* У 1-й редакции одно поле усталости — fatigue1st. */}
              <MetricBox
                title={t('dh1.fatigue')}
                notes={fatigue.notes}
                onNoteChange={(val) => updateFatigue({ notes: val })}
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
                        value={fatigue.current ?? 0}
                        onChange={(e) =>
                          updateFatigue({
                            current: Math.max(
                              0,
                              Math.min(
                                parseInt(e.target.value, 10) || 0,
                                fatigueMax,
                              ),
                            ),
                          })
                        }
                        className="h-6 w-10 px-1 text-center text-xs"
                      />
                      <span className="text-muted-foreground text-[10px]">
                        /
                      </span>
                      <span className="text-sm">{fatigueMax}</span>
                    </>
                  ) : (
                    <div className="flex items-center justify-center gap-1">
                      <Button
                        size="icon"
                        variant="outline"
                        className="h-5 w-5"
                        onClick={() => handleFatigueChange(-1)}
                      >
                        <Minus className="h-3 w-3" />
                      </Button>
                      <span className="min-w-[1.2rem] text-center text-sm font-bold">
                        {fatigue.current ?? 0}
                      </span>
                      <Button
                        size="icon"
                        variant="outline"
                        className="h-5 w-5"
                        onClick={() => handleFatigueChange(1)}
                      >
                        <Plus className="h-3 w-3" />
                      </Button>
                      <span className="text-muted-foreground mx-0.5 text-[10px]">
                        /
                      </span>
                      <span className="text-sm">{fatigueMax}</span>
                    </div>
                  )}
                </div>
              </MetricBox>
              {/* ─── END COMPACT VIEW FATIGUE COUNTERS ─── */}

              <MetricBox
                title={t('dh1.insanity')}
                notes={getSimplePointsObject(character.insanityPoints).notes}
                onNoteChange={(val) =>
                  updateCharacter(character.id, {
                    insanityPoints: {
                      ...getSimplePointsObject(character.insanityPoints),
                      notes: val,
                    },
                  })
                }
                editing={false}
                onEdit={() => undefined}
                onSave={() => undefined}
                isCompactView={isCompactView}
                hideNotes={hideNotes}
                showEditButtons={false}
              >
                <div className="flex items-center justify-center">
                  <PointsStepper
                    value={
                      getSimplePointsObject(character.insanityPoints).total
                    }
                    onChange={(delta) =>
                      changeSimplePoints('insanityPoints', delta)
                    }
                    decreaseLabel={t('dh1.decreaseInsanity')}
                    increaseLabel={t('dh1.increaseInsanity')}
                    testId="insanity-points"
                    size="sm"
                  />
                </div>
              </MetricBox>
              <MetricBox
                title={t('dh1.corruption')}
                notes={getSimplePointsObject(character.corruptionPoints).notes}
                onNoteChange={(val) =>
                  updateCharacter(character.id, {
                    corruptionPoints: {
                      ...getSimplePointsObject(character.corruptionPoints),
                      notes: val,
                    },
                  })
                }
                editing={false}
                onEdit={() => undefined}
                onSave={() => undefined}
                isCompactView={isCompactView}
                hideNotes={hideNotes}
                showEditButtons={false}
              >
                <div className="flex items-center justify-center">
                  <PointsStepper
                    value={
                      getSimplePointsObject(character.corruptionPoints).total
                    }
                    onChange={(delta) =>
                      changeSimplePoints('corruptionPoints', delta)
                    }
                    decreaseLabel={t('dh1.decreaseCorruption')}
                    increaseLabel={t('dh1.increaseCorruption')}
                    testId="corruption-points"
                    size="sm"
                  />
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
                const agBonus = upgradeBonus(agUpgrades);
                const effectiveAg = character.stats.agility + agBonus;
                const agMod = statBonus(effectiveAg);
                return (
                  <>
                    <div className="bg-background/50 rounded border p-1 text-center">
                      <div className="text-muted-foreground text-[8px] uppercase">
                        {t('dh1.halfMove')}
                      </div>
                      <div className="text-xs font-bold">{agMod}</div>
                    </div>
                    <div className="bg-background/50 rounded border p-1 text-center">
                      <div className="text-muted-foreground text-[8px] uppercase">
                        {t('dh1.move')}
                      </div>
                      <div className="text-xs font-bold">{agMod * 2}</div>
                    </div>
                    <div className="bg-background/50 rounded border p-1 text-center">
                      <div className="text-muted-foreground text-[8px] uppercase">
                        {t('dh1.charge')}
                      </div>
                      <div className="text-xs font-bold">{agMod * 3}</div>
                    </div>
                    <div className="bg-background/50 rounded border p-1 text-center">
                      <div className="text-muted-foreground text-[8px] uppercase">
                        {t('dh1.run')}
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
      {creationReview && (
        <CreationReviewBanner
          title={t('common.creationReviewTitle')}
          description={t('common.creationReviewDescription')}
          missingLabel={t('common.creationReviewMissing')}
          missing={missingCreationFields}
          confirmLabel={t('common.creationReviewConfirm')}
          onConfirm={handleCreationReviewConfirm}
        />
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
            creationReview={creationReview}
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
          <div className="overflow-hidden md:col-span-3">
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
                  {t('common.skills')}, {t('dh1.talentsAndTraits')},{' '}
                  {t('dh1.wounds')} &amp; {t('dh1.fate')}
                </span>
              </Button>
            </Card>
          ) : (
            <Card id="skills-talents-panel">
              <CardHeader className="flex-row items-center justify-between px-6 pt-3 pb-6">
                <CardTitle className="font-headline">
                  {t('common.skills')}, {t('dh1.talentsAndTraits')},{' '}
                  {t('dh1.wounds')} &amp; {t('dh1.fate')}
                </CardTitle>
                <Button
                  variant="ghost"
                  size="icon"
                  onClick={() => setIsSkillsPanelCollapsed(true)}
                  aria-label={t('dh1.collapsePanel')}
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
                      title={t('dh1.wounds')}
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
                      title={t('dh1.fatePoints')}
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
                        {t('dh1.fatigueAndCriticalConditions')}
                      </CardTitle>
                    </CardHeader>
                    <CardContent className="space-y-4 pt-0">
                      <div className="flex flex-wrap gap-4">
                        <div className="min-w-[140px] flex-1">
                          <MetricBox
                            title={t('dh1.fatigue')}
                            notes={fatigue.notes}
                            onNoteChange={(val) =>
                              updateFatigue({ notes: val })
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
                                    value={fatigue.current ?? 0}
                                    onChange={(e) =>
                                      updateFatigue({
                                        current: Math.max(
                                          0,
                                          Math.min(
                                            parseInt(e.target.value, 10) || 0,
                                            fatigueMax,
                                          ),
                                        ),
                                      })
                                    }
                                    className="h-8 w-16 text-center text-lg font-bold"
                                  />
                                  <span className="text-muted-foreground">
                                    /
                                  </span>
                                  <span className="flex h-8 w-16 items-center justify-center text-center text-lg font-bold">
                                    {fatigueMax}
                                  </span>
                                </div>
                              ) : (
                                <div className="flex items-center justify-center gap-2">
                                  <Button
                                    size="icon"
                                    variant="outline"
                                    className="h-6 w-6"
                                    onClick={() => handleFatigueChange(-1)}
                                  >
                                    <Minus className="h-4 w-4" />
                                  </Button>
                                  <p className="text-primary w-12 text-center text-2xl font-bold">
                                    {fatigue.current ?? 0}
                                  </p>
                                  <Button
                                    size="icon"
                                    variant="outline"
                                    className="h-6 w-6"
                                    onClick={() => handleFatigueChange(1)}
                                  >
                                    <Plus className="h-4 w-4" />
                                  </Button>
                                  <p className="text-muted-foreground ml-2 text-xl font-medium">
                                    / {fatigueMax}
                                  </p>
                                </div>
                              )}
                            </div>
                          </MetricBox>
                        </div>
                      </div>

                      <div className="border-t pt-2">
                        <h4 className="mb-2 text-sm font-semibold">
                          {t('dh1.criticalConditions')}
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
                                placeholder={t('dh1.addCriticalCondition')}
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
                          label: t('dh1.weaponSkillAbbr'),
                        },
                        {
                          key: 'ballisticSkill' as const,
                          label: t('dh1.ballisticSkillAbbr'),
                        },
                        {
                          key: 'strength' as const,
                          label: t('dh1.strengthAbbr'),
                        },
                        {
                          key: 'toughness' as const,
                          label: t('dh1.toughnessAbbr'),
                        },
                        {
                          key: 'agility' as const,
                          label: t('dh1.agilityAbbr'),
                        },
                        {
                          key: 'intelligence' as const,
                          label: t('dh1.intelligenceAbbr'),
                        },
                        {
                          key: 'perception' as const,
                          label: t('dh1.perceptionAbbr'),
                        },
                        {
                          key: 'willpower' as const,
                          label: t('dh1.willpowerAbbr'),
                        },
                        {
                          key: 'fellowship' as const,
                          label: t('dh1.fellowshipAbbr'),
                        },
                      ] as const
                    ).map((char) => {
                      const stats = isCharacteristicsEditing
                        ? editableStats
                        : statRecord<number>(character, 'stats', 0);
                      const statUpgrades = isCharacteristicsEditing
                        ? editableStatUpgrades
                        : statRecord(
                            character,
                            'statUpgrades',
                            EMPTY_STAT_UPGRADE,
                          );
                      const statNotes = statRecord<string>(
                        character,
                        'statNotes',
                        '',
                      );
                      const val = stats[char.key] || 0;
                      const upgrades = (statUpgrades[char.key] ||
                        EMPTY_STAT_UPGRADE) as boolean[];
                      const bonus = upgradeBonus(upgrades);
                      const notes = statNotes[char.key] || '';
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
                                    ...statRecord<string>(
                                      character,
                                      'statNotes',
                                      '',
                                    ),
                                    [char.key]: e.target.value,
                                  };
                                  updateCharacter(character.id, {
                                    statNotes: pickAllowedStats(nextNotes),
                                  } as Partial<Character>);
                                }}
                                placeholder={t(
                                  'dh1.addNotesCharacteristicPlaceholder',
                                )}
                                className="min-h-[80px] text-xs"
                              />
                            </PopoverContent>
                          </Popover>
                          <div className="text-muted-foreground mt-1 text-[8px] font-semibold uppercase">
                            {char.label}
                          </div>
                          <div className="mt-1 mb-1 flex flex-col items-center justify-center gap-1">
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
                            <div className="grid grid-cols-2 justify-items-center gap-1">
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
                                        : statRecord(
                                            character,
                                            'statUpgrades',
                                            EMPTY_STAT_UPGRADE,
                                          );
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
                                        statUpgrades:
                                          pickAllowedStats(nextUpgrades),
                                      } as Partial<Character>);
                                    }
                                  }}
                                  dot
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
                      const agBonus = upgradeBonus(agUpgrades);
                      const effectiveAg = character.stats.agility + agBonus;
                      const agMod = statBonus(effectiveAg);
                      return (
                        <>
                          <div className="bg-background/50 rounded border p-1 text-center">
                            <div className="text-muted-foreground text-[8px] uppercase">
                              {t('dh1.halfMove')}
                            </div>
                            <div className="text-xs font-bold">{agMod}</div>
                          </div>
                          <div className="bg-background/50 rounded border p-1 text-center">
                            <div className="text-muted-foreground text-[8px] uppercase">
                              {t('dh1.move')}
                            </div>
                            <div className="text-xs font-bold">{agMod * 2}</div>
                          </div>
                          <div className="bg-background/50 rounded border p-1 text-center">
                            <div className="text-muted-foreground text-[8px] uppercase">
                              {t('dh1.charge')}
                            </div>
                            <div className="text-xs font-bold">{agMod * 3}</div>
                          </div>
                          <div className="bg-background/50 rounded border p-1 text-center">
                            <div className="text-muted-foreground text-[8px] uppercase">
                              {t('dh1.run')}
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
                  {t('dh1.equipment')}, {t('common.inventory')} &amp;{' '}
                  {t('dh1.corruption')}
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
                  aria-label={t('dh1.collapsePanel')}
                >
                  <ChevronRight className="h-5 w-5" />
                </Button>
                <CardTitle className="font-headline">
                  {t('dh1.equipment')}, {t('common.inventory')} &amp;{' '}
                  {t('dh1.corruption')}
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
                    title={t('dh1.insanity')}
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
                    editing={false}
                    onEdit={() => undefined}
                    onSave={() => undefined}
                    isCompactView={isCompactView}
                    hideNotes={hideNotes}
                    showEditButtons={false}
                  >
                    {' '}
                    <div className="flex h-full items-center justify-center">
                      <PointsStepper
                        value={
                          getSimplePointsObject(character.insanityPoints).total
                        }
                        onChange={(delta) =>
                          changeSimplePoints('insanityPoints', delta)
                        }
                        decreaseLabel={t('dh1.decreaseInsanity')}
                        increaseLabel={t('dh1.increaseInsanity')}
                        testId="insanity-points"
                        size="lg"
                      />
                    </div>
                  </MetricBox>
                  <MetricBox
                    title={t('dh1.corruption')}
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
                    editing={false}
                    onEdit={() => undefined}
                    onSave={() => undefined}
                    isCompactView={isCompactView}
                    hideNotes={hideNotes}
                    showEditButtons={false}
                  >
                    {' '}
                    <div className="flex h-full items-center justify-center">
                      <PointsStepper
                        value={
                          getSimplePointsObject(character.corruptionPoints)
                            .total
                        }
                        onChange={(delta) =>
                          changeSimplePoints('corruptionPoints', delta)
                        }
                        decreaseLabel={t('dh1.decreaseCorruption')}
                        increaseLabel={t('dh1.increaseCorruption')}
                        testId="corruption-points"
                        size="lg"
                      />
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
Dh1Sheet.displayName = 'Dh1Sheet';
