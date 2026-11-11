// src/components/sheets/dh-sections/skills-talents-section.tsx
'use client';

import * as React from 'react';

import {
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
import { useCharacterContext } from '@/context/character-context';
import { useTranslation } from '@/context/language-context';
import { getDarkHeresyCapabilities } from '@/games/dh-shared/capabilities';
import { Skill, type DarkHeresyCharacter } from '@/lib/types';
import { cn } from '@/lib/utils';

import { EditSaveButton } from './dh-ui-helpers';

const CHARACTERISTIC_KEYS = [
  'dh.weaponSkill',
  'dh.ballisticSkill',
  'common.strength',
  'dh.toughness',
  'dh.agility',
  'common.intelligence',
  'common.perception',
  'common.willpower',
  'dh.fellowship',
  'dh.influence',
] as const;

const ABBR_KEYS: Record<string, string> = {
  'dh.weaponSkill': 'dh.weaponSkillAbbr',
  'dh.ballisticSkill': 'dh.ballisticSkillAbbr',
  'common.strength': 'dh.strengthAbbr',
  'dh.toughness': 'dh.toughnessAbbr',
  'dh.agility': 'dh.agilityAbbr',
  'common.intelligence': 'dh.intelligenceAbbr',
  'common.perception': 'dh.perceptionAbbr',
  'common.willpower': 'dh.willpowerAbbr',
  'dh.fellowship': 'dh.fellowshipAbbr',
  'dh.influence': 'dh.influenceAbbr',
};

const ABBR_TO_KEY: Record<string, (typeof CHARACTERISTIC_KEYS)[number]> = {
  WS: 'dh.weaponSkill',
  ББ: 'dh.weaponSkill',
  BS: 'dh.ballisticSkill',
  ДБ: 'dh.ballisticSkill',
  S: 'common.strength',
  СЛ: 'common.strength',
  T: 'dh.toughness',
  СТ: 'dh.toughness',
  Ag: 'dh.agility',
  AG: 'dh.agility',
  ЛВ: 'dh.agility',
  Int: 'common.intelligence',
  INT: 'common.intelligence',
  ИН: 'common.intelligence',
  Per: 'common.perception',
  PER: 'common.perception',
  ВП: 'common.perception',
  WP: 'common.willpower',
  СВ: 'common.willpower',
  Fel: 'dh.fellowship',
  FEL: 'dh.fellowship',
  ОБ: 'dh.fellowship',
  Inf: 'dh.influence',
  INF: 'dh.influence',
  ВЛ: 'dh.influence',
};

const getTranslatedSkillName = (
  skillName: string,
  t: (key: string) => string,
) => {
  const match = skillName.match(/^(.*?)\s*\(([^)]+)\)$/);
  if (match) {
    const baseName = match[1].trim();
    const abbr = match[2].trim();
    const key = ABBR_TO_KEY[abbr];
    const abbrKey = key ? ABBR_KEYS[key] : undefined;
    if (abbrKey) {
      return `${baseName} (${t(abbrKey)})`;
    }
  }
  return skillName;
};

interface SkillsTalentsSectionProps {
  character: DarkHeresyCharacter;
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
      React.useState<string>('dh.agility');
    const [newAdvancedSkillName, setNewAdvancedSkillName] = React.useState('');
    const [newAdvancedSkillChar, setNewAdvancedSkillChar] =
      React.useState<string>('common.intelligence');
    const [editableTalents, setEditableTalents] = React.useState(
      character.talents ?? [],
    );
    const [newTalentName, setNewTalentName] = React.useState('');
    const [newTalentDescription, setNewTalentDescription] = React.useState('');

    // ==================== LANDMARK: CAPABILITY CHECK FOR +30 COLUMN ====================
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
          const next = { ...s.training, [trainingKey]: isChecked };
          if (trainingKey === 'skilled' && !isChecked) {
            next.plus10 = false;
            next.plus20 = false;
            next.plus30 = false;
          }
          if (trainingKey === 'plus10' && !isChecked) {
            next.plus20 = false;
            next.plus30 = false;
          }
          if (trainingKey === 'plus20' && !isChecked) {
            next.plus30 = false;
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
        const abbrKey = ABBR_KEYS[newBasicSkillChar];
        const charAbbr = abbrKey ? t(abbrKey) : newBasicSkillChar;
        setEditableSkills([
          ...editableSkills,
          {
            id: `new-skill-${Date.now()}`,
            name: `${newBasicSkillName} (${charAbbr})`,
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
        setNewBasicSkillChar('dh.agility');
      }
    };

    const addAdvancedSkill = () => {
      if (newAdvancedSkillName.trim() !== '') {
        const abbrKey = ABBR_KEYS[newAdvancedSkillChar];
        const charAbbr = abbrKey ? t(abbrKey) : newAdvancedSkillChar;
        setEditableSkills([
          ...editableSkills,
          {
            id: `new-skill-${Date.now()}`,
            name: `${newAdvancedSkillName} (${charAbbr})`,
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
                    {t('common.skills')}
                  </h3>
                </CollapsibleTrigger>
                {(showEditButtons || isSkillsEditing) && (
                  <EditSaveButton
                    editing={isSkillsEditing}
                    onEdit={() => {
                      setIsSkillsOpen(true);
                      setIsSkillsEditing(true);
                    }}
                    onSave={handleSaveSkills}
                  />
                )}
              </div>

              <CollapsibleContent className="w-full">
                <div className="grid grid-cols-1 gap-x-8 gap-y-6 md:grid-cols-2">
                  {/* BASIC SKILLS */}
                  <div>
                    <h4 className="text-muted-foreground mb-2 font-semibold">
                      {t('dh.basic')}
                    </h4>
                    <div className="overflow-hidden rounded-lg border">
                      <Table>
                        <TableHeader>
                          <TableRow>
                            <TableHead
                              className={cn('w-[40px]', isCompactView && 'p-1')}
                            >
                              {t('common.notes')}
                            </TableHead>
                            <TableHead
                              className={cn(
                                'w-2/5',
                                isCompactView && 'p-2 text-xs',
                              )}
                            >
                              {t('common.name')}
                            </TableHead>
                            <TableHead
                              className={cn(
                                'w-[60px] px-1 text-center',
                                isCompactView && 'p-1 text-xs',
                              )}
                            >
                              {t('dh.skilled')}
                            </TableHead>
                            <TableHead
                              className={cn(
                                'w-[60px] px-1 text-center',
                                isCompactView && 'p-1 text-xs',
                              )}
                            >
                              +10
                            </TableHead>
                            <TableHead
                              className={cn(
                                'w-[60px] px-1 text-center',
                                isCompactView && 'p-1 text-xs',
                              )}
                            >
                              +20
                            </TableHead>
                            {showPlus30 && (
                              <TableHead
                                className={cn(
                                  'w-[60px] px-1 text-center',
                                  isCompactView && 'p-1 text-xs',
                                )}
                              >
                                +30
                              </TableHead>
                            )}
                            {isSkillsEditing && (
                              <TableHead
                                className={cn(isCompactView && 'p-1')}
                              ></TableHead>
                            )}
                          </TableRow>
                        </TableHeader>
                        <TableBody>
                          {basicSkills.map((skill) => (
                            <TableRow key={skill.id}>
                              <TableCell className={cn(isCompactView && 'p-1')}>
                                {!hideNotes && (
                                  <Popover>
                                    <PopoverTrigger asChild>
                                      <Button
                                        variant={
                                          skill.notes ? 'secondary' : 'ghost'
                                        }
                                        size="icon"
                                        className="h-7 w-7"
                                      >
                                        <InfoIcon className="h-4 w-4" />
                                      </Button>
                                    </PopoverTrigger>
                                    <PopoverContent className="w-64">
                                      <Label className="mb-2 block text-xs">
                                        {t('common.notesFor')}{' '}
                                        {getTranslatedSkillName(skill.name, t)}
                                      </Label>
                                      <Textarea
                                        defaultValue={skill.notes || ''}
                                        onBlur={(e) =>
                                          updateCharacter(character.id, {
                                            skills: (
                                              character.skills || []
                                            ).map((s) =>
                                              s.id === skill.id
                                                ? {
                                                    ...s,
                                                    notes: e.target.value,
                                                  }
                                                : s,
                                            ),
                                          })
                                        }
                                        placeholder={`${t('common.addNotes')}...`}
                                        className="mt-2 min-h-[100px] text-sm"
                                      />
                                    </PopoverContent>
                                  </Popover>
                                )}
                              </TableCell>
                              <TableCell className={cn(isCompactView && 'p-2')}>
                                {isSkillsEditing ? (
                                  <Input
                                    defaultValue={skill.name}
                                    onChange={(e) =>
                                      setEditableSkills(
                                        editableSkills.map((s) =>
                                          s.id === skill.id
                                            ? { ...s, name: e.target.value }
                                            : s,
                                        ),
                                      )
                                    }
                                    className="h-8 min-w-[140px] text-xs"
                                  />
                                ) : (
                                  <p
                                    className={cn(
                                      'font-medium break-words whitespace-normal',
                                      isCompactView && 'text-xs',
                                    )}
                                  >
                                    {getTranslatedSkillName(skill.name, t)}
                                  </p>
                                )}
                              </TableCell>
                              <TableCell
                                className={cn(
                                  'text-center',
                                  isCompactView && 'p-1',
                                )}
                              >
                                <Checkbox
                                  checked={skill.training.skilled}
                                  disabled={!isSkillsEditing}
                                  onCheckedChange={(c) =>
                                    handleSkillTrainingUpdate(
                                      skill.id,
                                      'skilled',
                                      !!c,
                                    )
                                  }
                                />
                              </TableCell>
                              <TableCell
                                className={cn(
                                  'text-center',
                                  isCompactView && 'p-1',
                                )}
                              >
                                <Checkbox
                                  checked={skill.training.plus10}
                                  disabled={
                                    !isSkillsEditing || !skill.training.skilled
                                  }
                                  onCheckedChange={(c) =>
                                    handleSkillTrainingUpdate(
                                      skill.id,
                                      'plus10',
                                      !!c,
                                    )
                                  }
                                />
                              </TableCell>
                              <TableCell
                                className={cn(
                                  'text-center',
                                  isCompactView && 'p-1',
                                )}
                              >
                                <Checkbox
                                  checked={skill.training.plus20}
                                  disabled={
                                    !isSkillsEditing || !skill.training.plus10
                                  }
                                  onCheckedChange={(c) =>
                                    handleSkillTrainingUpdate(
                                      skill.id,
                                      'plus20',
                                      !!c,
                                    )
                                  }
                                />
                              </TableCell>
                              {showPlus30 && (
                                <TableCell
                                  className={cn(
                                    'text-center',
                                    isCompactView && 'p-1',
                                  )}
                                >
                                  <Checkbox
                                    checked={!!skill.training.plus30}
                                    disabled={
                                      !isSkillsEditing || !skill.training.plus20
                                    }
                                    onCheckedChange={(c) =>
                                      handleSkillTrainingUpdate(
                                        skill.id,
                                        'plus30',
                                        !!c,
                                      )
                                    }
                                  />
                                </TableCell>
                              )}
                              {isSkillsEditing && (
                                <TableCell
                                  className={cn(isCompactView && 'p-1')}
                                >
                                  <Button
                                    variant="ghost"
                                    size="icon"
                                    className="h-7 w-7"
                                    onClick={() =>
                                      setEditableSkills(
                                        editableSkills.filter(
                                          (s) => s.id !== skill.id,
                                        ),
                                      )
                                    }
                                  >
                                    <Trash2 className="text-destructive h-4 w-4" />
                                  </Button>
                                </TableCell>
                              )}
                            </TableRow>
                          ))}
                        </TableBody>
                      </Table>
                    </div>
                    {isSkillsEditing && (
                      <div className="bg-background mt-4 flex flex-col gap-2 rounded-md border p-3">
                        <div className="flex gap-2">
                          <Input
                            placeholder={t('dh.basic')}
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
                            className="border-input bg-background focus-visible:ring-ring flex h-9 w-32 rounded-md border px-3 py-1 text-sm shadow-sm transition-colors focus-visible:ring-1 focus-visible:outline-none"
                          >
                            {CHARACTERISTIC_KEYS.map((key) => (
                              <option key={key} value={key}>
                                {t(key)} ({t(ABBR_KEYS[key])})
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
                      {t('dh.advanced')}
                    </h4>
                    <div className="overflow-hidden rounded-lg border">
                      <Table>
                        <TableHeader>
                          <TableRow>
                            <TableHead
                              className={cn('w-[40px]', isCompactView && 'p-1')}
                            >
                              {t('common.notes')}
                            </TableHead>
                            <TableHead
                              className={cn(
                                'w-2/5',
                                isCompactView && 'p-2 text-xs',
                              )}
                            >
                              {t('common.name')}
                            </TableHead>
                            <TableHead
                              className={cn(
                                'w-[60px] px-1 text-center',
                                isCompactView && 'p-1 text-xs',
                              )}
                            >
                              {t('dh.skilled')}
                            </TableHead>
                            <TableHead
                              className={cn(
                                'w-[60px] px-1 text-center',
                                isCompactView && 'p-1 text-xs',
                              )}
                            >
                              +10
                            </TableHead>
                            <TableHead
                              className={cn(
                                'w-[60px] px-1 text-center',
                                isCompactView && 'p-1 text-xs',
                              )}
                            >
                              +20
                            </TableHead>
                            {showPlus30 && (
                              <TableHead
                                className={cn(
                                  'w-[60px] px-1 text-center',
                                  isCompactView && 'p-1 text-xs',
                                )}
                              >
                                +30
                              </TableHead>
                            )}
                            {isSkillsEditing && (
                              <TableHead
                                className={cn(isCompactView && 'p-1')}
                              ></TableHead>
                            )}
                          </TableRow>
                        </TableHeader>
                        <TableBody>
                          {advancedSkills.map((skill) => (
                            <TableRow key={skill.id}>
                              <TableCell className={cn(isCompactView && 'p-1')}>
                                {!hideNotes && (
                                  <Popover>
                                    <PopoverTrigger asChild>
                                      <Button
                                        variant={
                                          skill.notes ? 'secondary' : 'ghost'
                                        }
                                        size="icon"
                                        className="h-7 w-7"
                                      >
                                        <InfoIcon className="h-4 w-4" />
                                      </Button>
                                    </PopoverTrigger>
                                    <PopoverContent className="w-64">
                                      <Label className="mb-2 block text-xs">
                                        {t('common.notesFor')}{' '}
                                        {getTranslatedSkillName(skill.name, t)}
                                      </Label>
                                      <Textarea
                                        defaultValue={skill.notes || ''}
                                        onBlur={(e) =>
                                          updateCharacter(character.id, {
                                            skills: (
                                              character.skills || []
                                            ).map((s) =>
                                              s.id === skill.id
                                                ? {
                                                    ...s,
                                                    notes: e.target.value,
                                                  }
                                                : s,
                                            ),
                                          })
                                        }
                                        placeholder={`${t('common.addNotes')}...`}
                                        className="mt-2 min-h-[100px] text-sm"
                                      />
                                    </PopoverContent>
                                  </Popover>
                                )}
                              </TableCell>
                              <TableCell className={cn(isCompactView && 'p-2')}>
                                {isSkillsEditing ? (
                                  <Input
                                    defaultValue={skill.name}
                                    onChange={(e) =>
                                      setEditableSkills(
                                        editableSkills.map((s) =>
                                          s.id === skill.id
                                            ? { ...s, name: e.target.value }
                                            : s,
                                        ),
                                      )
                                    }
                                    className="h-8 min-w-[140px] text-xs"
                                  />
                                ) : (
                                  <p
                                    className={cn(
                                      'font-medium break-words whitespace-normal',
                                      isCompactView && 'text-xs',
                                    )}
                                  >
                                    {getTranslatedSkillName(skill.name, t)}
                                  </p>
                                )}
                              </TableCell>
                              <TableCell
                                className={cn(
                                  'text-center',
                                  isCompactView && 'p-1',
                                )}
                              >
                                <Checkbox
                                  checked={skill.training.skilled}
                                  disabled={!isSkillsEditing}
                                  onCheckedChange={(c) =>
                                    handleSkillTrainingUpdate(
                                      skill.id,
                                      'skilled',
                                      !!c,
                                    )
                                  }
                                />
                              </TableCell>
                              <TableCell
                                className={cn(
                                  'text-center',
                                  isCompactView && 'p-1',
                                )}
                              >
                                <Checkbox
                                  checked={skill.training.plus10}
                                  disabled={
                                    !isSkillsEditing || !skill.training.skilled
                                  }
                                  onCheckedChange={(c) =>
                                    handleSkillTrainingUpdate(
                                      skill.id,
                                      'plus10',
                                      !!c,
                                    )
                                  }
                                />
                              </TableCell>
                              <TableCell
                                className={cn(
                                  'text-center',
                                  isCompactView && 'p-1',
                                )}
                              >
                                <Checkbox
                                  checked={skill.training.plus20}
                                  disabled={
                                    !isSkillsEditing || !skill.training.plus10
                                  }
                                  onCheckedChange={(c) =>
                                    handleSkillTrainingUpdate(
                                      skill.id,
                                      'plus20',
                                      !!c,
                                    )
                                  }
                                />
                              </TableCell>
                              {showPlus30 && (
                                <TableCell
                                  className={cn(
                                    'text-center',
                                    isCompactView && 'p-1',
                                  )}
                                >
                                  <Checkbox
                                    checked={!!skill.training.plus30}
                                    disabled={
                                      !isSkillsEditing || !skill.training.plus20
                                    }
                                    onCheckedChange={(c) =>
                                      handleSkillTrainingUpdate(
                                        skill.id,
                                        'plus30',
                                        !!c,
                                      )
                                    }
                                  />
                                </TableCell>
                              )}
                              {isSkillsEditing && (
                                <TableCell
                                  className={cn(isCompactView && 'p-1')}
                                >
                                  <Button
                                    variant="ghost"
                                    size="icon"
                                    className="h-7 w-7"
                                    onClick={() =>
                                      setEditableSkills(
                                        editableSkills.filter(
                                          (s) => s.id !== skill.id,
                                        ),
                                      )
                                    }
                                  >
                                    <Trash2 className="text-destructive h-4 w-4" />
                                  </Button>
                                </TableCell>
                              )}
                            </TableRow>
                          ))}
                        </TableBody>
                      </Table>
                    </div>
                    {isSkillsEditing && (
                      <div className="bg-background mt-4 flex flex-col gap-2 rounded-md border p-3">
                        <div className="flex gap-2">
                          <Input
                            placeholder={t('dh.advanced')}
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
                            className="border-input bg-background focus-visible:ring-ring flex h-9 w-32 rounded-md border px-3 py-1 text-sm shadow-sm transition-colors focus-visible:ring-1 focus-visible:outline-none"
                          >
                            {CHARACTERISTIC_KEYS.map((key) => (
                              <option key={key} value={key}>
                                {t(key)} ({t(ABBR_KEYS[key])})
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
                    {t('dh.talentsAndTraits')}
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
                    <ul className="space-y-3">
                      {(editableTalents ?? []).map((talent) => (
                        <li
                          key={talent.id}
                          className="bg-background space-y-2 rounded-md border p-3"
                        >
                          <div className="flex items-center gap-2">
                            {!hideNotes && (
                              <Popover>
                                <PopoverTrigger asChild>
                                  <Button
                                    variant={
                                      talent.notes ? 'secondary' : 'ghost'
                                    }
                                    size="icon"
                                    className="h-9 w-9 shrink-0"
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
                                            ? { ...t, notes: e.target.value }
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
                                    ? { ...t, description: e.target.value }
                                    : t,
                                ),
                              )
                            }
                            placeholder={`${t('common.description')}...`}
                            className="min-h-[60px] text-sm"
                          />
                        </li>
                      ))}
                    </ul>
                    <div className="bg-background space-y-2 rounded-md border p-3">
                      <Input
                        placeholder={t('dh.newTalentPlaceholder')}
                        value={newTalentName}
                        onChange={(e) => setNewTalentName(e.target.value)}
                      />
                      <Textarea
                        placeholder={t('dh.descriptionOptional')}
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
                      character.talents.map((talent) => (
                        <div
                          key={talent.id}
                          className="bg-background overflow-hidden rounded-md border"
                        >
                          <Collapsible>
                            <div
                              className={cn(
                                'flex items-start gap-2 p-3',
                                isCompactView ? 'text-xs' : 'text-sm',
                              )}
                            >
                              {!hideNotes && (
                                <Popover>
                                  <PopoverTrigger asChild>
                                    <Button
                                      variant={
                                        talent.notes ? 'secondary' : 'ghost'
                                      }
                                      size="icon"
                                      className="mt-0.5 h-6 w-6 shrink-0"
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
                                              ? { ...t, notes: e.target.value }
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
                                    &bull; {talent.name}
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
                                        isCompactView ? 'text-xs' : 'text-sm',
                                      )}
                                    >
                                      {talent.description}
                                    </p>
                                  </CollapsibleContent>
                                )}
                              </div>
                            </div>
                          </Collapsible>
                        </div>
                      ))
                    ) : (
                      <p
                        className={cn(
                          'text-muted-foreground',
                          isCompactView ? 'text-xs' : 'text-sm',
                        )}
                      >
                        {t('dh.noTalentsOrTraits')}
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
