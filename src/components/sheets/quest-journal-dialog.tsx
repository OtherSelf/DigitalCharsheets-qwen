'use client';

import { useState } from 'react';

import { format } from 'date-fns';
import {
  CheckCircle2,
  ChevronDown,
  ChevronUp,
  Circle,
  Gift,
  MapPin,
  PlusCircle,
  ScrollText,
  Star,
  StickyNote,
  Swords,
  Trash2,
  User,
} from 'lucide-react';

import {
  Accordion,
  AccordionContent,
  AccordionItem,
  AccordionTrigger,
} from '@/components/ui/accordion';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import {
  Sheet,
  SheetContent,
  SheetDescription,
  SheetHeader,
  SheetTitle,
} from '@/components/ui/sheet';
import { Textarea } from '@/components/ui/textarea';
import { useCharacterContext } from '@/context/character-context';
import { useTranslation } from '@/context/language-context';
import { useToast } from '@/hooks/use-toast';
import { type Character, type Quest, type QuestObjective } from '@/lib/types';
import { cn } from '@/lib/utils';

import { Badge } from '../ui/badge';
import { ScrollArea } from '../ui/scroll-area';

interface QuestJournalSheetProps {
  character: Character;
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

type FilterType = 'all' | 'active' | 'completed';

export function QuestJournalSheet({
  character,
  open,
  onOpenChange,
}: QuestJournalSheetProps) {
  const { updateCharacter } = useCharacterContext();
  const { toast } = useToast();
  const { t } = useTranslation();

  const [questLog, setQuestLog] = useState<Quest[]>(
    (character.questLog as Quest[] | undefined) ?? [],
  );
  const [newQuestTitle, setNewQuestTitle] = useState('');
  const [filter, setFilter] = useState<FilterType>('all');
  const [newObjectiveText, setNewObjectiveText] = useState<
    Record<string, string>
  >({});

  const saveLog = (newLog: Quest[]) => {
    setQuestLog(newLog);
    updateCharacter(character.id, { questLog: newLog });
  };

  const updateQuest = (questId: string, updates: Partial<Quest>) => {
    const updatedLog = questLog.map((q) =>
      q.id === questId
        ? { ...q, ...updates, updatedAt: new Date().toISOString() }
        : q,
    );
    saveLog(updatedLog);
  };

  const handleAddQuest = () => {
    if (!newQuestTitle.trim()) {
      toast({
        variant: 'destructive',
        title: t('common.toastTitleRequired'),
        description: t('common.toastEnterTitle'),
      });
      return;
    }
    const newQuest: Quest = {
      id: `quest-${Date.now()}`,
      title: newQuestTitle.trim(),
      description: '',
      status: 'active',
      priority: 'side',
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
      objectives: [],
      notes: '',
      rewards: '',
      npcs: '',
      locations: '',
    };
    saveLog([newQuest, ...questLog]);
    setNewQuestTitle('');
  };

  const handleDeleteQuest = (questId: string) => {
    saveLog(questLog.filter((q) => q.id !== questId));
  };

  const moveQuest = (index: number, direction: 'up' | 'down') => {
    const newIndex = direction === 'up' ? index - 1 : index + 1;
    if (newIndex < 0 || newIndex >= questLog.length) return;
    const newLog = [...questLog];
    [newLog[index], newLog[newIndex]] = [newLog[newIndex], newLog[index]];
    saveLog(newLog);
  };

  const addObjective = (questId: string) => {
    const text = newObjectiveText[questId]?.trim();
    if (!text) return;
    const quest = questLog.find((q) => q.id === questId);
    if (!quest) return;
    const newObj: QuestObjective = {
      id: `obj-${Date.now()}`,
      text,
      completed: false,
    };
    updateQuest(questId, { objectives: [...(quest.objectives || []), newObj] });
    setNewObjectiveText((prev) => ({ ...prev, [questId]: '' }));
  };

  const toggleObjective = (questId: string, objId: string) => {
    const quest = questLog.find((q) => q.id === questId);
    if (!quest) return;
    const objs = (quest.objectives || []).map((o) =>
      o.id === objId ? { ...o, completed: !o.completed } : o,
    );
    updateQuest(questId, { objectives: objs });
  };

  const deleteObjective = (questId: string, objId: string) => {
    const quest = questLog.find((q) => q.id === questId);
    if (!quest) return;
    const objs = (quest.objectives || []).filter((o) => o.id !== objId);
    updateQuest(questId, { objectives: objs });
  };

  const filteredQuests = questLog.filter((q) => {
    if (filter === 'active') return q.status === 'active';
    if (filter === 'completed') return q.status === 'completed';
    return true;
  });

  const getPriorityBadge = (priority?: string) => {
    switch (priority) {
      case 'main':
        return (
          <Badge variant="destructive" className="h-4 px-1.5 text-[9px]">
            {t('common.mainQuest')}
          </Badge>
        );
      case 'personal':
        return (
          <Badge
            variant="secondary"
            className="h-4 border-yellow-500/50 bg-yellow-500/20 px-1.5 text-[9px] text-yellow-600"
          >
            {t('common.personalQuest')}
          </Badge>
        );
      default:
        return (
          <Badge
            variant="outline"
            className="h-4 border-blue-500/50 px-1.5 text-[9px] text-blue-500"
          >
            {t('common.sideQuest')}
          </Badge>
        );
    }
  };

  const getProgressText = (quest: Quest) => {
    if (!quest.objectives || quest.objectives.length === 0) return null;
    const done = quest.objectives.filter((o) => o.completed).length;
    return (
      <span className="text-muted-foreground ml-2 text-[10px] font-bold">
        {done}/{quest.objectives.length}
      </span>
    );
  };

  return (
    <Sheet open={open} onOpenChange={onOpenChange}>
      <SheetContent className="flex w-full flex-col p-0 sm:max-w-2xl">
        <SheetHeader className="border-b px-6 pt-6 pb-4">
          <SheetTitle className="flex items-center gap-2">
            <ScrollText className="text-primary h-5 w-5" />{' '}
            {t('common.questJournalTitle')}
          </SheetTitle>
          <SheetDescription>{t('common.questJournalDesc')}</SheetDescription>

          <div className="mt-4 flex gap-2">
            {(['all', 'active', 'completed'] as FilterType[]).map((f) => (
              <Button
                key={f}
                variant={filter === f ? 'default' : 'outline'}
                size="sm"
                className="h-8 flex-1 text-xs capitalize"
                onClick={() => setFilter(f)}
              >
                {f === 'all'
                  ? t('common.filterAll')
                  : f === 'active'
                    ? t('common.filterActive')
                    : t('common.filterCompleted')}
                {f === 'active' &&
                  ` (${questLog.filter((q) => q.status === 'active').length})`}
              </Button>
            ))}
          </div>
        </SheetHeader>

        <ScrollArea className="flex-grow">
          <div className="space-y-6 p-6">
            {filter !== 'completed' && (
              <div className="flex gap-2">
                <Input
                  placeholder={t('common.newQuestTitlePlaceholder')}
                  value={newQuestTitle}
                  onChange={(e) => setNewQuestTitle(e.target.value)}
                  onKeyDown={(e) => e.key === 'Enter' && handleAddQuest()}
                  className="flex-1"
                />
                <Button
                  onClick={handleAddQuest}
                  size="icon"
                  className="shrink-0"
                >
                  <PlusCircle className="h-4 w-4" />
                </Button>
              </div>
            )}

            {filteredQuests.length > 0 ? (
              <Accordion type="multiple" className="w-full space-y-2">
                {filteredQuests.map((quest, index) => {
                  const isCompleted = quest.status === 'completed';
                  return (
                    <AccordionItem
                      key={quest.id}
                      value={quest.id}
                      className="bg-background overflow-hidden rounded-lg border shadow-sm"
                    >
                      <AccordionTrigger className="hover:bg-muted/50 px-4 py-3 transition-colors hover:no-underline">
                        <div className="flex w-full items-center justify-between gap-2 pr-2">
                          <div className="flex min-w-0 flex-1 items-center gap-2">
                            {getPriorityBadge(quest.priority)}
                            <span
                              className={cn(
                                'truncate text-sm font-semibold',
                                isCompleted &&
                                  'text-muted-foreground line-through',
                              )}
                            >
                              {quest.title}
                            </span>
                            {getProgressText(quest)}
                          </div>
                          <Badge
                            variant={isCompleted ? 'secondary' : 'default'}
                            className="h-4 shrink-0 px-1.5 text-[9px]"
                          >
                            {isCompleted
                              ? t('common.questDone')
                              : t('common.questActive')}
                          </Badge>
                        </div>
                      </AccordionTrigger>
                      <AccordionContent className="bg-muted/5 space-y-4 border-t px-4 pt-2 pb-4">
                        <div className="flex gap-2">
                          <Select
                            value={quest.priority || 'side'}
                            onValueChange={(v: any) =>
                              updateQuest(quest.id, { priority: v })
                            }
                          >
                            <SelectTrigger className="h-8 w-32 text-xs">
                              <SelectValue />
                            </SelectTrigger>
                            <SelectContent>
                              <SelectItem value="main">
                                {t('common.selectMainQuest')}
                              </SelectItem>
                              <SelectItem value="side">
                                {t('common.selectSideQuest')}
                              </SelectItem>
                              <SelectItem value="personal">
                                {t('common.selectPersonalQuest')}
                              </SelectItem>
                            </SelectContent>
                          </Select>
                          <Button
                            variant="outline"
                            size="sm"
                            className="h-8 flex-1 text-xs"
                            onClick={() =>
                              updateQuest(quest.id, {
                                status: isCompleted ? 'active' : 'completed',
                              })
                            }
                          >
                            {isCompleted
                              ? t('common.markAsActive')
                              : t('common.markAsCompleted')}
                          </Button>
                        </div>

                        <div className="space-y-1">
                          <Label className="text-muted-foreground flex items-center gap-1 text-[10px] font-bold uppercase">
                            <ScrollText className="h-3 w-3" />{' '}
                            {t('common.questDescription')}
                          </Label>
                          <Textarea
                            defaultValue={quest.description}
                            onBlur={(e) =>
                              updateQuest(quest.id, {
                                description: e.target.value,
                              })
                            }
                            placeholder={t(
                              'common.questDescriptionPlaceholder',
                            )}
                            className="min-h-[60px] text-sm"
                          />
                        </div>

                        <div className="space-y-2">
                          <Label className="text-muted-foreground flex items-center gap-1 text-[10px] font-bold uppercase">
                            <CheckCircle2 className="h-3 w-3" />{' '}
                            {t('common.questObjectives')}
                          </Label>
                          <div className="space-y-1">
                            {(quest.objectives || []).map((obj) => (
                              <div
                                key={obj.id}
                                className="group flex items-center gap-2"
                              >
                                <Button
                                  variant="ghost"
                                  size="icon"
                                  className="h-6 w-6 shrink-0"
                                  onClick={() =>
                                    toggleObjective(quest.id, obj.id)
                                  }
                                >
                                  {obj.completed ? (
                                    <CheckCircle2 className="h-4 w-4 text-green-500" />
                                  ) : (
                                    <Circle className="text-muted-foreground h-4 w-4" />
                                  )}
                                </Button>
                                <Input
                                  defaultValue={obj.text}
                                  onBlur={(e) => {
                                    const q = questLog.find(
                                      (q) => q.id === quest.id,
                                    );
                                    const objs = (q?.objectives || []).map(
                                      (o) =>
                                        o.id === obj.id
                                          ? { ...o, text: e.target.value }
                                          : o,
                                    );
                                    updateQuest(quest.id, { objectives: objs });
                                  }}
                                  className={cn(
                                    'h-7 flex-1 text-xs',
                                    obj.completed &&
                                      'text-muted-foreground line-through',
                                  )}
                                />
                                <Button
                                  variant="ghost"
                                  size="icon"
                                  className="text-destructive h-6 w-6 opacity-0 transition-opacity group-hover:opacity-100"
                                  onClick={() =>
                                    deleteObjective(quest.id, obj.id)
                                  }
                                >
                                  <Trash2 className="h-3 w-3" />
                                </Button>
                              </div>
                            ))}
                          </div>
                          <div className="flex gap-2">
                            <Input
                              placeholder={t('common.addObjectivePlaceholder')}
                              value={newObjectiveText[quest.id] || ''}
                              onChange={(e) =>
                                setNewObjectiveText((prev) => ({
                                  ...prev,
                                  [quest.id]: e.target.value,
                                }))
                              }
                              onKeyDown={(e) =>
                                e.key === 'Enter' && addObjective(quest.id)
                              }
                              className="h-7 flex-1 text-xs"
                            />
                            <Button
                              size="sm"
                              variant="outline"
                              className="h-7 px-2"
                              onClick={() => addObjective(quest.id)}
                            >
                              <PlusCircle className="h-3 w-3" />
                            </Button>
                          </div>
                        </div>

                        <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
                          <div className="space-y-1">
                            <Label className="text-muted-foreground flex items-center gap-1 text-[10px] font-bold uppercase">
                              <Gift className="h-3 w-3" />{' '}
                              {t('common.questRewards')}
                            </Label>
                            <Input
                              defaultValue={quest.rewards || ''}
                              onBlur={(e) =>
                                updateQuest(quest.id, {
                                  rewards: e.target.value,
                                })
                              }
                              placeholder={t('common.questRewardsPlaceholder')}
                              className="h-7 text-xs"
                            />
                          </div>
                          <div className="space-y-1">
                            <Label className="text-muted-foreground flex items-center gap-1 text-[10px] font-bold uppercase">
                              <MapPin className="h-3 w-3" />{' '}
                              {t('common.questLocations')}
                            </Label>
                            <Input
                              defaultValue={quest.locations || ''}
                              onBlur={(e) =>
                                updateQuest(quest.id, {
                                  locations: e.target.value,
                                })
                              }
                              placeholder={t(
                                'common.questLocationsPlaceholder',
                              )}
                              className="h-7 text-xs"
                            />
                          </div>
                          <div className="space-y-1 sm:col-span-2">
                            <Label className="text-muted-foreground flex items-center gap-1 text-[10px] font-bold uppercase">
                              <User className="h-3 w-3" />{' '}
                              {t('common.questNpcs')}
                            </Label>
                            <Input
                              defaultValue={quest.npcs || ''}
                              onBlur={(e) =>
                                updateQuest(quest.id, { npcs: e.target.value })
                              }
                              placeholder={t('common.questNpcsPlaceholder')}
                              className="h-7 text-xs"
                            />
                          </div>
                        </div>

                        <div className="space-y-1">
                          <Label className="text-muted-foreground flex items-center gap-1 text-[10px] font-bold uppercase">
                            <StickyNote className="h-3 w-3" />{' '}
                            {t('common.questNotes')}
                          </Label>
                          <Textarea
                            defaultValue={quest.notes || ''}
                            onBlur={(e) =>
                              updateQuest(quest.id, { notes: e.target.value })
                            }
                            placeholder={t('common.questNotesPlaceholder')}
                            className="min-h-[50px] text-xs"
                          />
                        </div>

                        <div className="flex items-center justify-between border-t pt-2">
                          <span className="text-muted-foreground text-[10px]">
                            {t('common.updated')}{' '}
                            {format(new Date(quest.updatedAt), 'MMM d, yyyy')}
                          </span>
                          <div className="flex gap-1">
                            <Button
                              variant="ghost"
                              size="icon"
                              className="h-6 w-6"
                              onClick={() =>
                                moveQuest(
                                  questLog.findIndex((q) => q.id === quest.id),
                                  'up',
                                )
                              }
                              disabled={index === 0}
                            >
                              <ChevronUp className="h-4 w-4" />
                            </Button>
                            <Button
                              variant="ghost"
                              size="icon"
                              className="h-6 w-6"
                              onClick={() =>
                                moveQuest(
                                  questLog.findIndex((q) => q.id === quest.id),
                                  'down',
                                )
                              }
                              disabled={index === questLog.length - 1}
                            >
                              <ChevronDown className="h-4 w-4" />
                            </Button>
                            <Button
                              variant="ghost"
                              size="icon"
                              className="text-destructive h-6 w-6"
                              onClick={() => handleDeleteQuest(quest.id)}
                            >
                              <Trash2 className="h-4 w-4" />
                            </Button>
                          </div>
                        </div>
                      </AccordionContent>
                    </AccordionItem>
                  );
                })}
              </Accordion>
            ) : (
              <div className="text-muted-foreground flex flex-col items-center justify-center py-12 text-center">
                <ScrollText className="mb-4 h-12 w-12 opacity-20" />
                <p className="text-sm font-medium">
                  {filter === 'all'
                    ? t('common.journalEmpty')
                    : filter === 'active'
                      ? t('common.noActiveQuests')
                      : t('common.noCompletedQuests')}
                </p>
                <p className="mt-1 text-xs">
                  {filter === 'all'
                    ? t('common.journalEmptyDesc')
                    : t('common.noFilteredQuestsDesc')}
                </p>
              </div>
            )}
          </div>
        </ScrollArea>
      </SheetContent>
    </Sheet>
  );
}
