'use client';

import * as React from 'react';

import {
  ChevronDown,
  ChevronRight,
  Edit,
  Plus,
  Save,
  Trash2,
} from 'lucide-react';

import {
  Accordion,
  AccordionContent,
  AccordionItem,
  AccordionTrigger,
} from '@/components/ui/accordion';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader } from '@/components/ui/card';
import { Checkbox } from '@/components/ui/checkbox';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { useCharacterContext, useTranslation } from '@/games/plugin-host';
import { cn } from '@/lib/utils';

import type { DnDMulticlass } from '../types';

// LANDMARK: MULTICLASS_REQUIREMENTS
// Пороги мультикласса по правилам 5e: класс открывается, если соблюдены
// требования и по основной, и по новой характеристике.
type DnDStats = {
  strength: number;
  dexterity: number;
  constitution: number;
  intelligence: number;
  wisdom: number;
  charisma: number;
};

const MULTICLASS_REQUIREMENTS: Record<string, (stats: DnDStats) => boolean> = {
  Artificer: (s) => s.intelligence >= 13,
  Barbarian: (s) => s.strength >= 13,
  Bard: (s) => s.charisma >= 13,
  Cleric: (s) => s.wisdom >= 13,
  Druid: (s) => s.wisdom >= 13,
  Fighter: (s) => s.strength >= 13 || s.dexterity >= 13,
  Monk: (s) => s.dexterity >= 13 && s.wisdom >= 13,
  Paladin: (s) => s.strength >= 13 && s.charisma >= 13,
  Ranger: (s) => s.dexterity >= 13 && s.wisdom >= 13,
  Rogue: (s) => s.dexterity >= 13,
  Sorcerer: (s) => s.charisma >= 13,
  Warlock: (s) => s.charisma >= 13,
  Wizard: (s) => s.intelligence >= 13,
};

// Внутренние имена классов английские (они же в данных листа); для UI
// нужен ключ словаря, поэтому перевод идёт через отдельную карту.
const CLASS_TRANSLATION_KEYS: Record<string, string> = {
  Artificer: 'dnd.classArtificer',
  Barbarian: 'dnd.classBarbarian',
  Bard: 'dnd.classBard',
  Cleric: 'dnd.classCleric',
  Druid: 'dnd.classDruid',
  Fighter: 'dnd.classFighter',
  Monk: 'dnd.classMonk',
  Paladin: 'dnd.classPaladin',
  Ranger: 'dnd.classRanger',
  Rogue: 'dnd.classRogue',
  Sorcerer: 'dnd.classSorcerer',
  Warlock: 'dnd.classWarlock',
  Wizard: 'dnd.classWizard',
};

const DND_CLASSES = Object.keys(CLASS_TRANSLATION_KEYS);

const calculateLevelFromExp = (exp: number): number => {
  if (exp >= 355000) return 20;
  if (exp >= 305000) return 19;
  if (exp >= 265000) return 18;
  if (exp >= 225000) return 17;
  if (exp >= 195000) return 16;
  if (exp >= 165000) return 15;
  if (exp >= 140000) return 14;
  if (exp >= 120000) return 13;
  if (exp >= 100000) return 12;
  if (exp >= 85000) return 11;
  if (exp >= 64000) return 10;
  if (exp >= 48000) return 9;
  if (exp >= 34000) return 8;
  if (exp >= 23000) return 7;
  if (exp >= 14000) return 6;
  if (exp >= 6500) return 5;
  if (exp >= 2700) return 4;
  if (exp >= 900) return 3;
  if (exp >= 300) return 2;
  return 1;
};

const EditSaveButton = ({
  editing,
  onEdit,
  onSave,
}: {
  editing: boolean;
  onEdit: () => void;
  onSave: () => void;
}) =>
  editing ? (
    <Button
      data-testid="save-button"
      size="icon"
      variant="ghost"
      onClick={onSave}
      className="h-7 w-7"
    >
      <Save className="h-4 w-4" />
    </Button>
  ) : (
    <Button
      data-testid="edit-button"
      size="icon"
      variant="outline"
      onClick={onEdit}
      className="h-7 w-7"
    >
      <Edit className="h-4 w-4" />
    </Button>
  );

export interface ProgressionData {
  characterClass: string;
  level: number;
  experiencePoints: number;
  isMulticlass: boolean;
  multiclasses: DnDMulticlass[];
}

interface ProgressionSectionProps {
  /**
   * Префикс для `id`: нужен, когда секция рендерится ещё и в листе
   * компаньона — иначе на странице появляются дубли `id`, а на них
   * держатся `htmlFor`, `aria-*`, якоря и селекторы `#...` в тестах.
   */
  idPrefix?: string;
  progressionData: ProgressionData;
  setProgressionData: React.Dispatch<React.SetStateAction<ProgressionData>>;
  expToCount: number;
  setExpToCount: React.Dispatch<React.SetStateAction<number>>;
  isProgressionEditing: boolean;
  setIsProgressionEditing: React.Dispatch<React.SetStateAction<boolean>>;
  handleSaveProgression: () => void;
  stats: DnDStats;
  /** Немедленно сохраняет опыт и уровень (кнопка Add и ввод в поле опыта). */
  onPersistExperience: (experiencePoints: number, level: number) => void;
}

export function DndProgressionSection({
  progressionData,
  setProgressionData,
  expToCount,
  setExpToCount,
  isProgressionEditing,
  setIsProgressionEditing,
  handleSaveProgression,
  stats,
  onPersistExperience,
  idPrefix,
}: ProgressionSectionProps) {
  const idp = idPrefix ? `${idPrefix}-` : '';
  const { showEditButtons } = useCharacterContext();
  const { t } = useTranslation();

  const [isOpen, setIsOpen] = React.useState(true);
  const [isMulticlassOpen, setIsMulticlassOpen] = React.useState(false);

  // Локальный черновик + немедленная запись: «Add» больше не остаётся
  // только в состоянии React и не теряется при уходе со страницы.
  const persistExperience = React.useCallback(
    (experiencePoints: number) => {
      const level = Math.min(20, calculateLevelFromExp(experiencePoints));
      setProgressionData((prev) => ({ ...prev, experiencePoints, level }));
      onPersistExperience(experiencePoints, level);
    },
    [setProgressionData, onPersistExperience],
  );

  React.useEffect(() => {
    if (
      progressionData.multiclasses &&
      progressionData.multiclasses.length > 0
    ) {
      const maxTotalMcAllowed = Math.max(0, progressionData.level - 1);
      let sum = 0;

      const updated = progressionData.multiclasses.map((m) => {
        sum += m.level;
        const isDisabled = sum > maxTotalMcAllowed;
        return { ...m, isDisabled };
      });

      const isDifferent = updated.some(
        (m, i) => m.isDisabled !== progressionData.multiclasses[i].isDisabled,
      );
      if (isDifferent) {
        setProgressionData((prev) => ({ ...prev, multiclasses: updated }));
      }
    }
  }, [progressionData.level, progressionData.multiclasses, setProgressionData]);

  const activeMcLevelSum =
    progressionData.multiclasses?.reduce(
      (sum, mc) => sum + (mc.isDisabled ? 0 : mc.level),
      0,
    ) || 0;
  const mainClassLevel = progressionData.isMulticlass
    ? Math.max(1, progressionData.level - activeMcLevelSum)
    : progressionData.level;

  const renderClassSelectItems = (
    currentClass: string,
    currentIndex: number = -1,
  ) => {
    const isMulticlassSelect = currentIndex >= 0;

    return DND_CLASSES.map((c) => {
      const meetsRequirements = isMulticlassSelect
        ? (MULTICLASS_REQUIREMENTS[c]?.(stats) ?? true)
        : true;

      const isAlreadyUsed =
        currentIndex === -1
          ? progressionData.multiclasses.some((m) => m.class === c)
          : progressionData.characterClass === c ||
            progressionData.multiclasses.some(
              (m, i) => m.class === c && i !== currentIndex,
            );

      return (
        <SelectItem
          key={c}
          value={c}
          disabled={!meetsRequirements || isAlreadyUsed}
          className={
            !meetsRequirements
              ? 'text-muted-foreground/60 cursor-not-allowed'
              : ''
          }
        >
          <div className="flex w-full items-center justify-between">
            <span>{t(CLASS_TRANSLATION_KEYS[c])}</span>
            {!meetsRequirements && (
              <span className="text-destructive ml-2 text-[10px] font-semibold">
                13+
              </span>
            )}
          </div>
        </SelectItem>
      );
    });
  };

  return (
    <Accordion
      type="single"
      collapsible
      defaultValue="expanded"
      onValueChange={(val) => setIsOpen(val === 'expanded')}
      className={cn('w-full md:max-w-xl', !isOpen && 'md:self-start')}
    >
      <AccordionItem value="expanded" className="border-0">
        <Card
          id={`${idp}progression-section`}
          className="flex h-full shrink-0 flex-col overflow-hidden border-2"
        >
          <CardHeader className="bg-muted/5 flex flex-row items-center justify-between px-4 pt-2 pb-2">
            <AccordionTrigger className="flex flex-1 items-center justify-between py-0 hover:no-underline">
              <Label className="text-muted-foreground text-[10px] font-bold tracking-tight uppercase">
                {t('common.progression')}
              </Label>
            </AccordionTrigger>
            {(showEditButtons || isProgressionEditing) && (
              <EditSaveButton
                editing={isProgressionEditing}
                onEdit={() => setIsProgressionEditing(true)}
                onSave={handleSaveProgression}
              />
            )}
          </CardHeader>
          <AccordionContent>
            <CardContent className="space-y-4 p-4">
              <div className="grid grid-cols-3 gap-4">
                <div className="flex flex-col gap-1">
                  <Label className="text-muted-foreground text-[10px] font-bold uppercase">
                    {t('common.class')}
                  </Label>
                  {isProgressionEditing ? (
                    <Select
                      value={progressionData.characterClass}
                      onValueChange={(v) =>
                        setProgressionData({
                          ...progressionData,
                          characterClass: v,
                        })
                      }
                    >
                      <SelectTrigger className="h-8 text-xs">
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        {renderClassSelectItems(progressionData.characterClass)}
                      </SelectContent>
                    </Select>
                  ) : (
                    <span className="truncate text-base font-bold">
                      {t(
                        CLASS_TRANSLATION_KEYS[
                          progressionData.characterClass
                        ] || progressionData.characterClass,
                      )}
                    </span>
                  )}
                </div>
                <div className="flex flex-col gap-1">
                  <Label className="text-muted-foreground text-[10px] font-bold uppercase">
                    {t('dnd.classLevel')}
                  </Label>
                  <span className="truncate text-base font-bold">
                    {mainClassLevel}
                  </span>
                </div>
                <div className="flex flex-col gap-1">
                  <Label className="text-muted-foreground text-[10px] font-bold uppercase">
                    {t('dnd.totalLevel')}
                  </Label>
                  <span className="truncate text-base font-bold">
                    {progressionData.level}
                  </span>
                </div>
              </div>

              <div className="space-y-4 border-t pt-2">
                <div
                  className="hover:bg-muted/50 flex cursor-pointer items-center justify-between rounded-md p-1.5 transition-colors"
                  onClick={() => setIsMulticlassOpen(!isMulticlassOpen)}
                >
                  <div className="flex items-center gap-1.5">
                    {isMulticlassOpen ? (
                      <ChevronDown className="text-muted-foreground h-4 w-4" />
                    ) : (
                      <ChevronRight className="text-muted-foreground h-4 w-4" />
                    )}
                    <Label className="cursor-pointer text-[10px] font-bold uppercase select-none">
                      {t('dnd.multiclass')}
                      {progressionData.isMulticlass &&
                        progressionData.multiclasses.length > 0 && (
                          <span className="text-muted-foreground ml-1.5 text-[9px] normal-case">
                            (
                            {
                              progressionData.multiclasses.filter(
                                (m) => !m.isDisabled,
                              ).length
                            }{' '}
                            {t('dnd.active')})
                          </span>
                        )}
                    </Label>
                  </div>

                  {/* LANDMARK: MULTICLASS_TOGGLE */}
                  {/* Тумблер виден и вне режима редактирования: включение
                      мультикласса сразу открывает выбор классов. */}
                  <Checkbox
                    checked={progressionData.isMulticlass}
                    onCheckedChange={(v) => {
                      const isChecked = !!v;
                      setProgressionData({
                        ...progressionData,
                        isMulticlass: isChecked,
                      });
                      if (isChecked) setIsMulticlassOpen(true);
                    }}
                    onClick={(e) => e.stopPropagation()}
                  />
                </div>

                {isMulticlassOpen && progressionData.isMulticlass && (
                  <div className="border-muted ml-1.5 space-y-2 border-l-2 pt-2 pl-6">
                    <div className="grid grid-cols-1 gap-2 sm:grid-cols-2">
                      {progressionData.multiclasses.map((mc, idx) => (
                        <div
                          key={idx}
                          className={`flex items-center gap-2 rounded-md border p-2 ${mc.isDisabled ? 'border-muted bg-muted/50 opacity-75' : 'bg-background'}`}
                        >
                          {isProgressionEditing ? (
                            <>
                              <Select
                                value={mc.class}
                                onValueChange={(v) => {
                                  const n = [...progressionData.multiclasses];
                                  n[idx].class = v;
                                  setProgressionData({
                                    ...progressionData,
                                    multiclasses: n,
                                  });
                                }}
                              >
                                <SelectTrigger className="h-8 flex-1 text-xs">
                                  <SelectValue />
                                </SelectTrigger>
                                <SelectContent>
                                  {renderClassSelectItems(mc.class, idx)}
                                </SelectContent>
                              </Select>
                              <Input
                                type="number"
                                value={mc.level}
                                onChange={(e) => {
                                  const rawVal = parseInt(e.target.value) || 1;
                                  const n = [...progressionData.multiclasses];
                                  const otherMcSum =
                                    progressionData.multiclasses.reduce(
                                      (sum, m, i) =>
                                        i === idx ? sum : sum + m.level,
                                      0,
                                    );
                                  const maxTotalMcAllowed = Math.max(
                                    0,
                                    progressionData.level - 1,
                                  );
                                  const maxAllowed = Math.max(
                                    1,
                                    maxTotalMcAllowed - otherMcSum,
                                  );
                                  const newMcLevel = Math.max(
                                    1,
                                    Math.min(maxAllowed, rawVal),
                                  );
                                  n[idx].level = newMcLevel;
                                  setProgressionData({
                                    ...progressionData,
                                    multiclasses: n,
                                  });
                                }}
                                className="h-8 w-16 text-center"
                              />
                              <Button
                                variant="ghost"
                                size="icon"
                                className="text-destructive h-8 w-8 shrink-0"
                                onClick={() =>
                                  setProgressionData({
                                    ...progressionData,
                                    multiclasses:
                                      progressionData.multiclasses.filter(
                                        (_, i) => i !== idx,
                                      ),
                                  })
                                }
                              >
                                <Trash2 className="h-4 w-4" />
                              </Button>
                            </>
                          ) : (
                            <div
                              className={`flex w-full flex-1 items-center justify-between ${mc.isDisabled ? 'opacity-60' : ''}`}
                            >
                              <span className="text-xs font-semibold">
                                {t(
                                  CLASS_TRANSLATION_KEYS[mc.class] || mc.class,
                                )}{' '}
                                ({t('dnd.lvl')} {mc.level})
                              </span>
                              {mc.isDisabled && (
                                <span className="border-destructive/20 bg-destructive/10 text-destructive rounded border px-1.5 py-0.5 text-[10px] font-semibold">
                                  {t('dnd.disabled')}
                                </span>
                              )}
                            </div>
                          )}
                        </div>
                      ))}
                    </div>
                    {isProgressionEditing && (
                      <Button
                        variant="outline"
                        size="sm"
                        className="mt-2 h-7 w-full text-[10px]"
                        disabled={
                          progressionData.level >= 20 ||
                          progressionData.multiclasses.length >= 12
                        }
                        onClick={() => {
                          const used = [
                            progressionData.characterClass,
                            ...progressionData.multiclasses.map((m) => m.class),
                          ];
                          const avail = DND_CLASSES.filter(
                            (c) =>
                              !used.includes(c) &&
                              (MULTICLASS_REQUIREMENTS[c]?.(stats) ?? true),
                          );
                          if (avail.length > 0 && progressionData.level < 20) {
                            setProgressionData({
                              ...progressionData,
                              multiclasses: [
                                ...progressionData.multiclasses,
                                {
                                  class: avail[0],
                                  level: 1,
                                  isDisabled: false,
                                },
                              ],
                            });
                            setIsMulticlassOpen(true);
                          }
                        }}
                      >
                        <Plus className="mr-1 h-3 w-3" /> {t('dnd.addClass')}
                      </Button>
                    )}
                  </div>
                )}
              </div>

              <div className="space-y-4 border-t pt-2">
                <div className="flex flex-col gap-1">
                  <Label className="text-muted-foreground text-[10px] font-bold uppercase">
                    {t('dnd.experiencePoints')}
                  </Label>
                  {isProgressionEditing ? (
                    <Input
                      value={progressionData.experiencePoints}
                      onChange={(v) => {
                        const n = parseInt(v.target.value) || 0;
                        // LANDMARK: EXPERIENCE_AUTOSAVE
                        // Опыт сохраняется сразу (очередь в контексте склеивает
                        // «печатание» в один запрос), а не только по Save.
                        persistExperience(n);
                      }}
                      className="h-7 p-1 text-xs"
                    />
                  ) : (
                    <span className="truncate text-sm font-semibold">
                      {progressionData.experiencePoints || '-'}
                    </span>
                  )}
                </div>
                <div className="flex flex-col gap-2">
                  <Label className="text-muted-foreground text-[10px] font-bold uppercase">
                    {t('dnd.expToCount')}
                  </Label>
                  <div className="flex gap-2">
                    <Input
                      type="number"
                      value={expToCount}
                      onChange={(e) =>
                        setExpToCount(parseInt(e.target.value) || 0)
                      }
                      className="h-8 text-xs"
                    />
                    <Button
                      size="sm"
                      onClick={() => {
                        persistExperience(
                          (progressionData.experiencePoints || 0) + expToCount,
                        );
                        setExpToCount(0);
                      }}
                      className="h-8 px-3 text-xs"
                    >
                      {t('common.add')}
                    </Button>
                  </div>
                </div>
              </div>
            </CardContent>
          </AccordionContent>
        </Card>
      </AccordionItem>
    </Accordion>
  );
}
