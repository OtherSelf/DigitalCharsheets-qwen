// src/games/dh2/sections/skills-talents-section.tsx
'use client';

import * as React from 'react';

import {
  Check,
  ChevronDown,
  ChevronRight,
  Info as InfoIcon,
  Plus,
  Trash2,
} from 'lucide-react';

import { Button } from '@/components/ui/button';
import { Checkbox } from '@/components/ui/checkbox';
import {
  Collapsible,
  CollapsibleContent,
  CollapsibleTrigger,
} from '@/components/ui/collapsible';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from '@/components/ui/popover';
import { Separator } from '@/components/ui/separator';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';
import { Textarea } from '@/components/ui/textarea';
import {
  SortableItem,
  SortableRow,
  SortableRows,
  useCharacterContext,
  useTranslation,
} from '@/games/plugin-host';
import { moveItem } from '@/games/shared/collection';
import { cn } from '@/lib/utils';

import { getDarkHeresyCapabilities } from '../capabilities';
import {
  characteristicLabel,
  CHARACTERISTICS,
  materializeSkills,
  resolveSkillCharacteristic,
} from '../skill-characteristic';
import { toggleTraining } from '../skill-training';
import {
  type CharacteristicCode,
  type DH2Character,
  type Skill,
} from '../types';
import { EditSaveButton } from './dh-ui-helpers';

/**
 * Перестановка внутри одной категории умений (базовые/продвинутые): таблицы
 * показывают категорию отдельно, но массив `skills` общий. Порядок остальных
 * строк не меняется — иначе drag в одной таблице перетасовал бы соседнюю.
 */
function moveSkillSubset(
  all: readonly Skill[],
  type: Skill['type'],
  from: number,
  to: number,
): Skill[] {
  const subset = all.filter((skill) => skill.type === type);
  const moved = moveItem(subset, from, to);
  let index = 0;
  return all.map((skill) => (skill.type === type ? moved[index++] : skill));
}

interface SkillTableProps {
  skills: Skill[];
  editing: boolean;
  compact: boolean;
  hideNotes: boolean;
  showPlus30: boolean;
  onNameChange: (id: string, name: string) => void;
  onCharacteristicChange: (id: string, code: CharacteristicCode | '') => void;
  onTrainingChange: (
    id: string,
    key: keyof Skill['training'],
    checked: boolean,
  ) => void;
  onNotesChange: (id: string, notes: string) => void;
  onRemove: (id: string) => void;
  onReorder: (from: number, to: number) => void;
}

/**
 * Таблица умений одной категории (базовые/продвинутые). Обе категории
 * показывают одни и те же колонки, поэтому разметка живёт здесь: иначе
 * правка одной таблицы уезжала от другой.
 *
 * Заметки умения — иконка у названия, а не отдельная колонка: при шести-семи
 * колонках она отнимала ширину у названия на телефоне. Характеристика —
 * своя колонка; у старых листов она читается из суффикса названия `(Инт)` и
 * помечается подсказкой, в данные при этом ничего не пишется.
 */
const SkillTable = ({
  skills,
  editing,
  compact,
  hideNotes,
  showPlus30,
  onNameChange,
  onCharacteristicChange,
  onTrainingChange,
  onNotesChange,
  onRemove,
  onReorder,
}: SkillTableProps) => {
  const { t } = useTranslation();
  const skillIds = skills.map((skill) => skill.id);
  const labelsById = Object.fromEntries(
    skills.map((skill) => [skill.id, resolveSkillCharacteristic(skill).name]),
  );

  return (
    <SortableRows ids={skillIds} labelById={labelsById} onReorder={onReorder}>
      <div className="overflow-hidden rounded-lg border">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead className="w-8 p-0" aria-hidden />
              <TableHead className="w-8 p-0" aria-hidden />
              <TableHead
                className={cn('w-2/5 px-2 text-xs', compact && 'w-[35%] p-1')}
              >
                {t('common.name')}
              </TableHead>
              <TableHead
                className={cn(
                  'w-[52px] px-1 text-center',
                  compact && 'w-6 p-0 text-[10px]',
                )}
                title={t('dh2.characteristic')}
              >
                {t('dh2.characteristicShort')}
              </TableHead>
              <TableHead
                className={cn(
                  'w-[60px] px-1 text-center',
                  compact && 'w-6 p-0 text-[10px]',
                )}
                // На телефоне слово «Умелый» шире самой галочки и съедает
                // колонку названия: подпись остаётся для скринридера.
                aria-label={t('dh2.skilled')}
              >
                {compact ? (
                  <Check aria-hidden className="mx-auto h-3.5 w-3.5" />
                ) : (
                  t('dh2.skilled')
                )}
              </TableHead>
              <TableHead
                className={cn(
                  'w-[60px] px-1 text-center',
                  compact && 'w-6 p-0 text-[10px]',
                )}
              >
                +10
              </TableHead>
              <TableHead
                className={cn(
                  'w-[60px] px-1 text-center',
                  compact && 'w-6 p-0 text-[10px]',
                )}
              >
                +20
              </TableHead>
              {showPlus30 && (
                <TableHead
                  className={cn(
                    'w-[60px] px-1 text-center',
                    compact && 'w-6 p-0 text-[10px]',
                  )}
                >
                  +30
                </TableHead>
              )}
              {editing && (
                <TableHead className={cn(compact && 'p-1')}></TableHead>
              )}
            </TableRow>
          </TableHeader>
          <TableBody>
            {skills.map((skill) => {
              const {
                name: resolvedName,
                code,
                suffix,
                fromName,
              } = resolveSkillCharacteristic(skill);
              const stored = skill.characteristic as string | undefined;
              const unknownSuffix = !code && suffix ? suffix : null;
              const displayName = resolvedName;
              const training = skill.training;

              return (
                <SortableRow key={skill.id} id={skill.id} label={displayName}>
                  {(handle) => (
                    <>
                      <TableCell className={cn('w-8 p-0 text-center')}>
                        {handle}
                      </TableCell>
                      <TableCell className={cn('w-8 p-0 text-center')}>
                        {!hideNotes && (
                          <Popover>
                            <PopoverTrigger asChild>
                              <Button
                                variant="ghost"
                                size="icon"
                                className={cn(
                                  'h-7 w-7 shrink-0',
                                  skill.notes && 'text-primary',
                                )}
                                aria-label={`${t('common.notesFor')} ${displayName}`}
                              >
                                <InfoIcon className="h-4 w-4" />
                              </Button>
                            </PopoverTrigger>
                            <PopoverContent className="w-64">
                              <Label className="mb-2 block text-xs">
                                {t('common.notesFor')} {displayName}
                              </Label>
                              <Textarea
                                defaultValue={skill.notes || ''}
                                onBlur={(e) =>
                                  onNotesChange(skill.id, e.target.value)
                                }
                                placeholder={`${t('common.addNotes')}...`}
                                className="mt-2 min-h-[100px] text-sm"
                              />
                            </PopoverContent>
                          </Popover>
                        )}
                      </TableCell>
                      <TableCell className={cn('px-2', compact && 'p-1')}>
                        {editing ? (
                          <Input
                            defaultValue={skill.name}
                            onChange={(e) =>
                              onNameChange(skill.id, e.target.value)
                            }
                            aria-label={t('common.name')}
                            className="h-8 min-w-[120px] text-xs"
                          />
                        ) : (
                          <p
                            className={cn(
                              'font-medium break-words whitespace-normal',
                              compact && 'text-xs',
                            )}
                          >
                            {displayName}
                          </p>
                        )}
                      </TableCell>
                      <TableCell
                        className={cn('px-1 text-center', compact && 'p-1')}
                      >
                        {editing ? (
                          <select
                            value={stored ?? ''}
                            onChange={(e) =>
                              onCharacteristicChange(
                                skill.id,
                                e.target.value as CharacteristicCode | '',
                              )
                            }
                            aria-label={t('dh2.characteristic')}
                            className={cn(
                              'border-input bg-background focus-visible:ring-ring h-8 rounded-md border px-1 text-xs shadow-sm transition-colors focus-visible:ring-1 focus-visible:outline-none',
                              compact ? 'w-9' : 'w-[52px]',
                            )}
                          >
                            <option value="">—</option>
                            {CHARACTERISTICS.map((option) => (
                              <option
                                key={option}
                                value={option}
                                title={t(`dh2.${option}`)}
                              >
                                {characteristicLabel(option, t)}
                              </option>
                            ))}
                          </select>
                        ) : code ? (
                          <span
                            className="text-xs font-medium"
                            title={
                              fromName
                                ? t('dh2.characteristicFromName')
                                : t(`dh2.${code}`)
                            }
                          >
                            {characteristicLabel(code, t)}
                          </span>
                        ) : unknownSuffix ? (
                          <span
                            className="text-muted-foreground text-xs"
                            title={t('dh2.characteristicFromName')}
                          >
                            {unknownSuffix}
                          </span>
                        ) : (
                          <span className="text-muted-foreground text-xs">
                            —
                          </span>
                        )}
                      </TableCell>
                      <TableCell
                        className={cn('text-center', compact && 'p-1')}
                      >
                        <Checkbox
                          checked={training.skilled}
                          disabled={!editing}
                          aria-label={`${displayName}: ${t('dh2.skilled')}`}
                          onCheckedChange={(c) =>
                            onTrainingChange(skill.id, 'skilled', !!c)
                          }
                        />
                      </TableCell>
                      <TableCell
                        className={cn('text-center', compact && 'p-1')}
                      >
                        <Checkbox
                          checked={training.plus10}
                          disabled={!editing || !training.skilled}
                          aria-label={`${displayName}: +10`}
                          onCheckedChange={(c) =>
                            onTrainingChange(skill.id, 'plus10', !!c)
                          }
                        />
                      </TableCell>
                      <TableCell
                        className={cn('text-center', compact && 'p-1')}
                      >
                        <Checkbox
                          checked={training.plus20}
                          disabled={!editing || !training.plus10}
                          aria-label={`${displayName}: +20`}
                          onCheckedChange={(c) =>
                            onTrainingChange(skill.id, 'plus20', !!c)
                          }
                        />
                      </TableCell>
                      {showPlus30 && (
                        <TableCell
                          className={cn('text-center', compact && 'p-1')}
                        >
                          <Checkbox
                            checked={!!training.plus30}
                            disabled={!editing || !training.plus20}
                            aria-label={`${displayName}: +30`}
                            onCheckedChange={(c) =>
                              onTrainingChange(skill.id, 'plus30', !!c)
                            }
                          />
                        </TableCell>
                      )}
                      {editing && (
                        <TableCell className={cn(compact && 'p-1')}>
                          <Button
                            variant="ghost"
                            size="icon"
                            className="h-7 w-7"
                            aria-label={t('common.delete')}
                            onClick={() => onRemove(skill.id)}
                          >
                            <Trash2 className="text-destructive h-4 w-4" />
                          </Button>
                        </TableCell>
                      )}
                    </>
                  )}
                </SortableRow>
              );
            })}
          </TableBody>
        </Table>
      </div>
    </SortableRows>
  );
};

interface SkillsTalentsSectionProps {
  character: DH2Character;
  isCompactView: boolean;
  activeCompactSection: string;
  onEditingChange?: (val: boolean) => void;
}

export const SkillsTalentsSection = React.forwardRef<
  { saveAll: () => void },
  SkillsTalentsSectionProps
>(
  (
    { character, isCompactView, activeCompactSection, onEditingChange },
    ref,
  ) => {
    const { updateCharacter, hideNotes, showEditButtons } =
      useCharacterContext();
    const { t } = useTranslation();

    const [isSkillsOpen, setIsSkillsOpen] = React.useState(true);
    const [isTalentsOpen, setIsTalentsOpen] = React.useState(true);

    const [isSkillsEditing, setIsSkillsEditing] = React.useState(false);
    const [isTalentsEditing, setIsTalentsEditing] = React.useState(false);

    const [editableSkills, setEditableSkills] = React.useState(
      character.skills ?? [],
    );
    const [newBasicSkillName, setNewBasicSkillName] = React.useState('');
    const [newBasicSkillChar, setNewBasicSkillChar] =
      React.useState<string>('agility');
    const [newAdvancedSkillName, setNewAdvancedSkillName] = React.useState('');
    const [newAdvancedSkillChar, setNewAdvancedSkillChar] =
      React.useState<string>('intelligence');
    const [editableTalents, setEditableTalents] = React.useState(
      character.talents ?? [],
    );
    const [newTalentName, setNewTalentName] = React.useState('');
    const [newTalentDescription, setNewTalentDescription] = React.useState('');

    // ─── LANDMARK: CAPABILITY_PLUS30_COLUMN ───
    // Колонка +30 существует только во 2-й редакции; редакция приходит из
    // модуля (systemId), переключателя в UI больше нет.
    const showPlus30 = getDarkHeresyCapabilities(character).plus30;

    const handleSaveSkills = React.useCallback(() => {
      updateCharacter(character.id, { skills: editableSkills });
      setIsSkillsEditing(false);
    }, [character.id, editableSkills, updateCharacter]);

    const handleSaveTalents = React.useCallback(() => {
      updateCharacter(character.id, { talents: editableTalents });
      setIsTalentsEditing(false);
    }, [character.id, editableTalents, updateCharacter]);

    /**
     * Вход в правку умений: характеристика из суффикса названия переезжает в
     * поле, чтобы «Сохранить» записало чистое имя. На чтении листа данные не
     * меняются — переписывает только этот явный шаг игрока.
     */
    const startSkillsEditing = React.useCallback(() => {
      setEditableSkills(materializeSkills(character.skills ?? []));
      setIsSkillsOpen(true);
      setIsSkillsEditing(true);
    }, [character.skills]);

    const setSkillName = React.useCallback((id: string, name: string) => {
      setEditableSkills((prev) =>
        prev.map((skill) => (skill.id === id ? { ...skill, name } : skill)),
      );
    }, []);

    const setSkillCharacteristic = React.useCallback(
      (id: string, code: CharacteristicCode | '') => {
        setEditableSkills((prev) =>
          prev.map((skill) =>
            skill.id === id
              ? {
                  ...skill,
                  characteristic: code === '' ? undefined : code,
                }
              : skill,
          ),
        );
      },
      [],
    );

    const setSkillNotes = React.useCallback(
      (id: string, notes: string) => {
        if (isSkillsEditing) {
          setEditableSkills((prev) =>
            prev.map((skill) =>
              skill.id === id ? { ...skill, notes } : skill,
            ),
          );
          return;
        }
        updateCharacter(character.id, {
          skills: (character.skills ?? []).map((skill) =>
            skill.id === id ? { ...skill, notes } : skill,
          ),
        });
      },
      [character.id, character.skills, isSkillsEditing, updateCharacter],
    );

    const removeSkill = React.useCallback((id: string) => {
      setEditableSkills((prev) => prev.filter((skill) => skill.id !== id));
    }, []);

    /**
     * Порядок — часть листа (D7): в режиме правки перестановка копится в
     * `editableSkills` и сохраняется кнопкой, в просмотре сразу уходит в
     * очередь сохранений, как любая другая правка.
     */
    const reorderSkills =
      (type: Skill['type']) => (from: number, to: number) => {
        if (isSkillsEditing) {
          setEditableSkills((prev) => moveSkillSubset(prev, type, from, to));
          return;
        }
        updateCharacter(character.id, {
          skills: moveSkillSubset(character.skills ?? [], type, from, to),
        });
      };

    const reorderTalents = (from: number, to: number) => {
      if (isTalentsEditing) {
        setEditableTalents((prev) => moveItem(prev, from, to));
        return;
      }
      updateCharacter(character.id, {
        talents: moveItem(character.talents ?? [], from, to),
      });
    };

    const currentTalents = isTalentsEditing
      ? editableTalents
      : (character.talents ?? []);
    const talentIds = currentTalents.map((talent) => talent.id);
    const talentLabels = Object.fromEntries(
      currentTalents.map((talent) => [talent.id, talent.name]),
    );

    const handleSkillTrainingUpdate = (
      skillId: string,
      trainingKey: keyof Skill['training'],
      isChecked: boolean,
    ) => {
      const skillsToUpdate = isSkillsEditing
        ? editableSkills
        : (character.skills ?? []);
      const nextSkills = skillsToUpdate.map((s) => {
        if (s.id === skillId) {
          // Кумулятивность уровней — правило системы, а не UI: та же функция
          // зовётся из `derive` при записи листа.
          return {
            ...s,
            training: toggleTraining(s.training, trainingKey, isChecked),
          };
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
        setEditableSkills([
          ...editableSkills,
          {
            id: `new-skill-${Date.now()}`,
            name: newBasicSkillName.trim(),
            characteristic: newBasicSkillChar as CharacteristicCode,
            notes: '',
            type: 'basic',
            training: {
              skilled: false,
              plus10: false,
              plus20: false,
              plus30: false,
            },
          },
        ]);
        setNewBasicSkillName('');
        setNewBasicSkillChar('agility');
      }
    };

    const addAdvancedSkill = () => {
      if (newAdvancedSkillName.trim() !== '') {
        setEditableSkills([
          ...editableSkills,
          {
            id: `new-skill-${Date.now()}`,
            name: newAdvancedSkillName.trim(),
            characteristic: newAdvancedSkillChar as CharacteristicCode,
            notes: '',
            type: 'advanced',
            training: {
              skilled: false,
              plus10: false,
              plus20: false,
              plus30: false,
            },
          },
        ]);
        setNewAdvancedSkillName('');
        setNewAdvancedSkillChar('intelligence');
      }
    };

    const addTalent = () => {
      if (newTalentName.trim() !== '') {
        setEditableTalents([
          ...editableTalents,
          {
            id: `new-talent-${Date.now()}`,
            name: newTalentName,
            notes: '',
            description: newTalentDescription.trim() || undefined,
          },
        ]);
        setNewTalentName('');
        setNewTalentDescription('');
      }
    };

    const currentSkills = isSkillsEditing
      ? editableSkills
      : (character.skills ?? []);
    const basicSkills = currentSkills.filter((s) => s.type === 'basic');
    const advancedSkills = currentSkills.filter((s) => s.type === 'advanced');

    const isAnyEditing = isSkillsEditing || isTalentsEditing;
    React.useEffect(() => {
      onEditingChange?.(isAnyEditing);
    }, [isAnyEditing, onEditingChange]);

    React.useImperativeHandle(
      ref,
      () => ({
        saveAll: () => {
          if (isSkillsEditing) handleSaveSkills();
          if (isTalentsEditing) handleSaveTalents();
        },
      }),
      [isSkillsEditing, isTalentsEditing, handleSaveSkills, handleSaveTalents],
    );

    const showSkills =
      !isCompactView || activeCompactSection === 'skills-section';
    const showTalents =
      !isCompactView || activeCompactSection === 'talents-section';

    return (
      <div id="skills-talents-content" className="w-full space-y-6">
        <div
          className={cn(
            'bg-card space-y-6 rounded-lg border',
            isCompactView ? 'p-3' : 'p-4 md:p-6',
          )}
        >
          {/* ==================== SKILLS SECTION ==================== */}
          {showSkills && (
            <Collapsible
              id="skills-section"
              open={isSkillsOpen}
              onOpenChange={setIsSkillsOpen}
              className="w-full"
            >
              <div className="mb-2 flex flex-row items-center justify-between">
                <CollapsibleTrigger className="hover:bg-accent hover:text-accent-foreground -ml-2 flex items-center gap-2 rounded-md px-2 py-1 transition-colors focus:outline-none">
                  {isSkillsOpen ? (
                    <ChevronDown className="h-5 w-5" />
                  ) : (
                    <ChevronRight className="h-5 w-5" />
                  )}
                  <h3 className="font-headline text-lg font-semibold">
                    {t('dh2.skills')}
                  </h3>
                </CollapsibleTrigger>
                {(showEditButtons || isSkillsEditing) && (
                  <EditSaveButton
                    editing={isSkillsEditing}
                    onEdit={startSkillsEditing}
                    onSave={handleSaveSkills}
                  />
                )}
              </div>

              <CollapsibleContent className="w-full">
                <div className="grid grid-cols-1 gap-x-8 gap-y-6 md:grid-cols-2">
                  {/* BASIC SKILLS */}
                  <div>
                    <h4 className="text-muted-foreground mb-2 font-semibold">
                      {t('dh2.basic')}
                    </h4>
                    <SkillTable
                      skills={basicSkills}
                      editing={isSkillsEditing}
                      compact={isCompactView}
                      hideNotes={hideNotes}
                      showPlus30={showPlus30}
                      onNameChange={setSkillName}
                      onCharacteristicChange={setSkillCharacteristic}
                      onTrainingChange={handleSkillTrainingUpdate}
                      onNotesChange={setSkillNotes}
                      onRemove={removeSkill}
                      onReorder={reorderSkills('basic')}
                    />
                    {isSkillsEditing && (
                      <div className="bg-background mt-4 flex flex-col gap-2 rounded-md border p-3">
                        <div className="flex gap-2">
                          <Input
                            placeholder={t('dh2.basic')}
                            value={newBasicSkillName}
                            onChange={(e) =>
                              setNewBasicSkillName(e.target.value)
                            }
                            className="flex-grow"
                          />
                          <select
                            value={newBasicSkillChar}
                            onChange={(e) =>
                              setNewBasicSkillChar(e.target.value)
                            }
                            aria-label={t('dh2.characteristic')}
                            className="border-input bg-background focus-visible:ring-ring flex h-9 w-20 rounded-md border px-2 py-1 text-sm shadow-sm transition-colors focus-visible:ring-1 focus-visible:outline-none"
                          >
                            {CHARACTERISTICS.map((code) => (
                              <option
                                key={code}
                                value={code}
                                title={t(`dh2.${code}`)}
                              >
                                {characteristicLabel(code, t)}
                              </option>
                            ))}
                          </select>
                          <Button onClick={addBasicSkill} size="sm">
                            <Plus className="mr-2 h-4 w-4" /> {t('common.add')}
                          </Button>
                        </div>
                      </div>
                    )}
                  </div>

                  {/* ADVANCED SKILLS */}
                  <div>
                    <h4 className="text-muted-foreground mb-2 font-semibold">
                      {t('dh2.advanced')}
                    </h4>
                    <SkillTable
                      skills={advancedSkills}
                      editing={isSkillsEditing}
                      compact={isCompactView}
                      hideNotes={hideNotes}
                      showPlus30={showPlus30}
                      onNameChange={setSkillName}
                      onCharacteristicChange={setSkillCharacteristic}
                      onTrainingChange={handleSkillTrainingUpdate}
                      onNotesChange={setSkillNotes}
                      onRemove={removeSkill}
                      onReorder={reorderSkills('advanced')}
                    />
                    {isSkillsEditing && (
                      <div className="bg-background mt-4 flex flex-col gap-2 rounded-md border p-3">
                        <div className="flex gap-2">
                          <Input
                            placeholder={t('dh2.advanced')}
                            value={newAdvancedSkillName}
                            onChange={(e) =>
                              setNewAdvancedSkillName(e.target.value)
                            }
                            className="flex-grow"
                          />
                          <select
                            value={newAdvancedSkillChar}
                            onChange={(e) =>
                              setNewAdvancedSkillChar(e.target.value)
                            }
                            aria-label={t('dh2.characteristic')}
                            className="border-input bg-background focus-visible:ring-ring flex h-9 w-20 rounded-md border px-2 py-1 text-sm shadow-sm transition-colors focus-visible:ring-1 focus-visible:outline-none"
                          >
                            {CHARACTERISTICS.map((code) => (
                              <option
                                key={code}
                                value={code}
                                title={t(`dh2.${code}`)}
                              >
                                {characteristicLabel(code, t)}
                              </option>
                            ))}
                          </select>
                          <Button onClick={addAdvancedSkill} size="sm">
                            <Plus className="mr-2 h-4 w-4" /> {t('common.add')}
                          </Button>
                        </div>
                      </div>
                    )}
                  </div>
                </div>
              </CollapsibleContent>
            </Collapsible>
          )}

          {showSkills && showTalents && (
            <Separator className={cn(isCompactView && 'hidden')} />
          )}

          {/* ==================== TALENTS & TRAITS SECTION ==================== */}
          {showTalents && (
            <Collapsible
              id="talents-section"
              open={isTalentsOpen}
              onOpenChange={setIsTalentsOpen}
              className="w-full"
            >
              <div className="mb-2 flex flex-row items-center justify-between">
                <CollapsibleTrigger className="hover:bg-accent hover:text-accent-foreground -ml-2 flex items-center gap-2 rounded-md px-2 py-1 transition-colors focus:outline-none">
                  {isTalentsOpen ? (
                    <ChevronDown className="h-5 w-5" />
                  ) : (
                    <ChevronRight className="h-5 w-5" />
                  )}
                  <h3 className="font-headline text-lg font-semibold">
                    {t('dh2.talentsAndTraits')}
                  </h3>
                </CollapsibleTrigger>
                {(showEditButtons || isTalentsEditing) && (
                  <EditSaveButton
                    editing={isTalentsEditing}
                    onEdit={() => {
                      setIsTalentsOpen(true);
                      setIsTalentsEditing(true);
                    }}
                    onSave={handleSaveTalents}
                  />
                )}
              </div>

              <CollapsibleContent className="w-full">
                {isTalentsEditing ? (
                  <div className="space-y-4">
                    <SortableRows
                      ids={talentIds}
                      labelById={talentLabels}
                      onReorder={reorderTalents}
                    >
                      <ul className="space-y-3">
                        {(editableTalents ?? []).map((talent) => (
                          <SortableItem
                            as="li"
                            key={talent.id}
                            id={talent.id}
                            label={talent.name}
                            className="space-y-2 rounded-md border bg-transparent p-2"
                          >
                            {(handle) => (
                              <>
                                <div className="flex items-center gap-1">
                                  {handle}
                                  {!hideNotes && (
                                    <Popover>
                                      <PopoverTrigger asChild>
                                        <Button
                                          variant="ghost"
                                          size="icon"
                                          className={cn(
                                            'h-9 w-9 shrink-0',
                                            talent.notes && 'text-primary',
                                          )}
                                        >
                                          <InfoIcon className="h-4 w-4" />
                                        </Button>
                                      </PopoverTrigger>
                                      <PopoverContent className="w-64">
                                        <Label className="mb-2 block text-xs">
                                          {t('common.notesFor')} {talent.name}
                                        </Label>
                                        <Textarea
                                          defaultValue={talent.notes || ''}
                                          onBlur={(e) =>
                                            setEditableTalents(
                                              editableTalents.map((t) =>
                                                t.id === talent.id
                                                  ? {
                                                      ...t,
                                                      notes: e.target.value,
                                                    }
                                                  : t,
                                              ),
                                            )
                                          }
                                          placeholder={`${t('common.addNotes')}...`}
                                          className="mt-2 min-h-[100px] text-sm"
                                        />
                                      </PopoverContent>
                                    </Popover>
                                  )}
                                  <Input
                                    defaultValue={talent.name}
                                    onChange={(e) =>
                                      setEditableTalents(
                                        editableTalents.map((t) =>
                                          t.id === talent.id
                                            ? { ...t, name: e.target.value }
                                            : t,
                                        ),
                                      )
                                    }
                                    className="h-9 flex-grow"
                                  />
                                  <Button
                                    variant="ghost"
                                    size="icon"
                                    className="h-7 w-7 shrink-0"
                                    onClick={() =>
                                      setEditableTalents(
                                        editableTalents.filter(
                                          (t) => t.id !== talent.id,
                                        ),
                                      )
                                    }
                                  >
                                    <Trash2 className="text-destructive h-4 w-4" />
                                  </Button>
                                </div>
                                <Textarea
                                  defaultValue={talent.description || ''}
                                  onChange={(e) =>
                                    setEditableTalents(
                                      editableTalents.map((t) =>
                                        t.id === talent.id
                                          ? {
                                              ...t,
                                              description: e.target.value,
                                            }
                                          : t,
                                      ),
                                    )
                                  }
                                  placeholder={`${t('common.description')}...`}
                                  className="min-h-[60px] text-sm"
                                />
                              </>
                            )}
                          </SortableItem>
                        ))}
                      </ul>
                    </SortableRows>
                    <div className="space-y-2 rounded-md border bg-transparent p-2">
                      <Input
                        placeholder={t('dh2.newTalentPlaceholder')}
                        value={newTalentName}
                        onChange={(e) => setNewTalentName(e.target.value)}
                      />
                      <Textarea
                        placeholder={t('dh2.descriptionOptional')}
                        value={newTalentDescription}
                        onChange={(e) =>
                          setNewTalentDescription(e.target.value)
                        }
                        className="min-h-[60px] text-sm"
                      />
                      <Button onClick={addTalent} className="w-full">
                        <Plus className="mr-2 h-4 w-4" /> {t('common.add')}
                      </Button>
                    </div>
                  </div>
                ) : (
                  <div className="space-y-3">
                    {(character.talents ?? []).length > 0 ? (
                      <SortableRows
                        ids={talentIds}
                        labelById={talentLabels}
                        onReorder={reorderTalents}
                      >
                        {character.talents.map((talent) => (
                          <SortableItem
                            key={talent.id}
                            id={talent.id}
                            label={talent.name}
                            className="overflow-hidden rounded-md border bg-transparent"
                          >
                            {(handle) => (
                              <Collapsible>
                                <div
                                  className={cn(
                                    'flex items-start gap-1 p-2',
                                    isCompactView ? 'text-xs' : 'text-sm',
                                  )}
                                >
                                  {handle}
                                  {!hideNotes && (
                                    <Popover>
                                      <PopoverTrigger asChild>
                                        <Button
                                          variant="ghost"
                                          size="icon"
                                          className={cn(
                                            'mt-0.5 h-6 w-6 shrink-0',
                                            talent.notes && 'text-primary',
                                          )}
                                        >
                                          <InfoIcon className="h-4 w-4" />
                                        </Button>
                                      </PopoverTrigger>
                                      <PopoverContent className="w-64">
                                        <Label className="mb-2 block text-xs">
                                          {t('common.notesFor')} {talent.name}
                                        </Label>
                                        <Textarea
                                          defaultValue={talent.notes || ''}
                                          onBlur={(e) =>
                                            updateCharacter(character.id, {
                                              talents: (
                                                character.talents || []
                                              ).map((t) =>
                                                t.id === talent.id
                                                  ? {
                                                      ...t,
                                                      notes: e.target.value,
                                                    }
                                                  : t,
                                              ),
                                            })
                                          }
                                          placeholder={`${t('common.addNotes')}...`}
                                          className="mt-2 min-h-[100px] text-sm"
                                        />
                                      </PopoverContent>
                                    </Popover>
                                  )}
                                  <div className="flex-grow">
                                    <CollapsibleTrigger className="hover:bg-accent/50 -mx-2 flex w-full items-center justify-between rounded px-2 py-1 text-left transition-colors">
                                      <p className="text-foreground flex-grow font-medium break-words">
                                        {talent.name}
                                      </p>
                                      {talent.description && (
                                        <ChevronDown className="ml-2 h-4 w-4 shrink-0 transition-transform duration-200 data-[state=open]:rotate-180" />
                                      )}
                                    </CollapsibleTrigger>
                                    {talent.description && (
                                      <CollapsibleContent className="pt-2">
                                        <p
                                          className={cn(
                                            'text-muted-foreground whitespace-pre-wrap',
                                            isCompactView
                                              ? 'text-xs'
                                              : 'text-sm',
                                          )}
                                        >
                                          {talent.description}
                                        </p>
                                      </CollapsibleContent>
                                    )}
                                  </div>
                                </div>
                              </Collapsible>
                            )}
                          </SortableItem>
                        ))}
                      </SortableRows>
                    ) : (
                      <p
                        className={cn(
                          'text-muted-foreground',
                          isCompactView ? 'text-xs' : 'text-sm',
                        )}
                      >
                        {t('dh2.noTalentsOrTraits')}
                      </p>
                    )}
                  </div>
                )}
              </CollapsibleContent>
            </Collapsible>
          )}
        </div>
      </div>
    );
  },
);

SkillsTalentsSection.displayName = 'SkillsTalentsSection';
